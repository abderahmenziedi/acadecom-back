/**
 * test-quiz-module.js — Script de test automatisé pour le Quiz Master Module
 * Usage: node test-quiz-module.js
 */
const BASE = "http://localhost:3000";
let ADMIN_TOKEN = "";
let QM_TOKEN = "";
let PARTICIPANT_TOKEN = "";
let BRAND_ID = null;
let QM_USER_ID = null;
let QUIZ_ID = null;
let QUESTION_ID = null;
let OPTION_IDS = [];
let ATTEMPT_ID = null;
let passed = 0;
let failed = 0;

async function req(method, path, body, expectStatus, token) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    const ok = res.status === expectStatus;
    if (ok) passed++;
    else failed++;
    console.log(`${ok ? "✅" : "❌"} [${res.status}] ${method} ${path} ${ok ? "" : `(expected ${expectStatus})`}`);
    if (!ok) console.log("   ", JSON.stringify(data).substring(0, 200));
    return { status: res.status, data };
}

async function run() {
    console.log("══════════════════════════════════════════════════");
    console.log(" 🧪 AcademCom — Tests Quiz Master Module");
    console.log("══════════════════════════════════════════════════\n");

    // ── Setup: Create users ─────────────────────────────────
    console.log("── 🔧 Setup ──");

    // Admin
    await req("POST", "/api/v1/auth/register", {
        email: "qm_test_admin2@test.com", password: "Admin12345", role: "admin"
    }, 201);
    const adminLogin = await req("POST", "/api/v1/auth/login", {
        email: "qm_test_admin2@test.com", password: "Admin12345"
    }, 200);
    ADMIN_TOKEN = adminLogin.data?.data?.token;

    // Brand (via admin)
    const brandRes = await req("POST", "/api/v1/admin/brands", {
        name: "QuizBrand", email: "quizbrand2@test.com", password: "Brand12345"
    }, 201, ADMIN_TOKEN);
    BRAND_ID = brandRes.data?.data?.brand?.id;
    console.log(`   Brand ID: ${BRAND_ID}`);

    // Quizmaster (via admin)
    const qmRes = await req("POST", "/api/v1/admin/quizmasters", {
        name: "TestQM", email: "testqm_module2@test.com", password: "Qm12345678", brandId: BRAND_ID
    }, 201, ADMIN_TOKEN);
    QM_USER_ID = qmRes.data?.data?.quizmaster?.id;
    console.log(`   Quizmaster ID: ${QM_USER_ID}`);

    // Login quizmaster
    const qmLogin = await req("POST", "/api/v1/auth/login", {
        email: "testqm_module2@test.com", password: "Qm12345678"
    }, 200);
    QM_TOKEN = qmLogin.data?.data?.token;
    console.log(`   QM Token: ${QM_TOKEN ? "OK" : "MISSING"}`);

    // Participant
    await req("POST", "/api/v1/auth/register", {
        email: "participant_qm2@test.com", password: "Part12345", role: "participant"
    }, 201);
    const partLogin = await req("POST", "/api/v1/auth/login", {
        email: "participant_qm2@test.com", password: "Part12345"
    }, 200);
    PARTICIPANT_TOKEN = partLogin.data?.data?.token;
    console.log("");

    // ── Quiz CRUD ─────────────────────────────────────────
    console.log("── 📝 Quiz CRUD ──");

    // Create quiz
    const quizRes = await req("POST", "/api/v1/quizmaster/quizzes", {
        title: "Test Quiz Module",
        description: "Un quiz de test automatisé",
        timeLimit: 300,
        pointsPerQuestion: 10,
        shuffleQuestions: false,
    }, 201, QM_TOKEN);
    QUIZ_ID = quizRes.data?.data?.quiz?.id;
    console.log(`   Quiz ID: ${QUIZ_ID}`);

    // Create quiz — validation error
    await req("POST", "/api/v1/quizmaster/quizzes", {
        title: "AB",
    }, 400, QM_TOKEN);

    // Get all quizzes
    await req("GET", "/api/v1/quizmaster/quizzes?page=1&limit=10", null, 200, QM_TOKEN);

    // Get quiz by ID
    await req("GET", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, null, 200, QM_TOKEN);

    // Get quiz not found
    await req("GET", "/api/v1/quizmaster/quizzes/99999", null, 404, QM_TOKEN);

    // Update quiz
    await req("PUT", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, {
        title: "Quiz Updated",
        description: "Description mise à jour",
    }, 200, QM_TOKEN);

    // No token → 401
    await req("GET", "/api/v1/quizmaster/quizzes", null, 401);

    // Participant token → 403
    await req("GET", "/api/v1/quizmaster/quizzes", null, 403, PARTICIPANT_TOKEN);

    console.log("");

    // ── Questions CRUD ────────────────────────────────────
    console.log("── ❓ Questions CRUD ──");

    // Add question with options
    const q1Res = await req("POST", `/api/v1/quizmaster/quizzes/${QUIZ_ID}/questions`, {
        text: "Quelle est la capitale de la France ?",
        points: 10,
        order: 1,
        options: [
            { text: "Londres", isCorrect: false },
            { text: "Paris", isCorrect: true },
            { text: "Berlin", isCorrect: false },
            { text: "Madrid", isCorrect: false },
        ],
    }, 201, QM_TOKEN);
    QUESTION_ID = q1Res.data?.data?.question?.id;
    OPTION_IDS = q1Res.data?.data?.question?.options?.map(o => o.id) || [];
    console.log(`   Question ID: ${QUESTION_ID}, Options: [${OPTION_IDS}]`);

    // Add second question
    const q2Res = await req("POST", `/api/v1/quizmaster/quizzes/${QUIZ_ID}/questions`, {
        text: "2+2 = ?",
        points: 5,
        order: 2,
        options: [
            { text: "3", isCorrect: false },
            { text: "4", isCorrect: true },
            { text: "5", isCorrect: false },
        ],
    }, 201, QM_TOKEN);
    const Q2_ID = q2Res.data?.data?.question?.id;
    const Q2_OPTIONS = q2Res.data?.data?.question?.options?.map(o => o.id) || [];

    // Create question — validation (no correct answer)
    await req("POST", `/api/v1/quizmaster/quizzes/${QUIZ_ID}/questions`, {
        text: "Question sans bonne réponse ?",
        options: [
            { text: "A", isCorrect: false },
            { text: "B", isCorrect: false },
        ],
    }, 400, QM_TOKEN);

    // Create question — validation (only 1 option)
    await req("POST", `/api/v1/quizmaster/quizzes/${QUIZ_ID}/questions`, {
        text: "Une seule option ?",
        options: [{ text: "Seul", isCorrect: true }],
    }, 400, QM_TOKEN);

    // Update question
    await req("PUT", `/api/v1/quizmaster/questions/${QUESTION_ID}`, {
        text: "Quelle est la capitale de la France ? (modifié)",
        points: 15,
    }, 200, QM_TOKEN);

    // Update question with new options
    await req("PUT", `/api/v1/quizmaster/questions/${QUESTION_ID}`, {
        options: [
            { text: "Paris", isCorrect: true },
            { text: "Lyon", isCorrect: false },
            { text: "Marseille", isCorrect: false },
        ],
    }, 200, QM_TOKEN);

    // Get quiz detail to see updated questions
    const quizDetail = await req("GET", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, null, 200, QM_TOKEN);
    // Update option IDs after replacement
    const updatedQ = quizDetail.data?.data?.quiz?.questions?.find(q => q.id === QUESTION_ID);
    if (updatedQ) {
        OPTION_IDS = updatedQ.options.map(o => o.id);
        console.log(`   Updated Option IDs for Q1: [${OPTION_IDS}]`);
    }

    console.log("");

    // ── Quiz Activation ────────────────────────────────────
    console.log("── 🔄 Quiz Activation ──");

    // Activate quiz
    await req("PUT", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, {
        isActive: true,
    }, 200, QM_TOKEN);

    // Try modify active quiz (should fail)
    await req("PUT", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, {
        title: "Should Fail",
    }, 400, QM_TOKEN);

    // Try add question to active quiz (should fail)
    await req("POST", `/api/v1/quizmaster/quizzes/${QUIZ_ID}/questions`, {
        text: "New question on active quiz?",
        options: [
            { text: "Yes", isCorrect: true },
            { text: "No", isCorrect: false },
        ],
    }, 400, QM_TOKEN);

    // Try delete active quiz (should fail)
    await req("DELETE", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, null, 400, QM_TOKEN);

    console.log("");

    // ── Participant: Quiz Execution ────────────────────────
    console.log("── 🎮 Quiz Execution (Participant) ──");

    // Start attempt
    const attemptRes = await req("POST", `/api/v1/participant/quizzes/${QUIZ_ID}/start`, null, 201, PARTICIPANT_TOKEN);
    ATTEMPT_ID = attemptRes.data?.data?.attempt?.id;
    console.log(`   Attempt ID: ${ATTEMPT_ID}`);

    // Get the actual question/option IDs from the attempt response
    const attemptQuestions = attemptRes.data?.data?.questions || [];
    const correctOptionQ1 = OPTION_IDS[0]; // Paris (first option after update)
    const q2FromAttempt = attemptQuestions.find(q => q.id === Q2_ID);
    const correctOptionQ2 = q2FromAttempt?.options?.find(o => o.text === "4")?.id || Q2_OPTIONS[1];

    // Submit answers
    const submitRes = await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/submit`, {
        answers: [
            { questionId: QUESTION_ID, optionId: correctOptionQ1 },
            { questionId: Q2_ID, optionId: correctOptionQ2 },
        ],
    }, 200, PARTICIPANT_TOKEN);
    console.log(`   Score: ${submitRes.data?.data?.result?.score}/${submitRes.data?.data?.result?.maxScore} (${submitRes.data?.data?.result?.percentage}%)`);

    // Try submit again (should fail — already submitted)
    await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/submit`, {
        answers: [
            { questionId: QUESTION_ID, optionId: correctOptionQ1 },
        ],
    }, 409, PARTICIPANT_TOKEN);

    // Try start on inactive quiz (deactivate first)
    // But first we need a second quiz that's inactive
    const quiz2 = await req("POST", "/api/v1/quizmaster/quizzes", {
        title: "Inactive Quiz", description: "Not activated",
    }, 201, QM_TOKEN);
    const QUIZ2_ID = quiz2.data?.data?.quiz?.id;
    await req("POST", `/api/v1/participant/quizzes/${QUIZ2_ID}/start`, null, 400, PARTICIPANT_TOKEN);

    console.log("");

    // ── Analytics ──────────────────────────────────────────
    console.log("── 📊 Analytics ──");

    // Quiz analytics
    await req("GET", `/api/v1/quizmaster/quizzes/${QUIZ_ID}/analytics`, null, 200, QM_TOKEN);

    // Dashboard
    await req("GET", "/api/v1/quizmaster/dashboard", null, 200, QM_TOKEN);

    // Analytics not found
    await req("GET", "/api/v1/quizmaster/quizzes/99999/analytics", null, 404, QM_TOKEN);

    console.log("");

    // ── Cleanup: Deactivate and delete ────────────────────
    console.log("── 🗑️ Cleanup ──");

    // Deactivate quiz
    await req("PUT", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, { isActive: false }, 200, QM_TOKEN);

    // Delete question
    await req("DELETE", `/api/v1/quizmaster/questions/${QUESTION_ID}`, null, 200, QM_TOKEN);

    // Delete quiz (has attempts, cascade should work)
    await req("DELETE", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, null, 200, QM_TOKEN);

    // Delete quiz not found
    await req("DELETE", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, null, 404, QM_TOKEN);

    // Delete inactive quiz 2
    await req("DELETE", `/api/v1/quizmaster/quizzes/${QUIZ2_ID}`, null, 200, QM_TOKEN);

    // ── Summary ───────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════");
    console.log(` 📊 Résultats: ${passed} passés, ${failed} échoués sur ${passed + failed} tests`);
    console.log("══════════════════════════════════════════════════");
}

run().catch(console.error);
