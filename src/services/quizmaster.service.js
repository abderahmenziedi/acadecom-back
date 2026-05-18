const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");
const BrandPlanService = require("./brandPlan.service");
const {
  hydrateQuizQuestions,
  hydrateQuestion,
  normalizeOptionsPayload,
} = require("../utils/questionOptionsJson");

function hydrateQuiz(quiz) {
  return quiz ? hydrateQuizQuestions(quiz) : quiz;
}

function validateQuestionOptions(options, label = "Question") {
  if (!Array.isArray(options) || options.length < 2) {
    throw new ApiError(400, `${label}: au moins 2 réponses possibles sont requises`);
  }
  let correct = 0;
  for (const o of options) {
    if (!o || typeof o.text !== "string" || !String(o.text).trim()) {
      throw new ApiError(400, `${label}: chaque réponse doit avoir un texte`);
    }
    if (o.isCorrect) correct += 1;
  }
  if (correct < 1) {
    throw new ApiError(400, `${label}: cochez au moins une bonne réponse`);
  }
}

function clampPassingScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function clampDurationSeconds(v) {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isInteger(n) || n < 1) return 300;
  return Math.min(86400, n);
}

function clampMaxCoupons(v) {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(10000, n);
}

async function resolveQuizmaster(userId) {
  const qm = await prisma.quizmaster.findUnique({ where: { userId } });
  if (!qm) throw new ApiError(403, "Compte quizmaster introuvable");
  return qm;
}

async function assertOwnQuiz(quizmasterId, quizId) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, quizmasterId },
  });
  if (!quiz) throw new ApiError(404, "Quiz introuvable");
  return quiz;
}

async function assertOwnQuestion(quizmasterId, questionId) {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    include: { quiz: true },
  });
  if (!q || q.quiz.quizmasterId !== quizmasterId) throw new ApiError(404, "Question introuvable");
  return q;
}

async function listQuizzes(userId) {
  const qm = await resolveQuizmaster(userId);
  return prisma.quiz.findMany({
    where: { quizmasterId: qm.id },
    orderBy: { id: "desc" },
    include: { _count: { select: { questions: true, preQuestions: true } } },
  });
}

async function getQuiz(userId, quizId) {
  const qm = await resolveQuizmaster(userId);
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, quizmasterId: qm.id },
    include: {
      questions: { orderBy: { id: "asc" } },
      preQuestions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });
  if (!quiz) throw new ApiError(404, "Quiz introuvable");
  return hydrateQuiz(quiz);
}

