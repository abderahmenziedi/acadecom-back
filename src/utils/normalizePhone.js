/**
 * Normalise un indicatif téléphonique type E.164 (ex : +21612345678).
 * Retourne une chaîne commençant par + ou null si invalide.
 */
function normalizePhoneE164(input) {
  if (input == null) return null;
  let s = String(input).trim().replace(/\s+/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  const digitsPlus = s.replace(/[^\d+]/g, "");
  if (!digitsPlus.startsWith("+")) return null;
  const rest = digitsPlus.slice(1);
  if (!/^[1-9]\d{5,14}$/.test(rest)) return null;
  return `+${rest}`;
}

module.exports = { normalizePhoneE164 };
