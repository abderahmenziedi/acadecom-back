/**
 * test-brand-module.js — Tests automatisés pour le Brand Management Module
 * Usage: node test-brand-module.js
 */
const BASE = "http://localhost:3000";
let ADMIN_TOKEN = "";
let BRAND_TOKEN = "";
let BRAND_ID = null;
let QM_TOKEN = "";
let PARTICIPANT_TOKEN = "";
let QM_ID = null;
let QUIZ_ID = null;
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
    const ok = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
    if (ok) passed++;
    else failed++;
    console.log(`${ok ? "✅" : "❌"} [${res.status}] ${method} ${path} ${ok ? "" : `(expected ${expectStatus})`}`);
    if (!ok) console.log("   ", JSON.stringify(data).substring(0, 250));
    return { status: res.status, data };
}

async function run() {
    console.log("══════════════════════════════════════════════════════");
    console.log(" 🧪 AcademCom — Tests Brand Management Module");
    console.log("══════════════════════════════════════════════════════\n");

    // ── Setup ─────────────────────────────────────────────
    console.log("── 🔧 Setup ──");

    // Register admin (accept 409 if already exists)
    await req("POST", "/api/v1/auth/register", {
        email: "brand_mod_admin@test.com", password: "Admin12345", role: "admin"
    }, [201, 409]);
    const aLogin = await req("POST", "/api/v1/auth/login", {
        email: "brand_mod_admin@test.com", password: "Admin12345"
    }, 200);
    ADMIN_TOKEN = aLogin.data?.data?.token;

    // Register participant (accept 409 if already exists)
    await req("POST", "/api/v1/auth/register", {
        email: "brand_mod_part@test.com", password: "Part12345", role: "participant"
    }, [201, 409]);
    const pLogin = await req("POST", "/api/v1/auth/login", {
        email: "brand_mod_part@test.com", password: "Part12345"
    }, 200);
    PARTICIPANT_TOKEN = pLogin.data?.data?.token;
    console.log("");

    // ══════════════════════════════════════════════════════
    // ADMIN CRUD (enhanced)
    // ══════════════════════════════════════════════════════
    console.log("── 🏢 Admin Brand CRUD ──");

    // Create brand with new fields
    const brandRes = await req("POST", "/api/v1/admin/brands", {
        name: "BrandModule Co",
        email: "brandmod@test.com",
        password: "Brand12345",
        industry: "EdTech",
        description: "Plateforme éducative innovante",
    }, 201, ADMIN_TOKEN);
    BRAND_ID = brandRes.data?.data?.brand?.id;
    console.log(`   Brand ID: ${BRAND_ID}`);

    // Verify industry/description in response
    const hasIndustry = brandRes.data?.data?.brand?.industry === "EdTech";
    const hasDesc = brandRes.data?.data?.brand?.description === "Plateforme éducative innovante";
    console.log(`   industry: ${hasIndustry ? "✅" : "❌"}, description: ${hasDesc ? "✅" : "❌"}`);

    // Create brand without optional fields
    const brand2Res = await req("POST", "/api/v1/admin/brands", {
        name: "SimpleBrand",
        email: "simplebrand@test.com",
        password: "Brand12345",
    }, 201, ADMIN_TOKEN);
    const BRAND2_ID = brand2Res.data?.data?.brand?.id;

    // Get all brands
    await req("GET", "/api/v1/admin/brands?page=1&limit=10", null, 200, ADMIN_TOKEN);

    // Get all brands with search filter
    await req("GET", "/api/v1/admin/brands?search=BrandModule", null, 200, ADMIN_TOKEN);

    // Get all brands with industry filter
    await req("GET", "/api/v1/admin/brands?industry=EdTech", null, 200, ADMIN_TOKEN);

    // Get by ID
    await req("GET", `/api/v1/admin/brands/${BRAND_ID}`, null, 200, ADMIN_TOKEN);

    // Update brand with new fields
    await req("PUT", `/api/v1/admin/brands/${BRAND_ID}`, {
        industry: "FinTech",
        description: "Description mise à jour",
    }, 200, ADMIN_TOKEN);

    // Get 404
    await req("GET", "/api/v1/admin/brands/99999", null, 404, ADMIN_TOKEN);

    console.log("");

    // ── Login as brand ────────────────────────────────────
    console.log("── 🔑 Brand Login ──");
    const bLogin = await req("POST", "/api/v1/auth/login", {
        email: "brandmod@test.com", password: "Brand12345"
    }, 200);
    BRAND_TOKEN = bLogin.data?.data?.token;
    console.log(`   Brand Token: ${BRAND_TOKEN ? "OK" : "MISSING"}`);
    console.log("");

    // ══════════════════════════════════════════════════════
    // BRAND SELF-SERVICE
    // ══════════════════════════════════════════════════════
    console.log("── 👤 Brand Self-Service ──");

    // Get own profile
    await req("GET", "/api/v1/brand/me", null, 200, BRAND_TOKEN);

    // Update own profile (limited fields)
    await req("PUT", "/api/v1/brand/me", {
        name: "BrandModule Updated",
        industry: "HealthTech",
        description: "Nouvelle description du brand",
    }, 200, BRAND_TOKEN);

    // Update profile — validation error (empty body fails refine)
    await req("PUT", "/api/v1/brand/me", {}, 400, BRAND_TOKEN);

    // Get quizmasters (should be empty initially)
    const qmList = await req("GET", "/api/v1/brand/quizmasters", null, 200, BRAND_TOKEN);
    console.log(`   Quizmasters count: ${qmList.data?.data?.quizmasters?.length || 0}`);

    console.log("");

    // ── Create quizmaster under this brand ────────────────
    console.log("── 👨‍💻 Setup Quizmaster + Quiz ──");

    const qmRes = await req("POST", "/api/v1/admin/quizmasters", {
        name: "BrandQM", email: "brandqm@test.com", password: "Qm12345678", brandId: BRAND_ID
    }, 201, ADMIN_TOKEN);
    QM_ID = qmRes.data?.data?.quizmaster?.id;

    const qmLogin = await req("POST", "/api/v1/auth/login", {
        email: "brandqm@test.com", password: "Qm12345678"
    }, 200);
    QM_TOKEN = qmLogin.data?.data?.token;

    // QM creates a quiz
    const quizRes = await req("POST", "/api/v1/quizmaster/quizzes", {
        title: "Brand Quiz Test",
        description: "Quiz for brand analytics",
        pointsPerQuestion: 10,
    }, 201, QM_TOKEN);
    QUIZ_ID = quizRes.data?.data?.quiz?.id;

    // Add a question
    const q1 = await req("POST", `/api/v1/quizmaster/quizzes/${QUIZ_ID}/questions`, {
        text: "1+1=?", points: 10, order: 1,
        options: [
            { text: "2", isCorrect: true },
            { text: "3", isCorrect: false },
        ],
    }, 201, QM_TOKEN);

    // Activate quiz
    await req("PUT", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, { isActive: true }, 200, QM_TOKEN);

    // Participant takes the quiz
    const attemptRes = await req("POST", `/api/v1/participant/quizzes/${QUIZ_ID}/start`, null, 201, PARTICIPANT_TOKEN);
    const attemptId = attemptRes.data?.data?.attempt?.id;
    const correctOpt = attemptRes.data?.data?.questions?.[0]?.options?.find(o => o.text === "2")?.id;

    await req("POST", `/api/v1/participant/attempts/${attemptId}/submit`, {
        answers: [{ questionId: q1.data?.data?.question?.id, optionId: correctOpt }],
    }, 200, PARTICIPANT_TOKEN);

    console.log("");

    // ── Brand sees quizmasters after assignment ───────────
    console.log("── 👨‍💻 Brand Quizmasters (after assignment) ──");

    const qmList2 = await req("GET", "/api/v1/brand/quizmasters", null, 200, BRAND_TOKEN);
    console.log(`   Quizmasters count: ${qmList2.data?.data?.quizmasters?.length || 0}`);

    console.log("");

    // ══════════════════════════════════════════════════════
    // BRAND ANALYTICS
    // ══════════════════════════════════════════════════════
    console.log("── 📊 Brand Analytics ──");

    // Brand analytics by ID (as admin)
    const analyticsRes = await req("GET", `/api/v1/brand/${BRAND_ID}/analytics`, null, 200, ADMIN_TOKEN);
    const an = analyticsRes.data?.data?.analytics;
    if (an) {
        console.log(`   QMs: ${an.totalQuizmasters}, Quizzes: ${an.totalQuizzes}, Attempts: ${an.totalAttempts}, Participants: ${an.totalParticipants}, Avg: ${an.averageScorePercentage}%`);
    }

    // Brand analytics by ID (as brand — own data)
    await req("GET", `/api/v1/brand/${BRAND_ID}/analytics`, null, 200, BRAND_TOKEN);

    // Brand analytics — access denied (brand trying to see another brand)
    await req("GET", `/api/v1/brand/${BRAND2_ID}/analytics`, null, 403, BRAND_TOKEN);

    // Brand dashboard
    const dashRes = await req("GET", "/api/v1/brand/dashboard", null, 200, BRAND_TOKEN);
    const dash = dashRes.data?.data?.dashboard;
    if (dash) {
        console.log(`   Dashboard — QMs: ${dash.summary.totalQuizmasters}, Quizzes: ${dash.summary.totalQuizzes}, Attempts: ${dash.summary.totalAttempts}`);
    }

    // Brand analytics — 404 for non-existent brand
    await req("GET", "/api/v1/brand/99999/analytics", null, 404, ADMIN_TOKEN);

    console.log("");

    // ══════════════════════════════════════════════════════
    // SECURITY TESTS
    // ══════════════════════════════════════════════════════
    console.log("── 🔒 Security Tests ──");

    // No token → 401
    await req("GET", "/api/v1/brand/me", null, 401);
    await req("GET", "/api/v1/brand/dashboard", null, 401);

    // Participant cannot access brand routes → 403
    await req("GET", "/api/v1/brand/me", null, 403, PARTICIPANT_TOKEN);
    await req("GET", "/api/v1/brand/dashboard", null, 403, PARTICIPANT_TOKEN);
    await req("GET", "/api/v1/brand/quizmasters", null, 403, PARTICIPANT_TOKEN);

    // Quizmaster cannot access brand self-service → 403
    await req("GET", "/api/v1/brand/me", null, 403, QM_TOKEN);

    // Participant cannot access admin brand routes → 403
    await req("GET", "/api/v1/admin/brands", null, 403, PARTICIPANT_TOKEN);

    console.log("");

    // ── Cleanup ───────────────────────────────────────────
    console.log("── 🗑️ Cleanup ──");

    // Deactivate quiz first
    await req("PUT", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, { isActive: false }, 200, QM_TOKEN);
    await req("DELETE", `/api/v1/quizmaster/quizzes/${QUIZ_ID}`, null, 200, QM_TOKEN);

    // Delete QM, then brands
    await req("DELETE", `/api/v1/admin/quizmasters/${QM_ID}`, null, 200, ADMIN_TOKEN);
    await req("DELETE", `/api/v1/admin/brands/${BRAND_ID}`, null, 200, ADMIN_TOKEN);
    await req("DELETE", `/api/v1/admin/brands/${BRAND2_ID}`, null, 200, ADMIN_TOKEN);

    // ── Summary ───────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════════");
    console.log(` 📊 Résultats: ${passed} passés, ${failed} échoués sur ${passed + failed} tests`);
    console.log("══════════════════════════════════════════════════════");
}

run().catch(console.error);
