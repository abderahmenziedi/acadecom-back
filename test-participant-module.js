/**
 * test-participant-module.js — Tests automatisés pour le module Participant complet
 * Usage: node test-participant-module.js
 */
const BASE = "http://localhost:3000";
let ADMIN_TOKEN = "";
let BRAND_TOKEN = "";
let QM_TOKEN = "";
let P1_TOKEN = "";
let P2_TOKEN = "";
let P1_ID = null;
let BRAND_ID = null;
let QM_ID = null;
let QUIZ_ID = null;
let QUIZ2_ID = null;
let Q1_ID = null;
let Q2_ID = null;
let ATTEMPT_ID = null;
let ATTEMPT2_ID = null;
let passed = 0;
let failed = 0;

async function req(method, path, body, expectStatus, token) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    const ok = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
    if (ok) passed++; else failed++;
    console.log(`${ok ? "✅" : "❌"} [${res.status}] ${method} ${path} ${ok ? "" : `(expected ${expectStatus})`}`);
    if (!ok) console.log("   ", JSON.stringify(data).substring(0, 300));
    return { status: res.status, data };
}

async function run() {
    console.log("══════════════════════════════════════════════════════");
    console.log(" 🧪 AcademCom — Tests Module Participant Complet");
    console.log("══════════════════════════════════════════════════════\n");

    // ══════════════════════════════════════════════════════
    // SETUP
    // ══════════════════════════════════════════════════════
    console.log("── 🔧 Setup ──");

    // Admin
    await req("POST", "/api/v1/auth/register", {
        email: "part_test_admin@test.com", password: "Admin12345", role: "admin"
    }, [201, 409]);
    const aLogin = await req("POST", "/api/v1/auth/login", {
        email: "part_test_admin@test.com", password: "Admin12345"
    }, 200);
    ADMIN_TOKEN = aLogin.data?.data?.token;

    // Brand
    const brandRes = await req("POST", "/api/v1/admin/brands", {
        name: "PartTestBrand", email: "part_test_brand@test.com", password: "Brand12345"
    }, 201, ADMIN_TOKEN);
    BRAND_ID = brandRes.data?.data?.brand?.id;
    const bLogin = await req("POST", "/api/v1/auth/login", {
        email: "part_test_brand@test.com", password: "Brand12345"
    }, 200);
    BRAND_TOKEN = bLogin.data?.data?.token;

    // Quizmaster
    const qmRes = await req("POST", "/api/v1/admin/quizmasters", {
        name: "PartTestQM", email: "part_test_qm@test.com", password: "Qm12345678", brandId: BRAND_ID
    }, 201, ADMIN_TOKEN);
    QM_ID = qmRes.data?.data?.quizmaster?.id;
    const qmLogin = await req("POST", "/api/v1/auth/login", {
        email: "part_test_qm@test.com", password: "Qm12345678"
    }, 200);
    QM_TOKEN = qmLogin.data?.data?.token;

    // Participant 1
    await req("POST", "/api/v1/auth/register", {
        email: "participant1@test.com", password: "Part12345", role: "participant", name: "Participant One"
    }, [201, 409]);
    const p1Login = await req("POST", "/api/v1/auth/login", {
        email: "participant1@test.com", password: "Part12345"
    }, 200);
    P1_TOKEN = p1Login.data?.data?.token;
    P1_ID = p1Login.data?.data?.user?.id;

    // Participant 2
    await req("POST", "/api/v1/auth/register", {
        email: "participant2@test.com", password: "Part12345", role: "participant", name: "Participant Two"
    }, [201, 409]);
    const p2Login = await req("POST", "/api/v1/auth/login", {
        email: "participant2@test.com", password: "Part12345"
    }, 200);
    P2_TOKEN = p2Login.data?.data?.token;

    // Create Quiz with 2 questions
    const quizRes = await req("POST", "/api/v1/quizmaster/quizzes", {
        title: "Quiz Participant Test",
        description: "Quiz pour tester le module participant",
        pointsPerQuestion: 10,
    }, 201, QM_TOKEN);
    QUIZ_ID = quizRes.data?.data?.quiz?.id;

    const q1Res = await req("POST", `/api/v1/quizmaster/quizzes/${QUIZ_ID}/questions`, {
        text: "Capitale de la France ?", points: 10, order: 1,
        options: [
            { text: "Paris", isCorrect: true },
            { text: "Lyon", isCorrect: false },
        ],
    }, 201, QM_TOKEN);
    Q1_ID = q1Res.data?.data?.question?.id;

    const q2Res = await req("POST", `/api/v1/quizmaster/quizzes/${QUIZ_ID}/questions`, {
        text: "2 + 2 = ?", points: 10, order: 2,
        options: [
            { text: "3", isCorrect: false },
            { text: "4", isCorrect: true },
        ],
    }, 201, QM_TOKEN);
    Q2_ID = q2Res.data?.data?.question?.id;

    // Activate quiz
    await req("PUT", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, { isActive: true }, 200, QM_TOKEN);

    // Create second quiz (inactive, for edge cases)
    const quiz2Res = await req("POST", "/api/v1/quizmaster/quizzes", {
        title: "Quiz Inactive", description: "Pas encore activé",
    }, 201, QM_TOKEN);
    QUIZ2_ID = quiz2Res.data?.data?.quiz?.id;

    console.log(`   Quiz: ${QUIZ_ID}, Q1: ${Q1_ID}, Q2: ${Q2_ID}, Quiz2: ${QUIZ2_ID}`);
    console.log("");

    // ══════════════════════════════════════════════════════
    // 👤 PROFIL
    // ══════════════════════════════════════════════════════
    console.log("── 👤 Profil ──");

    // Get profile
    const profile = await req("GET", "/api/v1/participant/me", null, 200, P1_TOKEN);
    console.log(`   Name: ${profile.data?.data?.profile?.name}, Points: ${profile.data?.data?.profile?.totalPoints}`);

    // Update profile
    await req("PUT", "/api/v1/participant/me", { name: "Joueur Pro" }, 200, P1_TOKEN);

    // Update profile — validation error
    await req("PUT", "/api/v1/participant/me", {}, 400, P1_TOKEN);

    // Update profile — duplicate email
    await req("PUT", "/api/v1/participant/me", { email: "participant2@test.com" }, 409, P1_TOKEN);

    // Get stats (should be empty initially)
    const stats0 = await req("GET", "/api/v1/participant/stats", null, 200, P1_TOKEN);
    console.log(`   Stats — games: ${stats0.data?.data?.stats?.gamesPlayed}, points: ${stats0.data?.data?.stats?.totalPoints}`);

    console.log("");

    // ══════════════════════════════════════════════════════
    // 🎮 QUIZ DISPONIBLES
    // ══════════════════════════════════════════════════════
    console.log("── 🎮 Quiz Disponibles ──");

    const available = await req("GET", "/api/v1/participant/quizzes/available", null, 200, P1_TOKEN);
    console.log(`   Quizzes disponibles: ${available.data?.data?.total}`);

    // Search
    await req("GET", "/api/v1/participant/quizzes/available?search=Participant", null, 200, P1_TOKEN);

    console.log("");

    // ══════════════════════════════════════════════════════
    // 🎯 ANSWER ONE-BY-ONE FLOW
    // ══════════════════════════════════════════════════════
    console.log("── 🎯 Flow: Répondre Question par Question ──");

    // Start attempt
    const startRes = await req("POST", `/api/v1/participant/quizzes/${QUIZ_ID}/start`, null, 201, P1_TOKEN);
    ATTEMPT_ID = startRes.data?.data?.attempt?.id;
    const questions = startRes.data?.data?.questions || [];
    console.log(`   Attempt ID: ${ATTEMPT_ID}, Questions: ${questions.length}`);

    // Get option IDs
    const q1Opts = questions.find(q => q.id === Q1_ID)?.options || [];
    const q2Opts = questions.find(q => q.id === Q2_ID)?.options || [];
    const parisOpt = q1Opts.find(o => o.text === "Paris")?.id;
    const fourOpt = q2Opts.find(o => o.text === "4")?.id;
    const threeOpt = q2Opts.find(o => o.text === "3")?.id;

    // Answer Q1 correctly
    const ans1 = await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/answer`, {
        questionId: Q1_ID, optionId: parisOpt
    }, 201, P1_TOKEN);
    console.log(`   Q1 answer — correct: ${ans1.data?.data?.answer?.isCorrect}`);

    // Answer Q1 again (should fail — already answered)
    await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/answer`, {
        questionId: Q1_ID, optionId: parisOpt
    }, 409, P1_TOKEN);

    // Answer Q2 incorrectly
    const ans2 = await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/answer`, {
        questionId: Q2_ID, optionId: threeOpt
    }, 201, P1_TOKEN);
    console.log(`   Q2 answer — correct: ${ans2.data?.data?.answer?.isCorrect}`);

    // Invalid question
    await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/answer`, {
        questionId: 99999, optionId: parisOpt
    }, 400, P1_TOKEN);

    // Invalid option
    await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/answer`, {
        questionId: Q1_ID, optionId: 99999
    }, [400, 409], P1_TOKEN);

    // Get result before finish (should fail)
    await req("GET", `/api/v1/participant/attempts/${ATTEMPT_ID}/result`, null, 400, P1_TOKEN);

    // Finish attempt
    const finishRes = await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/finish`, null, 200, P1_TOKEN);
    const result = finishRes.data?.data?.result;
    console.log(`   Score: ${result?.score}/${result?.maxScore} (${result?.percentage}%), Duration: ${result?.duration}s, Points earned: ${result?.pointsEarned}`);

    // Finish again (should fail — already completed)
    await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/finish`, null, 409, P1_TOKEN);

    // Answer after finish (should fail)
    await req("POST", `/api/v1/participant/attempts/${ATTEMPT_ID}/answer`, {
        questionId: Q1_ID, optionId: parisOpt
    }, 409, P1_TOKEN);

    // Get result (now works)
    const resultRes = await req("GET", `/api/v1/participant/attempts/${ATTEMPT_ID}/result`, null, 200, P1_TOKEN);
    console.log(`   Result answers: ${resultRes.data?.data?.result?.answers?.length}`);

    // Duplicate active attempt prevention (start another while one is in progress)
    // The first attempt is finished, so starting a new one should work
    // But let's test: start and immediately try to start another
    const start2 = await req("POST", `/api/v1/participant/quizzes/${QUIZ_ID}/start`, null, 201, P1_TOKEN);
    ATTEMPT2_ID = start2.data?.data?.attempt?.id;

    // Try to start another while one is active
    await req("POST", `/api/v1/participant/quizzes/${QUIZ_ID}/start`, null, 409, P1_TOKEN);

    // Finish the second attempt (no answers submitted → score 0)
    const finish2 = await req("POST", `/api/v1/participant/attempts/${ATTEMPT2_ID}/finish`, null, 200, P1_TOKEN);
    console.log(`   Empty attempt score: ${finish2.data?.data?.result?.score}/${finish2.data?.data?.result?.maxScore}`);

    console.log("");

    // ══════════════════════════════════════════════════════
    // 📦 BATCH SUBMIT FLOW
    // ══════════════════════════════════════════════════════
    console.log("── 📦 Flow: Submit Batch (backward compat) ──");

    // P2 starts and submits all at once
    const p2Start = await req("POST", `/api/v1/participant/quizzes/${QUIZ_ID}/start`, null, 201, P2_TOKEN);
    const p2AttemptId = p2Start.data?.data?.attempt?.id;
    const p2Questions = p2Start.data?.data?.questions || [];
    const p2Paris = p2Questions.find(q => q.id === Q1_ID)?.options?.find(o => o.text === "Paris")?.id;
    const p2Four = p2Questions.find(q => q.id === Q2_ID)?.options?.find(o => o.text === "4")?.id;

    const batchRes = await req("POST", `/api/v1/participant/attempts/${p2AttemptId}/submit`, {
        answers: [
            { questionId: Q1_ID, optionId: p2Paris },
            { questionId: Q2_ID, optionId: p2Four },
        ],
    }, 200, P2_TOKEN);
    console.log(`   P2 batch score: ${batchRes.data?.data?.result?.score}/${batchRes.data?.data?.result?.maxScore} (${batchRes.data?.data?.result?.percentage}%)`);

    // Submit again → 409
    await req("POST", `/api/v1/participant/attempts/${p2AttemptId}/submit`, {
        answers: [{ questionId: Q1_ID, optionId: p2Paris }],
    }, 409, P2_TOKEN);

    // Invalid question in batch
    const p2Start2 = await req("POST", `/api/v1/participant/quizzes/${QUIZ_ID}/start`, null, 201, P2_TOKEN);
    const p2Attempt2 = p2Start2.data?.data?.attempt?.id;
    await req("POST", `/api/v1/participant/attempts/${p2Attempt2}/submit`, {
        answers: [{ questionId: 99999, optionId: p2Paris }],
    }, 400, P2_TOKEN);

    // Finish the failed attempt to clean up
    await req("POST", `/api/v1/participant/attempts/${p2Attempt2}/finish`, null, 200, P2_TOKEN);

    console.log("");

    // ══════════════════════════════════════════════════════
    // 📊 HISTORIQUE
    // ══════════════════════════════════════════════════════
    console.log("── 📊 Historique ──");

    // P1 attempts history
    const historyRes = await req("GET", "/api/v1/participant/attempts", null, 200, P1_TOKEN);
    console.log(`   P1 completed attempts: ${historyRes.data?.data?.total}`);

    // Attempt detail
    await req("GET", `/api/v1/participant/attempts/${ATTEMPT_ID}`, null, 200, P1_TOKEN);

    // Attempt detail — wrong user → 403
    await req("GET", `/api/v1/participant/attempts/${ATTEMPT_ID}`, null, 403, P2_TOKEN);

    // Non-existent attempt → 404
    await req("GET", "/api/v1/participant/attempts/99999", null, 404, P1_TOKEN);

    console.log("");

    // ══════════════════════════════════════════════════════
    // 💰 WALLET / POINTS
    // ══════════════════════════════════════════════════════
    console.log("── 💰 Wallet & Points ──");

    // Wallet
    const wallet = await req("GET", "/api/v1/participant/wallet", null, 200, P1_TOKEN);
    console.log(`   P1 wallet — total: ${wallet.data?.data?.wallet?.totalPoints}, earned: ${wallet.data?.data?.wallet?.pointsEarned}, redeemed: ${wallet.data?.data?.wallet?.pointsRedeemed}`);

    // Points history
    const pts = await req("GET", "/api/v1/participant/points-history", null, 200, P1_TOKEN);
    console.log(`   P1 points history entries: ${pts.data?.data?.total}`);

    // Stats after playing
    const stats1 = await req("GET", "/api/v1/participant/stats", null, 200, P1_TOKEN);
    console.log(`   P1 stats — games: ${stats1.data?.data?.stats?.gamesPlayed}, rank: ${stats1.data?.data?.stats?.rank}, avgScore: ${stats1.data?.data?.stats?.averageScore}`);

    console.log("");

    // ══════════════════════════════════════════════════════
    // 🏆 LEADERBOARD
    // ══════════════════════════════════════════════════════
    console.log("── 🏆 Leaderboard ──");

    // Global
    const globalLb = await req("GET", "/api/v1/leaderboard/global", null, 200, P1_TOKEN);
    console.log(`   Global leaderboard entries: ${globalLb.data?.data?.total}`);

    // Quiz-specific
    const quizLb = await req("GET", `/api/v1/leaderboard/quiz/${QUIZ_ID}`, null, 200, P1_TOKEN);
    console.log(`   Quiz leaderboard entries: ${quizLb.data?.data?.total}`);
    if (quizLb.data?.data?.leaderboard?.[0]) {
        const top = quizLb.data.data.leaderboard[0];
        console.log(`   #1: ${top.name} — ${top.score}/${top.maxScore} (${top.percentage}%)`);
    }

    // Non-existent quiz → 404
    await req("GET", "/api/v1/leaderboard/quiz/99999", null, 404, P1_TOKEN);

    // Leaderboard accessible from other roles (admin)
    await req("GET", "/api/v1/leaderboard/global", null, 200, ADMIN_TOKEN);

    // Leaderboard accessible from QM
    await req("GET", `/api/v1/leaderboard/quiz/${QUIZ_ID}`, null, 200, QM_TOKEN);

    console.log("");

    // ══════════════════════════════════════════════════════
    // 🎯 RECOMMANDATIONS
    // ══════════════════════════════════════════════════════
    console.log("── 🎯 Recommandations ──");

    const recsRes = await req("GET", "/api/v1/participant/recommendations", null, 200, P1_TOKEN);
    console.log(`   Recommended quizzes: ${recsRes.data?.data?.recommendations?.length}`);

    console.log("");

    // ══════════════════════════════════════════════════════
    // 🔒 SÉCURITÉ
    // ══════════════════════════════════════════════════════
    console.log("── 🔒 Sécurité ──");

    // No token → 401
    await req("GET", "/api/v1/participant/me", null, 401);
    await req("GET", "/api/v1/participant/stats", null, 401);
    await req("GET", "/api/v1/participant/wallet", null, 401);

    // Wrong role → 403
    await req("GET", "/api/v1/participant/me", null, 403, QM_TOKEN);
    await req("GET", "/api/v1/participant/me", null, 403, BRAND_TOKEN);
    await req("GET", "/api/v1/participant/stats", null, 403, ADMIN_TOKEN);
    await req("POST", `/api/v1/participant/quizzes/${QUIZ_ID}/start`, null, 403, QM_TOKEN);

    // Cross-user access → 403
    await req("GET", `/api/v1/participant/attempts/${ATTEMPT_ID}/result`, null, 403, P2_TOKEN);

    // Start inactive quiz → 400
    await req("POST", `/api/v1/participant/quizzes/${QUIZ2_ID}/start`, null, 400, P1_TOKEN);

    // Non-existent quiz → 404
    await req("POST", "/api/v1/participant/quizzes/99999/start", null, 404, P1_TOKEN);

    console.log("");

    // ══════════════════════════════════════════════════════
    // 🗑️ CLEANUP
    // ══════════════════════════════════════════════════════
    console.log("── 🗑️ Cleanup ──");

    // Deactivate and delete quizzes
    await req("PUT", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, { isActive: false }, 200, QM_TOKEN);
    await req("DELETE", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, null, 200, QM_TOKEN);
    await req("DELETE", `/api/v1/quizmaster/quizzes/${QUIZ2_ID}`, null, 200, QM_TOKEN);

    // Delete QM, brand
    await req("DELETE", `/api/v1/admin/quizmasters/${QM_ID}`, null, 200, ADMIN_TOKEN);
    await req("DELETE", `/api/v1/admin/brands/${BRAND_ID}`, null, 200, ADMIN_TOKEN);

    // ── Summary ───────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════════");
    console.log(` 📊 Résultats: ${passed} passés, ${failed} échoués sur ${passed + failed} tests`);
    console.log("══════════════════════════════════════════════════════");
}

run().catch(console.error);
