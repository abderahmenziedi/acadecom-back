const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");
const {
  ALLOWED_GENDERS,
  isParticipantProfileComplete,
  parseBirthDate,
  isValidEmail,
} = require("../utils/participantProfileComplete");
const { normalizePhoneE164 } = require("../utils/normalizePhone");
const { shuffleArray } = require("../utils/shuffle");
const { hydrateQuestions } = require("../utils/questionOptionsJson");
const {
  mergePreAnswersForQuiz,
  participantHasAnswersForQuizRows,
} = require("../utils/preAnswersJson");

async function resolveParticipant(userId) {
  const p = await prisma.participant.findUnique({ where: { userId } });
  if (!p) throw new ApiError(403, "Compte participant introuvable");
  return p;
}

function mapProfileResponse(row) {
  if (!row) return null;
  const u = row.user;
  return {
    userId: u.id,
    participantId: row.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isBlocked: u.isBlocked,
    createdAt: u.createdAt,
    avatar: u.avatar,
    profilePhotoUrl: row.profilePhotoUrl,
    avatarUrl: row.profilePhotoUrl || u.avatar,
    phoneE164: row.phoneE164,
    gender: row.gender,
    birthDate: row.birthDate,
    country: row.country,
    city: row.city,
    isProfileComplete: row.isProfileComplete,
    xp: row.xp,
    coupons: row.coupons,
    totalPoints: row.totalPoints,
    xpRank: row.xpRank,
  };
}

async function getProfile(userId) {
  const p = await prisma.participant.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isBlocked: true,
          createdAt: true,
        },
      },
      xpRank: true,
    },
  });
  if (!p) throw new ApiError(404, "Profil introuvable");
  return mapProfileResponse(p);
}

async function updateParticipantProfile(userId, rawBody, uploadedRelativePath) {
  const participant = await prisma.participant.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isBlocked: true,
          createdAt: true,
        },
      },
      xpRank: true,
    },
  });
  if (!participant) throw new ApiError(404, "Profil introuvable");

  const body = rawBody || {};

  const userUpdates = {};
  if (body.name !== undefined && body.name !== null && String(body.name).trim() !== "") {
    const n = String(body.name).trim();
    if (!n.length) throw new ApiError(400, "Nom requis");
    userUpdates.name = n;
  }
  if (body.email !== undefined && body.email !== null && String(body.email).trim() !== "") {
    const e = String(body.email).trim();
    if (!isValidEmail(e)) throw new ApiError(400, "Email invalide");
    userUpdates.email = e;
    if (e !== participant.user.email) {
      const clash = await prisma.user.findUnique({ where: { email: e }, select: { id: true } });
      if (clash && clash.id !== userId) throw new ApiError(409, "Cet email est déjà utilisé");
    }
  }

  let phoneE164 = participant.phoneE164;
  if (body.phoneE164 != null && String(body.phoneE164).trim() !== "") {
    const normalized = normalizePhoneE164(body.phoneE164);
    if (!normalized) {
      throw new ApiError(400, "Numéro de téléphone invalide (format international requis, ex : +21612345678).");
    }
    phoneE164 = normalized;
  }

  let gender = participant.gender;
  if (body.gender !== undefined && body.gender !== null && String(body.gender).trim() !== "") {
    const g = String(body.gender);
    if (!ALLOWED_GENDERS.includes(g)) {
      throw new ApiError(
        400,
        `Genre invalide (${ALLOWED_GENDERS.join(", ")})`,
      );
    }
    gender = g;
  }

  let birthDate = participant.birthDate;
  if (body.birthDate !== undefined && body.birthDate !== null && String(body.birthDate).trim() !== "") {
    const parsed = parseBirthDate(body.birthDate);
    if (!parsed) throw new ApiError(400, "Date de naissance invalide");
    birthDate = parsed;
  }

  let country = participant.country;
  if (body.country !== undefined && body.country !== null) {
    country = String(body.country).trim() || null;
  }

  let city = participant.city;
  if (body.city !== undefined && body.city !== null) {
    city = String(body.city).trim() || null;
  }

  let profilePhotoUrl = participant.profilePhotoUrl;
  if (uploadedRelativePath) {
    profilePhotoUrl = uploadedRelativePath;
  }

  const updatedRow = await prisma.$transaction(async (tx) => {
    if (Object.keys(userUpdates).length) {
      await tx.user.update({ where: { id: userId }, data: userUpdates });
    }

    const uFresh = await tx.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    const merged = {
      profilePhotoUrl,
      phoneE164,
      gender,
      birthDate,
      country,
      city,
    };
    const nextComplete = isParticipantProfileComplete(merged, uFresh.name, uFresh.email);

    return tx.participant.update({
      where: { userId },
      data: {
        phoneE164,
        gender,
        birthDate,
        country,
        city,
        profilePhotoUrl,
        isProfileComplete: nextComplete,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        xpRank: true,
      },
    });
  });

  return mapProfileResponse(updatedRow);
}

