/**
 * test-all.js — Script de test automatisé pour Brands & Quizmasters
 * Usage: node test-all.js
 */
const BASE = "http://localhost:3000";
let TOKEN = "";
let BRAND_ID = null;
let QM_ID = null;
let passed = 0;
let failed = 0;

async function req(method, path, body, expectStatus) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (TOKEN) opts.headers["Authorization"] = `Bearer ${TOKEN}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    const ok = res.status === expectStatus;
    if (ok) passed++;
    else failed++;
    console.log(`${ok ? "✅" : "❌"} [${res.status}] ${method} ${path} ${ok ? "" : `(expected ${expectStatus})`}`);
    if (!ok) console.log("   ", JSON.stringify(data));
    return { status: res.status, data };
}

async function run() {
    console.log("══════════════════════════════════════════════════");
    console.log(" 🧪 AcademCom — Tests Brands & Quizmasters");
    console.log("══════════════════════════════════════════════════\n");

    // ── Auth ──────────────────────────────────────────────
    console.log("── 🔐 Auth ──");
    await req("POST", "/api/v1/auth/register", {
        email: "testadmin_auto2@test.com", password: "Admin12345", role: "admin"
    }, 201);

    const login = await req("POST", "/api/v1/auth/login", {
        email: "testadmin_auto2@test.com", password: "Admin12345"
    }, 200);
    TOKEN = login.data?.data?.token;
    if (!TOKEN) { console.log("❌ Impossible de récupérer le token. Arrêt."); return; }
    console.log("   🔑 Token obtenu\n");

    // ── Brands ────────────────────────────────────────────
    console.log("── 🏢 Brands ──");

    // Create
    const cr = await req("POST", "/api/v1/admin/brands", {
        name: "TestBrand", email: "testbrand2@auto.com", password: "Brand12345"
    }, 201);
    BRAND_ID = cr.data?.data?.brand?.id;
    console.log(`   Brand ID: ${BRAND_ID}`);

    // Create duplicate email
    await req("POST", "/api/v1/admin/brands", {
        name: "TestBrand2", email: "testbrand2@auto.com", password: "Brand12345"
    }, 409);

    // Create validation error (name too short, missing password)
    await req("POST", "/api/v1/admin/brands", {
        name: "A", email: "bad-email"
    }, 400);

    // Get all
    await req("GET", "/api/v1/admin/brands?page=1&limit=10", null, 200);

    // Get by ID
    await req("GET", `/api/v1/admin/brands/${BRAND_ID}`, null, 200);

    // Get not found
    await req("GET", "/api/v1/admin/brands/99999", null, 404);

    // Update
    await req("PUT", `/api/v1/admin/brands/${BRAND_ID}`, {
        name: "TestBrand Updated"
    }, 200);

    // Update not found
    await req("PUT", "/api/v1/admin/brands/99999", { name: "NotFound" }, 404);

    console.log("");

    // ── Quizmasters ───────────────────────────────────────
    console.log("── 🧠 Quizmasters ──");

    // Create
    const qm = await req("POST", "/api/v1/admin/quizmasters", {
        name: "TestQM", email: "testqm2@auto.com", password: "Quiz12345", brandId: BRAND_ID
    }, 201);
    QM_ID = qm.data?.data?.quizmaster?.id;
    console.log(`   Quizmaster ID: ${QM_ID}`);

    // Create missing brandId
    await req("POST", "/api/v1/admin/quizmasters", {
        name: "TestQM2", email: "testqm2b@auto.com", password: "Quiz12345"
    }, 400);

    // Create invalid brandId
    await req("POST", "/api/v1/admin/quizmasters", {
        name: "TestQM3", email: "testqm3b@auto.com", password: "Quiz12345", brandId: 99999
    }, 404);

    // Create duplicate email
    await req("POST", "/api/v1/admin/quizmasters", {
        name: "TestQM4", email: "testqm2@auto.com", password: "Quiz12345", brandId: BRAND_ID
    }, 409);

    // Get all
    await req("GET", "/api/v1/admin/quizmasters?page=1&limit=10", null, 200);

    // Get filtered by brandId
    await req("GET", `/api/v1/admin/quizmasters?brandId=${BRAND_ID}&page=1&limit=10`, null, 200);

    // Get by ID
    await req("GET", `/api/v1/admin/quizmasters/${QM_ID}`, null, 200);

    // Get not found
    await req("GET", "/api/v1/admin/quizmasters/99999", null, 404);

    // Update
    await req("PUT", `/api/v1/admin/quizmasters/${QM_ID}`, {
        name: "TestQM Updated"
    }, 200);

    // Update not found
    await req("PUT", "/api/v1/admin/quizmasters/99999", { name: "NotFound" }, 404);

    console.log("");

    // ── Delete order ──────────────────────────────────────
    console.log("── 🗑️ Delete Tests ──");

    // Try delete brand with quizmasters (should fail)
    await req("DELETE", `/api/v1/admin/brands/${BRAND_ID}`, null, 409);

    // Delete quizmaster first
    await req("DELETE", `/api/v1/admin/quizmasters/${QM_ID}`, null, 200);

    // Delete quizmaster not found
    await req("DELETE", `/api/v1/admin/quizmasters/${QM_ID}`, null, 404);

    // Now delete brand (should work)
    await req("DELETE", `/api/v1/admin/brands/${BRAND_ID}`, null, 200);

    // Delete brand not found
    await req("DELETE", `/api/v1/admin/brands/${BRAND_ID}`, null, 404);

    console.log("");

    // ── Auth errors ───────────────────────────────────────
    console.log("── 🔒 Auth Error Tests ──");

    // No token
    const savedToken = TOKEN;
    TOKEN = "";
    await req("GET", "/api/v1/admin/brands", null, 401);
    await req("GET", "/api/v1/admin/quizmasters", null, 401);

    // Non-admin token: register a participant and login
    TOKEN = "";
    await req("POST", "/api/v1/auth/register", {
        email: "participant_auto2@test.com", password: "Part12345", role: "participant"
    }, 201);
    const pLogin = await req("POST", "/api/v1/auth/login", {
        email: "participant_auto2@test.com", password: "Part12345"
    }, 200);
    TOKEN = pLogin.data?.data?.token;

    await req("GET", "/api/v1/admin/brands", null, 403);
    await req("GET", "/api/v1/admin/quizmasters", null, 403);

    TOKEN = savedToken;

    // ── Summary ───────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════");
    console.log(` 📊 Résultats: ${passed} passés, ${failed} échoués sur ${passed + failed} tests`);
    console.log("══════════════════════════════════════════════════");

    // Cleanup: delete test users
    try {
        TOKEN = savedToken;
    } catch(e) {}
}

run().catch(console.error);
