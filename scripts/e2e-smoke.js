/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const BASE = process.env.API_BASE_URL || "http://localhost:3000/api/v1";
const PASSWORD = process.env.E2E_PASSWORD || "password123";

const CREDENTIALS = {
  admin: { email: "admin@acadecom.com", password: PASSWORD },
  brand: { email: "orange@brand.com", password: PASSWORD },
  quizmaster: { email: "luc@orange.com", password: PASSWORD },
  participant: { email: "ahmed@participant.com", password: PASSWORD },
};

const summary = {
  passed: 0,
  failed: 0,
  failures: [],
  warnings: [],
};

function logPass(name) {
  summary.passed += 1;
  console.log(`PASS ${name}`);
}

function logFail(name, err) {
  summary.failed += 1;
  const message = `${name}: ${err?.message || err}`;
  summary.failures.push(message);
  console.error(`FAIL ${message}`);
}

function warn(message) {
  summary.warnings.push(message);
  console.warn(`WARN ${message}`);
}

async function request(path, { method = "GET", token, body, expected } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (expected && !expected.includes(res.status)) {
    const msg =
      data?.message ||
      data?.error ||
      `Expected ${expected.join(",")} but got ${res.status}`;
    throw new Error(msg);
  }

  return { status: res.status, data };
}

async function login(roleKey) {
  const cred = CREDENTIALS[roleKey];
  const { status, data } = await request("/auth/login", {
    method: "POST",
    body: cred,
    expected: [200],
  });
  if (status !== 200 || !data?.data?.token) {
    throw new Error(`Login failed for ${roleKey}`);
  }
  return { token: data.data.token, user: data.data.user };
}

async function testAuthAndRbac(tokens) {
  await request("/auth/brands", { expected: [200] });
  logPass("Public auth brands endpoint");

  await request("/admin/users", {
    token: tokens.participant.token,
    expected: [403],
  });
  logPass("RBAC blocks participant from admin routes");

  await request("/quizmaster/quizzes", {
    token: tokens.brand.token,
    expected: [403],
  });
  logPass("RBAC blocks brand from quizmaster routes");

  await request("/participant/me", {
    token: tokens.admin.token,
    expected: [403],
  });
  logPass("RBAC blocks admin from participant routes");
}

async function testAdminEndpoints(adminToken) {
  const users = await request("/admin/users?page=1&limit=5", {
    token: adminToken,
    expected: [200],
  });
  if (!Array.isArray(users.data?.data?.users)) {
    throw new Error("Admin users payload malformed");
  }
  logPass("Admin users list");

  await request("/admin/users/export/csv", {
    token: adminToken,
    expected: [200],
  });
  logPass("Admin users CSV export");
}

async function testBrandEndpoints(brandToken, brandId) {
  await request("/brand/me", { token: brandToken, expected: [200] });
  logPass("Brand profile");

  await request("/brand/dashboard", { token: brandToken, expected: [200] });
  logPass("Brand dashboard");

  await request("/brand/stats", { token: brandToken, expected: [200] });
  logPass("Brand stats");

  await request("/brand/quizmasters", { token: brandToken, expected: [200] });
  logPass("Brand quizmasters list");

  await request("/brand/quizzes", { token: brandToken, expected: [200] });
  logPass("Brand quizzes list");

  await request("/brand/participants", { token: brandToken, expected: [200] });
  logPass("Brand participants list");

  await request("/brand/activity", { token: brandToken, expected: [200] });
  logPass("Brand activity feed");

  await request(`/brand/${brandId}/analytics`, {
    token: brandToken,
    expected: [200],
  });
  logPass("Brand analytics by id");
}

