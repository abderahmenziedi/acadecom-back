const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");
const {
  ALLOWED_GENDERS,
  isQuizmasterProfileComplete,
  parseBirthDate,
  isValidEmail,
} = require("../utils/participantProfileComplete");
const { normalizePhoneE164 } = require("../utils/normalizePhone");

function mapQuizmasterProfileResponse(row) {
  const u = row.user;
  return {
    userId: u.id,
    quizmasterId: row.id,
    brandId: row.brandId,
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
    isProfileComplete: row.isProfileComplete,
  };
}

async function getQuizmasterProfile(userId) {
  const row = await prisma.quizmaster.findUnique({
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
    },
  });
  if (!row) throw new ApiError(404, "Profil introuvable");
  return mapQuizmasterProfileResponse(row);
}

async function updateQuizmasterProfile(userId, rawBody, uploadedRelativePath) {
  const quizmasterRow = await prisma.quizmaster.findUnique({
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
    },
  });
  if (!quizmasterRow) throw new ApiError(404, "Profil introuvable");

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
    if (e !== quizmasterRow.user.email) {
      const clash = await prisma.user.findUnique({ where: { email: e }, select: { id: true } });
      if (clash && clash.id !== userId) throw new ApiError(409, "Cet email est déjà utilisé");
    }
  }

  let phoneE164 = quizmasterRow.phoneE164;
  if (body.phoneE164 != null && String(body.phoneE164).trim() !== "") {
    const normalized = normalizePhoneE164(body.phoneE164);
    if (!normalized) {
      throw new ApiError(400, "Numéro de téléphone invalide (format international requis, ex : +21612345678).");
    }
    phoneE164 = normalized;
  }

  let gender = quizmasterRow.gender;
  if (body.gender !== undefined && body.gender !== null && String(body.gender).trim() !== "") {
    const g = String(body.gender);
    if (!ALLOWED_GENDERS.includes(g)) {
      throw new ApiError(400, `Genre invalide (${ALLOWED_GENDERS.join(", ")})`);
    }
    gender = g;
  }

  let birthDate = quizmasterRow.birthDate;
  if (body.birthDate !== undefined && body.birthDate !== null && String(body.birthDate).trim() !== "") {
    const parsed = parseBirthDate(body.birthDate);
    if (!parsed) throw new ApiError(400, "Date de naissance invalide");
    birthDate = parsed;
  }

  let profilePhotoUrl = quizmasterRow.profilePhotoUrl;
  if (uploadedRelativePath) {
    profilePhotoUrl = uploadedRelativePath;
  }

  return prisma.$transaction(async (tx) => {
    if (Object.keys(userUpdates).length) {
      await tx.user.update({ where: { id: userId }, data: userUpdates });
    }

    const uFresh = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatar: true, role: true, isBlocked: true, createdAt: true },
    });

    const mergedQm = {
      profilePhotoUrl,
      phoneE164,
      gender,
      birthDate,
    };
    const nextComplete = isQuizmasterProfileComplete(mergedQm, uFresh.name, uFresh.email);

    const updatedRow = await tx.quizmaster.update({
      where: { userId },
      data: {
        phoneE164,
        gender,
        birthDate,
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
      },
    });

    return mapQuizmasterProfileResponse(updatedRow);
  });
}

module.exports = {
  getQuizmasterProfile,
  updateQuizmasterProfile,
};
