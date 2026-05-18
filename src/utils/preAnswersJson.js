/**
 * Pré-réponses stockées sur Participant : [{ quizId, preQuestionId, answerText }]
 * @typedef {{ quizId?: number, preQuestionId?: number, answerText?: string }} PreAnswerShape
 */

/**
 * @param {unknown} raw
 * @returns {PreAnswerShape[]}
 */
function parsePreAnswersJson(raw) {
  if (raw == null) return [];
  let v = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
}

/**
 * Remplace pour un quiz les entrées (quizId + preQuestionId).
 * @param {unknown} currentRaw
 * @param {number} quizId
 * @param {Array<{ preQuestionId?: unknown, answerText?: unknown }>} answerRows
 */
function mergePreAnswersForQuiz(currentRaw, quizId, answerRows) {
  const qid = Number(quizId);
  const parsed = parsePreAnswersJson(currentRaw);
  const rest = parsed.filter((e) => Number(e.quizId) !== qid);
  const next = answerRows.map((row) => ({
    quizId: qid,
    preQuestionId: Number(row.preQuestionId),
    answerText: String(row.answerText ?? "").trim(),
  }));
  return [...rest, ...next];
}

/**
 * @param {unknown} preAnswersRaw
 * @param {number} quizId
 * @param {number[]} preQuestionIds
 */
function participantHasAnswersForQuizRows(preAnswersRaw, quizId, preQuestionIds) {
  const qid = Number(quizId);
  const ids = preQuestionIds.map(Number);
  const rows = parsePreAnswersJson(preAnswersRaw).filter((e) => Number(e.quizId) === qid);
  const map = new Map(rows.map((r) => [Number(r.preQuestionId), r.answerText]));
  for (const pqid of ids) {
    const t = map.get(pqid);
    if (!t || !String(t).trim()) return false;
  }
  return true;
}

module.exports = {
  parsePreAnswersJson,
  mergePreAnswersForQuiz,
  participantHasAnswersForQuizRows,
};