async function startQuizAttempt(userId, quizId) {
  const participant = await resolveParticipant(userId);
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, isActive: true },
  });
  if (!quiz) throw new ApiError(404, "Quiz introuvable");
  if (!quiz.isActive) throw new ApiError(400, "Quiz inactif");

  const played = await prisma.quizAttempt.findFirst({
    where: {
      participantId: participant.id,
      quizId,
      completedAt: { not: null },
    },
  });
  if (played) {
    throw new ApiError(409, "Vous avez déjà terminé ce quiz.");
  }

  const existing = await prisma.quizAttempt.findUnique({
    where: { participantId_quizId: { participantId: participant.id, quizId } },
  });
  if (existing) {
    return { alreadyStarted: true, startedAt: existing.reservedAt };
  }

  try {
    const row = await prisma.quizAttempt.create({
      data: {
        participantId: participant.id,
        quizId,
      },
    });
    return { started: true, startedAt: row.reservedAt };
  } catch (e) {
    if (e.code === "P2002") {
      const again = await prisma.quizAttempt.findUnique({
        where: { participantId_quizId: { participantId: participant.id, quizId } },
      });
      if (again) {
        return { alreadyStarted: true, startedAt: again.reservedAt };
      }
    }
    throw e;
  }
}

async function participantHasCompletedPreQuestions(participantDbId, quizId) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      hasPreQuestions: true,
      preQuestions: { select: { id: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });
  if (!quiz || !quiz.hasPreQuestions || quiz.preQuestions.length === 0) return true;

  const ids = quiz.preQuestions.map((p) => p.id);
  const participantRow = await prisma.participant.findUnique({
    where: { id: participantDbId },
    select: { preAnswersJson: true },
  });
  return participantHasAnswersForQuizRows(participantRow?.preAnswersJson, quizId, ids);
}

