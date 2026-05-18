/**
 * Options de question persistées en JSON : [{ id, text, isCorrect }]
 * @typedef {{ id?: number, text: string, isCorrect?: boolean }} OptionShape
 */

/**
 * @param {unknown} raw
 * @returns {OptionShape[]}
 */
function parseOptionsJson(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** @param {import("@prisma/client").Question} q */
function hydrateQuestion(q) {
  const opts = parseOptionsJson(q.options);
  const normalized = opts.map((o, i) => ({
    id: Number.isFinite(Number(o.id)) && Number(o.id) > 0 ? Number(o.id) : i + 1,
    text: String(o.text ?? ""),
    isCorrect: Boolean(o.isCorrect),
  }));
  /** @type {{ options?: unknown }} */
  const { options: _drop, ...rest } = q;
  return { ...rest, options: normalized };
}

/** Tableau Quiz.questions après lecture Prisma */
function hydrateQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => hydrateQuestion(q));
}

/** @param {{ questions?: unknown[] }} quiz */
function hydrateQuizQuestions(quiz) {
  if (!quiz?.questions || !Array.isArray(quiz.questions)) return { ...quiz, questions: [] };
  return {
    ...quiz,
    questions: hydrateQuestions(quiz.questions),
  };
}

/** Séquence locale 1…n par question (création / édition quiz). */
function normalizeOptionsPayload(options) {
  if (!Array.isArray(options)) return [];
  let id = 1;
  return options.map((o) => ({
    id: id++,
    text: String(o?.text ?? "").trim(),
    isCorrect: Boolean(o?.isCorrect),
  }));
}

module.exports = {
  parseOptionsJson,
  hydrateQuestion,
  hydrateQuestions,
  hydrateQuizQuestions,
  normalizeOptionsPayload,
};