async function testQuizmasterFlow(quizmasterToken) {
  const create = await request("/quizmaster/quizzes", {
    method: "POST",
    token: quizmasterToken,
    expected: [201],
    body: {
      title: `E2E Smoke Quiz ${Date.now()}`,
      description: "Temporary quiz for end-to-end smoke validation",
      timeLimit: 120,
      pointsPerQuestion: 2,
      shuffleQuestions: false,
      category: "E2E",
      difficulty: "easy",
      couponReward: 1,
    },
  });
  const quizId = create.data?.data?.quiz?.id;
  if (!quizId) throw new Error("Quiz creation did not return an id");
  logPass("Quizmaster creates quiz");

  await request("/quizmaster/quizzes", {
    token: quizmasterToken,
    expected: [200],
  });
  logPass("Quizmaster lists own quizzes");

  const question = await request(`/quizmaster/quizzes/${quizId}/questions`, {
    method: "POST",
    token: quizmasterToken,
    expected: [201],
    body: {
      text: "2 + 2 = ?",
      points: 2,
      xpReward: 10,
      order: 1,
      options: [
        { text: "3", isCorrect: false },
        { text: "4", isCorrect: true },
      ],
    },
  });
  const questionId = question.data?.data?.question?.id;
  if (!questionId) throw new Error("Question creation did not return an id");
  logPass("Quizmaster adds question");

  await request(`/quizmaster/quizzes/${quizId}`, {
    token: quizmasterToken,
    expected: [200],
  });
  logPass("Quizmaster gets quiz details");

  await request(`/quizmaster/quizzes/${quizId}`, {
    method: "PUT",
    token: quizmasterToken,
    expected: [200],
    body: {
      title: `E2E Smoke Quiz Updated ${Date.now()}`,
      isActive: true,
      passingScore: 60,
    },
  });
  logPass("Quizmaster updates quiz");

  await request(`/quizmaster/quizzes/${quizId}/analytics`, {
    token: quizmasterToken,
    expected: [200],
  });
  logPass("Quizmaster quiz analytics");

  return quizId;
}

async function testParticipantFlow(participantToken) {
  const available = await request("/participant/quizzes/available?page=1&limit=10", {
    token: participantToken,
    expected: [200],
  });
  const quizzes = available.data?.data?.quizzes || [];
  if (!Array.isArray(quizzes) || quizzes.length === 0) {
    throw new Error("No available quizzes for participant");
  }
  const targetQuiz =
    quizzes.find((q) => q?.canStart === true && q?.participantStatus === "available") ||
    quizzes[0];
  if (!targetQuiz?.canStart) {
    throw new Error("No startable quiz available for participant");
  }
  logPass("Participant available quizzes");

  const start = await request(`/participant/quizzes/${targetQuiz.id}/start`, {
    method: "POST",
    token: participantToken,
    expected: [201, 200],
  });
  const attempt = start.data?.data?.attempt;
  if (!attempt?.id) throw new Error("Attempt id missing after start");
  logPass("Participant starts quiz attempt");

  const attemptQuestions = start.data?.data?.questions || [];
  const firstQuestion = attemptQuestions[0];
  if (!firstQuestion?.id || !Array.isArray(firstQuestion.options) || firstQuestion.options.length === 0) {
    throw new Error("Attempt payload missing questions/options");
  }
  const selectedOption = firstQuestion.options[0];

  await request(`/participant/attempts/${attempt.id}/answer`, {
    method: "POST",
    token: participantToken,
    expected: [200, 201],
    body: {
      questionId: firstQuestion.id,
      optionId: selectedOption.id,
    },
  });
  logPass("Participant answers one question");

  await request(`/participant/attempts/${attempt.id}/finish`, {
    method: "POST",
    token: participantToken,
    expected: [200],
  });
  logPass("Participant finishes attempt");

  await request(`/participant/attempts/${attempt.id}/result`, {
    token: participantToken,
    expected: [200],
  });
  logPass("Participant gets attempt result");

  await request("/participant/attempts?page=1&limit=5", {
    token: participantToken,
    expected: [200],
  });
  logPass("Participant attempts history");

  await request("/participant/stats", { token: participantToken, expected: [200] });
  logPass("Participant stats");

  await request("/participant/recommendations", {
    token: participantToken,
    expected: [200],
  });
  logPass("Participant recommendations");
}

async function testSharedModules(tokens) {
  for (const [role, auth] of Object.entries(tokens)) {
    await request("/notifications/unread-count", {
      token: auth.token,
      expected: [200],
    });
    logPass(`Notifications unread-count (${role})`);
  }

  await request("/notifications?limit=5", {
    token: tokens.participant.token,
    expected: [200],
  });
  logPass("Notifications list");

  await request("/profile/me", {
    token: tokens.participant.token,
    expected: [200],
  });
  logPass("Profile me");

  await request("/leaderboard/global?page=1&limit=10", {
    token: tokens.participant.token,
    expected: [200],
  });
  logPass("Leaderboard global");

  await request("/store/products?page=1&limit=6", {
    token: tokens.participant.token,
    expected: [200],
  });
  logPass("Store products");

  await request("/activity/me?page=1&limit=5", {
    token: tokens.participant.token,
    expected: [200],
  });
  logPass("Activity feed");
}

