/**
 * requestId.js — attach a short correlation id to every request.
 *
 * Adds `req.id` (8 hex chars) and an `X-Request-Id` response header so
 * server logs and frontend error reports can be correlated. If the client
 * sent its own `X-Request-Id`, we honour it (capped at 64 chars to avoid
 * header pollution).
 */

const crypto = require('crypto');

const MAX_INBOUND_LEN = 64;
const SAFE_CHARS = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {Function} next
 */
function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id =
    incoming && typeof incoming === 'string' && SAFE_CHARS.test(incoming.slice(0, MAX_INBOUND_LEN))
      ? incoming.slice(0, MAX_INBOUND_LEN)
      : crypto.randomBytes(4).toString('hex');

  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = requestId;