async function createQuiz(userId, body) {
  const qm = await prisma.quizmaster.findUnique({
    where: { userId },
    select: {
      id: true,
      brandId: true,
      isProfileComplete: true,
    },
  });
  if (!qm) throw new ApiError(403, "Compte quizmaster introuvable");
  if (!qm.isProfileComplete) {
    throw new ApiError(
      403,
      "Profil incomplet : complétez votre profil (photo, téléphone avec indicatif, genre, date de naissance, nom et email) avant de créer un quiz.",
    );
  }

  const willBeActive = Boolean(body.isActive);
  if (willBeActive) {
    await BrandPlanService.assertActiveQuizBudget(qm.brandId, {
      wasActive: false,
      willBeActive: true,
    });
  }

  let questionsCreate;
  if (body.questions?.length) {
    for (let i = 0; i < body.questions.length; i += 1) {
      const q = body.questions[i];
      validateQuestionOptions(q.options || [], `Question ${i + 1}`);
    }
    questionsCreate = {
      create: body.questions.map((q) => ({
        text: q.text,
        xpReward: Number(q.xpReward ?? 10),
        hint: q.hint ?? null,
        options: normalizeOptionsPayload(q.options || []),
      })),
    };
  }

  const hasPre = Boolean(body.hasPreQuestions);
  const preList = Array.isArray(body.preQuestions) ? body.preQuestions : [];
  if (hasPre && preList.length < 1) {
    throw new ApiError(400, "Au moins une pré-question est requise lorsque l'option est activée.");
  }
  let preCreate;
  if (hasPre && preList.length) {
    for (let i = 0; i < preList.length; i += 1) {
      if (!String(preList[i]?.questionText || "").trim()) {
        throw new ApiError(400, `Pré-question ${i + 1} : texte requis.`);
      }
    }
    preCreate = {
      create: preList.map((pq, i) => ({
        questionText: String(pq.questionText).trim(),
        sortOrder: i,
      })),
    };
  }

  const row = await prisma.quiz.create({
    data: {
      brandId: qm.brandId,
      quizmasterId: qm.id,
      title: body.title,
      category: body.category ?? null,
      image: body.image ?? null,
      maxCoupons: clampMaxCoupons(body.maxCoupons ?? 10),
      isActive: Boolean(body.isActive),
      durationSeconds: clampDurationSeconds(body.durationSeconds ?? 300),
      passingScore: clampPassingScore(body.passingScore ?? 0.5),
      hasPreQuestions: Boolean(hasPre && preList.length > 0),
      questions: questionsCreate,
      preQuestions: preCreate,
    },
    include: {
      questions: { orderBy: { id: "asc" } },
      preQuestions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });
  return hydrateQuiz(row);
}

async function updateQuiz(userId, quizId, body) {
  const qm = await resolveQuizmaster(userId);
  await assertOwnQuiz(qm.id, quizId);

  const existing = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { isActive: true, brandId: true },
  });
  if (!existing) throw new ApiError(404, "Quiz introuvable");

  if (body.isActive !== undefined) {
    await BrandPlanService.assertActiveQuizBudget(existing.brandId, {
      wasActive: existing.isActive,
      willBeActive: Boolean(body.isActive),
    });
  }

  const data = {
    ...(body.title != null && { title: body.title }),
    ...(body.category !== undefined && { category: body.category }),
    ...(body.image !== undefined && { image: body.image }),
    ...(body.maxCoupons != null && { maxCoupons: clampMaxCoupons(body.maxCoupons) }),
    ...(body.durationSeconds != null && { durationSeconds: clampDurationSeconds(body.durationSeconds) }),
    ...(body.passingScore != null && { passingScore: clampPassingScore(body.passingScore) }),
    ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
    ...(body.randomizeQuestions !== undefined && {
      randomizeQuestions: Boolean(body.randomizeQuestions),
    }),
    ...(body.shuffleOptions !== undefined && { shuffleOptions: Boolean(body.shuffleOptions) }),
  };

  const touchesPre = body.preQuestions !== undefined || body.hasPreQuestions !== undefined;

  if (!touchesPre) {
    const row = await prisma.quiz.update({
      where: { id: quizId },
      data,
      include: {
        questions: { orderBy: { id: "asc" } },
        preQuestions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
    });
    return hydrateQuiz(row);
  }

  return prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) {
      await tx.quiz.update({ where: { id: quizId }, data });
    }

    if (body.preQuestions !== undefined) {
      if (body.hasPreQuestions === false) {
        await tx.preQuestion.deleteMany({ where: { quizId } });
        await tx.quiz.update({ where: { id: quizId }, data: { hasPreQuestions: false } });
      } else {
        const arr = Array.isArray(body.preQuestions) ? body.preQuestions : [];
        for (let i = 0; i < arr.length; i += 1) {
          if (!String(arr[i]?.questionText || "").trim()) {
            throw new ApiError(400, `Pré-question ${i + 1} : texte requis.`);
          }
        }

        const explicitOn = body.hasPreQuestions === true;
        const wantOn = explicitOn || arr.length > 0;

        if (wantOn && arr.length < 1) {
          throw new ApiError(400, "Au moins une pré-question est requise lorsque l'option est activée.");
        }

        await tx.preQuestion.deleteMany({ where: { quizId } });

        if (arr.length) {
          await tx.preQuestion.createMany({
            data: arr.map((pq, i) => ({
              quizId,
              questionText: String(pq.questionText).trim(),
              sortOrder: i,
            })),
          });
        }

        const nextFlag = arr.length > 0;
        await tx.quiz.update({
          where: { id: quizId },
          data: { hasPreQuestions: nextFlag },
        });
      }
    } else if (body.hasPreQuestions !== undefined) {
      if (body.hasPreQuestions === false) {
        await tx.preQuestion.deleteMany({ where: { quizId } });
        await tx.quiz.update({ where: { id: quizId }, data: { hasPreQuestions: false } });
      } else {
        const n = await tx.preQuestion.count({ where: { quizId } });
        if (n < 1) {
          throw new ApiError(400, "Ajoutez au moins une pré-question avant d'activer cette option.");
        }
        await tx.quiz.update({ where: { id: quizId }, data: { hasPreQuestions: true } });
      }
    }

    const row = await tx.quiz.findFirst({
      where: { id: quizId },
      include: {
        questions: { orderBy: { id: "asc" } },
        preQuestions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
    });
    return hydrateQuiz(row);
  });
}

async function deleteQuiz(userId, quizId) {
  const qm = await resolveQuizmaster(userId);
  await assertOwnQuiz(qm.id, quizId);
  await prisma.quiz.delete({ where: { id: quizId } });
}

async function addQuestion(userId, quizId, body) {
  const qm = await resolveQuizmaster(userId);
  await assertOwnQuiz(qm.id, quizId);

  validateQuestionOptions(body.options || [], "Question");

  const row = await prisma.question.create({
    data: {
      quizId,
      text: body.text,
      xpReward: Number(body.xpReward ?? 10),
      hint: body.hint ?? null,
      options: normalizeOptionsPayload(body.options || []),
    },
  });
  return hydrateQuestion(row);
}

async function updateQuestion(userId, questionId, body) {
  const qm = await resolveQuizmaster(userId);
  await assertOwnQuestion(qm.id, questionId);

  validateQuestionOptions(body.options || [], "Question");

  const row = await prisma.question.update({
    where: { id: questionId },
    data: {
      text: body.text,
      xpReward: Number(body.xpReward ?? 10),
      hint: body.hint ?? null,
      options: normalizeOptionsPayload(body.options || []),
    },
  });
  return hydrateQuestion(row);
}

async function deleteQuestion(userId, questionId) {
  const qm = await resolveQuizmaster(userId);
  await assertOwnQuestion(qm.id, questionId);
  await prisma.question.delete({ where: { id: questionId } });
}

module.exports = {
  resolveQuizmaster,
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
};
