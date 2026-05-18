const { normalizePhoneE164 } = require("./normalizePhone");

const ALLOWED_GENDERS = ["female", "male", "other", "prefer_not"];

function isValidEmail(email) {
  const e = String(email || "").trim();
  return e.length >= 5 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function nameComplete(userName) {
  return typeof userName === "string" && userName.trim().length >= 1;
}

/**
 * Profil participant : nom, photo, téléphone E.164, email, genre, naissance, pays, ville.
 */
function isParticipantProfileComplete(participantLike, userName, userEmail) {
  const nameOk = nameComplete(userName);
  const photoOk =
    typeof participantLike.profilePhotoUrl === "string" &&
    participantLike.profilePhotoUrl.trim().length > 2;
  const phoneOk =
    participantLike.phoneE164 &&
    /^\+[1-9]\d{6,14}$/.test(String(participantLike.phoneE164).trim());
  const emailOk = isValidEmail(userEmail);
  const genderOk =
    typeof participantLike.gender === "string" && ALLOWED_GENDERS.includes(participantLike.gender);
  const birthOk =
    participantLike.birthDate != null &&
    !Number.isNaN(new Date(participantLike.birthDate).getTime());
  const countryOk =
    typeof participantLike.country === "string" && participantLike.country.trim().length >= 2;
  const cityOk = typeof participantLike.city === "string" && participantLike.city.trim().length >= 2;
  return nameOk && photoOk && phoneOk && emailOk && genderOk && birthOk && countryOk && cityOk;
}

/** Profil quizmaster : nom, photo, téléphone, email, genre, naissance (pas pays/ville). */
function isQuizmasterProfileComplete(qmLike, userName, userEmail) {
  const nameOk = nameComplete(userName);
  const photoOk =
    typeof qmLike.profilePhotoUrl === "string" &&
    qmLike.profilePhotoUrl.trim().length > 2;
  const phoneOk =
    qmLike.phoneE164 && /^\+[1-9]\d{6,14}$/.test(String(qmLike.phoneE164).trim());
  const emailOk = isValidEmail(userEmail);
  const genderOk =
    typeof qmLike.gender === "string" && ALLOWED_GENDERS.includes(qmLike.gender);
  const birthOk =
    qmLike.birthDate != null && !Number.isNaN(new Date(qmLike.birthDate).getTime());
  return nameOk && photoOk && phoneOk && emailOk && genderOk && birthOk;
}

function parseBirthDate(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(Date.UTC(y, mo - 1, d));
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

module.exports = {
  ALLOWED_GENDERS,
  isParticipantProfileComplete,
  isQuizmasterProfileComplete,
  isValidEmail,
  parseBirthDate,
};