async function testDataIntegrity() {
  const orphanQuizmasters = await prisma.user.count({
    where: { role: "quizmaster", brandId: null, isBlocked: false },
  });
  if (orphanQuizmasters > 0) {
    throw new Error(`Found ${orphanQuizmasters} active quizmasters without brand`);
  }
  logPass("No active orphan quizmasters");

  const orphanQuizRows = await prisma.$queryRaw`
    SELECT q.id
    FROM quizzes q
    LEFT JOIN users u ON u.id = q.brandId
    WHERE u.id IS NULL
    LIMIT 1
  `;
  const orphanQuizzes = orphanQuizRows.length;
  if (orphanQuizzes > 0) {
    throw new Error(`Found ${orphanQuizzes} quizzes without brand`);
  }
  logPass("No quizzes without brand");

  const orphanAttemptRows = await prisma.$queryRaw`
    SELECT a.id
    FROM attempts a
    LEFT JOIN quizzes q ON q.id = a.quizId
    WHERE q.id IS NULL
    LIMIT 1
  `;
  const orphanAttempts = orphanAttemptRows.length;
  if (orphanAttempts > 0) {
    throw new Error(`Found ${orphanAttempts} attempts without quiz`);
  }
  logPass("No attempts without quiz");
}

async function main() {
  console.log(`Running API smoke suite against ${BASE}`);

  const tokens = {};
  for (const role of Object.keys(CREDENTIALS)) {
    try {
      tokens[role] = await login(role);
      logPass(`Login ${role}`);
    } catch (e) {
      logFail(`Login ${role}`, e);
    }
  }

  if (!tokens.admin || !tokens.brand || !tokens.quizmaster || !tokens.participant) {
    throw new Error("One or more required role logins failed");
  }

  try {
    await testAuthAndRbac(tokens);
  } catch (e) {
    logFail("Auth & RBAC smoke", e);
  }

  try {
    await testAdminEndpoints(tokens.admin.token);
  } catch (e) {
    logFail("Admin endpoints", e);
  }

  try {
    await testBrandEndpoints(tokens.brand.token, tokens.brand.user.id);
  } catch (e) {
    logFail("Brand endpoints", e);
  }

  let createdQuizId = null;
  try {
    createdQuizId = await testQuizmasterFlow(tokens.quizmaster.token);
  } catch (e) {
    logFail("Quizmaster flow", e);
  }

  try {
    await testParticipantFlow(tokens.participant.token);
  } catch (e) {
    logFail("Participant flow", e);
  }

  try {
    await testSharedModules(tokens);
  } catch (e) {
    logFail("Shared modules", e);
  }

  try {
    await testDataIntegrity();
  } catch (e) {
    logFail("Data integrity", e);
  }

  if (createdQuizId) {
    try {
      await request(`/brand/quizzes/${createdQuizId}/disable`, {
        method: "POST",
        token: tokens.brand.token,
        expected: [200],
      });
      await request(`/quizmaster/quizzes/${createdQuizId}`, {
        method: "DELETE",
        token: tokens.quizmaster.token,
        expected: [200],
      });
      logPass("Cleanup created quiz");
    } catch (e) {
      warn(`Cleanup failed for created quiz ${createdQuizId}: ${e.message}`);
    }
  }

  try {
    await request("/auth/logout", {
      method: "POST",
      token: tokens.admin.token,
      expected: [200],
    });
    logPass("Logout endpoint");
  } catch (e) {
    logFail("Logout endpoint", e);
  }

  console.log("\n==== E2E Smoke Summary ====");
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  if (summary.warnings.length) {
    console.log("Warnings:");
    summary.warnings.forEach((w) => console.log(` - ${w}`));
  }
  if (summary.failures.length) {
    console.log("Failures:");
    summary.failures.forEach((f) => console.log(` - ${f}`));
  }

  await prisma.$disconnect();
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Fatal smoke error:", e);
  await prisma.$disconnect();
  process.exit(1);
});
