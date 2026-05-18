const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");
const { hydrateQuizQuestions } = require("../utils/questionOptionsJson");

function normalizeAnswerEntry(raw) {
  const qid = Number(raw?.questionId);
  if (!Number.isInteger(qid) || qid < 1) {
    throw new ApiError(400, "questionId invalide");
  }
  let ids = raw?.selectedOptionIds;
  if (ids == null && raw?.selectedOptionId != null) {
    ids = [Number(raw.selectedOptionId)];
  }
  if (!Array.isArray(ids)) {
    throw new ApiError(400, "selectedOptionIds doit être un tableau");
  }
  const uniq = [
    ...new Set(
      ids
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  return { questionId: qid, selectedOptionIds: uniq };
}

function setsEqual(setA, setB) {
  if (setA.size !== setB.size) return false;
  for (const x of setA) if (!setB.has(x)) return false;
  return true;
}

/**
 * Terminer un quiz : une session par couple participant + quiz.
 *
 * answers: [{ questionId, selectedOptionIds: number[] }] ou ancien format { questionId, selectedOptionId }
 *
 * Score (% bonnes réponses) : proportion de questions où la sélection correspond exactement aux bonnes réponses.
 * Coupons : tout le montant maxCoupons si score ≥ passingScore, sinon 0.
 * XP : par question, sans mauvaise réponse cochée : xpReward × (bonnes réponses cochées / nombre de bonnes réponses attendues).
 */
async function playQuiz(participantDbId, quizId, answersPayload, durationSeconds = 0) {
  const existing = await prisma.quizAttempt.findFirst({
    where: {
      participantId: participantDbId,
      quizId,
      completedAt: { not: null },
    },
  });
  if (existing) throw new ApiError(409, "Quiz déjà joué");

  const quizRaw = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      brand: { select: { userId: true } },
      preQuestions: { select: { id: true } },
      questions: {
        orderBy: { id: "asc" },
      },
    },
  });
  const quiz = quizRaw ? hydrateQuizQuestions(quizRaw) : null;
  if (!quiz) throw new ApiError(404, "Quiz introuvable");
  if (!quiz.isActive) throw new ApiError(400, "Quiz inactif");

  const attempt = await prisma.quizAttempt.findUnique({
    where: { participantId_quizId: { participantId: participantDbId, quizId } },
  });
  if (!attempt) {
    throw new ApiError(
      403,
      "Démarrez le quiz depuis le catalogue avant de soumettre vos réponses.",
    );
  }
  if (attempt.completedAt) {
    throw new ApiError(409, "Quiz déjà joué");
  }

  const attemptId = attempt.id;

  const { participantHasCompletedPreQuestions } = require("./participant.service");
  if (
    quiz.hasPreQuestions &&
    quiz.preQuestions.length > 0 &&
    !(await participantHasCompletedPreQuestions(participantDbId, quizId))
  ) {
    throw new ApiError(
      403,
      "Complétez d'abord les questions préliminaires avant de valider le quiz principal.",
    );
  }

  const questions = [...quiz.questions];
  const totalQuestions = questions.length;
  if (totalQuestions === 0) throw new ApiError(400, "Quiz sans questions");

  if (!Array.isArray(answersPayload) || answersPayload.length !== totalQuestions) {
    throw new ApiError(400, "Nombre de réponses incorrect");
  }

  const submittedByQuestion = {};
  for (const raw of answersPayload) {
    const entry = normalizeAnswerEntry(raw);
    if (submittedByQuestion[entry.questionId]) {
      throw new ApiError(400, "Question dupliquée dans les réponses");
    }
    submittedByQuestion[entry.questionId] = entry.selectedOptionIds;
  }

  for (const q of questions) {
    if (submittedByQuestion[q.id] === undefined) {
      throw new ApiError(400, `Question ${q.id} manquante`);
    }
  }

  let fullyCorrectCount = 0;
  let xpEarned = 0;
  const answersToStore = [];

  for (const q of questions) {
    const selectedArr = submittedByQuestion[q.id];
    const selectedSet = new Set(selectedArr);
    const opts = q.options;
    const optionIds = new Set(opts.map((o) => o.id));
    const correctSet = new Set(opts.filter((o) => o.isCorrect).map((o) => o.id));

    if (correctSet.size === 0) {
      throw new ApiError(500, `Question ${q.id} sans bonne réponse configurée`);
    }

    for (const sid of selectedSet) {
      if (!optionIds.has(sid)) {
        throw new ApiError(400, "Option invalide pour cette question");
      }
    }

    const wrongPick = [...selectedSet].some((id) => !correctSet.has(id));

    let xpQuestion = 0;
    if (!wrongPick && correctSet.size > 0) {
      const hit = [...selectedSet].filter((id) => correctSet.has(id)).length;
      xpQuestion = Math.round(q.xpReward * (hit / correctSet.size));
    }
    xpEarned += xpQuestion;

    const fullyCorrect = setsEqual(selectedSet, correctSet);
    if (fullyCorrect) fullyCorrectCount += 1;

    answersToStore.push({
      questionId: q.id,
      selectedOptionIds: [...selectedSet].sort((a, b) => a - b),
      isCorrect: fullyCorrect,
    });
  }

  const scoreFraction =
    totalQuestions > 0 ? Math.round((fullyCorrectCount / totalQuestions) * 1000000) / 1000000 : 0;

  const passed = scoreFraction >= quiz.passingScore;
  const couponsEarned = passed ? quiz.maxCoupons : 0;

  const session = await prisma.$transaction(async (tx) => {
    const sess = await tx.quizAttempt.update({
      where: { id: attemptId },
      data: {
        completedAt: new Date(),
        scorePercent: scoreFraction,
        xpEarned,
        couponsEarned,
        passed,
        durationSeconds: durationSeconds ?? 0,
        responses: answersToStore,
      },
    });

    const updated = await tx.participant.update({
      where: { id: participantDbId },
      data: {
        xp: { increment: xpEarned },
        coupons: { increment: couponsEarned },
        totalPoints: { increment: xpEarned },
      },
    });

    const rankRow = await tx.xpRank.findFirst({
      where: {
        minXp: { lte: updated.xp },
        maxXp: { gte: updated.xp },
      },
    });

    const rank =
      rankRow ??
      (await tx.xpRank.findFirst({
        orderBy: { maxXp: "desc" },
      }));

    await tx.participant.update({
      where: { id: participantDbId },
      data: { xpRankId: rank.id },
    });

    const pctLabel = Math.round(scoreFraction * 100);
    const msg = passed
      ? `Quiz terminé (${pctLabel} %). +${xpEarned} XP, +${couponsEarned} coupons.`
      : `Quiz terminé (${pctLabel} %). +${xpEarned} XP — seuil non atteint, pas de coupons.`;

    await tx.notification.create({
      data: {
        userId: updated.userId,
        type: "quiz_completed",
        message: msg,
      },
    });

    if (quiz.brand?.userId) {
      const participantProfile = await tx.participant.findUnique({
        where: { id: participantDbId },
        include: { user: { select: { name: true, email: true } } },
      });
      if (participantProfile?.user) {
        const outcome = passed ? "réussi" : "échoué";
        await tx.notification.create({
          data: {
            userId: quiz.brand.userId,
            type: "quiz_completed",
            message: `Quiz « ${quiz.title} » — ${participantProfile.user.name} (${participantProfile.user.email}) — Score ${pctLabel} % — résultat : ${outcome}.`,
          },
        });
      }
    }

    return { sess: { ...sess, scorePercent: scoreFraction, playedAt: sess.completedAt }, rank };
  });

  return {
    scorePercent: scoreFraction,
    xpEarned,
    couponsEarned,
    passed,
    xpRank: session.rank,
    sessionId: session.sess.id,
  };
}

module.exports = { playQuiz };
