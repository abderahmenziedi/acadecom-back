/**
 * responder.js — canonical success-response envelope.
 *
 * Every successful API response follows:
 *   { success: true, status: "success", message?: string, data: <payload> }
 *
 * The legacy `status` field is preserved so the existing frontend (which still
 * reads `response.data.status === 'success'`) keeps working during the
 * Phase 3 migration. New clients should only check `success`.
 *
 * Error envelopes are produced by the central error handler in
 * `middlewares/errorHandler.js`.
 */

/**
 * 200 OK
 * @param {import('express').Response} res
 * @param {any}    [data]
 * @param {string} [message]
 */
function ok(res, data, message) {
  return res.status(200).json(envelope(message, data));
}

/**
 * 201 Created
 * @param {import('express').Response} res
 * @param {any}    [data]
 * @param {string} [message]
 */
function created(res, data, message) {
  return res.status(201).json(envelope(message, data));
}

/**
 * 204 No Content — for delete-like operations with nothing to return.
 * @param {import('express').Response} res
 */
function noContent(res) {
  return res.status(204).send();
}

/**
 * Build a success envelope without sending it (used by streaming responses).
 * @param {string} [message]
 * @param {any}    [data]
 */
function envelope(message, data) {
  const body = { success: true, status: 'success' };
  if (message !== undefined) body.message = message;
  if (data !== undefined) body.data = data;
  return body;
}

module.exports = { ok, created, noContent, envelope };