async function submitPreQuizAnswers(userId, quizId, rawBody) {
  const participant = await prisma.participant.findUnique({ where: { userId } });
  if (!participant) throw new ApiError(403, "Compte participant introuvable");

  const meta = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, isActive: true, hasPreQuestions: true },
  });
  if (!meta) throw new ApiError(404, "Quiz introuvable");
  if (!meta.isActive) throw new ApiError(400, "Quiz inactif");
  if (!meta.hasPreQuestions) {
    throw new ApiError(400, "Ce quiz n'utilise pas de pré-questions.");
  }

  const played = await prisma.quizAttempt.findFirst({
    where: {
      participantId: participant.id,
      quizId,
      completedAt: { not: null },
    },
  });
  if (played) throw new ApiError(409, "Quiz déjà joué");

  const attempt = await prisma.quizAttempt.findUnique({
    where: { participantId_quizId: { participantId: participant.id, quizId } },
  });
  if (!attempt) {
    throw new ApiError(
      403,
      "Démarrez le quiz depuis le catalogue avant d'enregistrer vos réponses aux pré-questions.",
    );
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { preQuestions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  if (!quiz.preQuestions.length) {
    throw new ApiError(400, "Aucune pré-question n'est configurée pour ce quiz.");
  }

  const answers = rawBody?.answers;
  if (!Array.isArray(answers)) {
    throw new ApiError(400, "answers doit être un tableau { preQuestionId, answerText }.");
  }

  const idSet = new Set(quiz.preQuestions.map((p) => p.id));
  const seen = new Set();
  for (const row of answers) {
    const pqid = Number(row?.preQuestionId);
    if (!Number.isInteger(pqid) || !idSet.has(pqid)) {
      throw new ApiError(400, "preQuestionId invalide ou ne correspond pas à ce quiz.");
    }
    if (seen.has(pqid)) {
      throw new ApiError(400, "Pré-question dupliquée dans les réponses.");
    }
    seen.add(pqid);
    const text = String(row?.answerText ?? "").trim();
    if (text.length < 1) {
      throw new ApiError(400, "Chaque pré-question requiert une réponse en texte libre.");
    }
  }
  if (seen.size !== idSet.size) {
    throw new ApiError(400, "Répondez à toutes les pré-questions du quiz.");
  }

  await prisma.participant.update({
    where: { id: participant.id },
    data: {
      preAnswersJson: mergePreAnswersForQuiz(participant.preAnswersJson, quizId, answers),
    },
  });

  return { preQuestionsComplete: true };
}

async function listParticipantQuizzes(participantDbId) {
  const attemptRows = await prisma.quizAttempt.findMany({
    where: { participantId: participantDbId },
    select: { quizId: true },
  });
  const attemptSet = new Set(attemptRows.map((r) => r.quizId));

  const quizzes = await prisma.quiz.findMany({
    orderBy: [{ brandId: "asc" }, { id: "desc" }],
    include: {
      brand: {
        select: {
          id: true,
          logoUrl: true,
          industry: true,
          description: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { questions: true, preQuestions: true } },
    },
  });

  return quizzes.map((q) => ({
    ...q,
    hasAttempted: attemptSet.has(q.id),
  }));
}

async function getQuizForPlay(quizId, participantDbId) {
  const meta = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, isActive: true },
  });
  if (!meta) throw new ApiError(404, "Quiz introuvable");
  if (!meta.isActive) throw new ApiError(400, "Quiz inactif");

  const played = await prisma.quizAttempt.findFirst({
    where: {
      participantId: participantDbId,
      quizId,
      completedAt: { not: null },
    },
  });
  if (played) throw new ApiError(409, "Quiz déjà joué");

  const attempt = await prisma.quizAttempt.findUnique({
    where: { participantId_quizId: { participantId: participantDbId, quizId } },
  });
  if (!attempt) {
    throw new ApiError(
      403,
      "Démarrez le quiz depuis le catalogue (bouton Jouer) avant de charger les questions.",
    );
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      preQuestions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      questions: {
        orderBy: { id: "asc" },
      },
    },
  });
  if (!quiz) throw new ApiError(404, "Quiz introuvable");

  const needsPreGate =
    quiz.hasPreQuestions &&
    quiz.preQuestions.length > 0 &&
    !(await participantHasCompletedPreQuestions(participantDbId, quizId));

  if (needsPreGate) {
    return {
      id: quiz.id,
      brandId: quiz.brandId,
      quizmasterId: quiz.quizmasterId,
      title: quiz.title,
      category: quiz.category,
      image: quiz.image,
      maxCoupons: quiz.maxCoupons,
      isActive: quiz.isActive,
      durationSeconds: quiz.durationSeconds,
      passingScore: quiz.passingScore,
      randomizeQuestions: quiz.randomizeQuestions,
      shuffleOptions: quiz.shuffleOptions,
      hasPreQuestions: true,
      preQuestionsComplete: false,
      playPhase: "preQuestions",
      preQuestions: quiz.preQuestions.map((p) => ({ id: p.id, questionText: p.questionText })),
      questions: [],
      createdAt: quiz.createdAt,
    };
  }

  let questions = hydrateQuestions(quiz.questions).map((q) => ({
    ...q,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }));

  if (quiz.randomizeQuestions) {
    questions = shuffleArray(questions);
  }
  if (quiz.shuffleOptions) {
    questions = questions.map((q) => ({
      ...q,
      options: shuffleArray(q.options),
    }));
  }

  const mainHasPre = Boolean(quiz.hasPreQuestions && quiz.preQuestions.length > 0);
  const { preQuestions: _pqdrop, questions: _qqdrop, ...quizRest } = quiz;

  return {
    ...quizRest,
    questions,
    playPhase: "main",
    preQuestionsComplete: true,
    hasPreQuestions: mainHasPre,
    preQuestions: [],
  };
}

async function getSessionResult(userId, sessionId) {
  const p = await resolveParticipant(userId);
  const session = await prisma.quizAttempt.findFirst({
    where: {
      id: sessionId,
      participantId: p.id,
      completedAt: { not: null },
    },
    include: { quiz: { select: { id: true, title: true } } },
  });
  if (!session) throw new ApiError(404, "Résultat introuvable");

  const fresh = await prisma.participant.findUnique({
    where: { id: p.id },
    include: { xpRank: true },
  });

  return {
    session: {
      id: session.id,
      scorePercent: session.scorePercent,
      xpEarned: session.xpEarned,
      couponsEarned: session.couponsEarned,
      passed: session.passed,
      playedAt: session.completedAt,
      quiz: session.quiz,
    },
    xp: fresh.xp,
    coupons: fresh.coupons,
    xpRank: fresh.xpRank,
  };
}

async function listSessions(userId) {
  const p = await resolveParticipant(userId);
  const rows = await prisma.quizAttempt.findMany({
    where: {
      participantId: p.id,
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
    include: { quiz: { select: { id: true, title: true, category: true } } },
  });
  return rows.map((s) => ({
    ...s,
    playedAt: s.completedAt,
  }));
}

module.exports = {
  resolveParticipant,
  participantHasCompletedPreQuestions,
  getProfile,
  updateParticipantProfile,
  listParticipantQuizzes,
  startQuizAttempt,
  getQuizForPlay,
  submitPreQuizAnswers,
  getSessionResult,
  listSessions,
};
