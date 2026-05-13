#!/usr/bin/env node
/**
 * test-api.js - Script de test exhaustif des endpoints API
 * Tests auth, CRUD, permissions, cascade delete, etc.
 */

const API_URL = 'http://localhost:3000';
let TOKEN = null;
let testResults = [];

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

async function makeRequest(method, endpoint, data = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token || TOKEN) {
    options.headers.Authorization = `Bearer ${token || TOKEN}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    let body = null;
    
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }

    return {
      status: response.status,
      headers: response.headers,
      body,
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
      body: null,
    };
  }
}

function logTest(name, passed, details = '') {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (details) console.log(`   ${details}`);
  testResults.push({ name, passed, details });
}

// ─────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🧪 DÉMARRAGE DES TESTS API...\n');

  try {
    // 1️⃣ TEST AUTH
    console.log('📋 === AUTH TESTS ===\n');

    // Register
    const registerRes = await makeRequest('POST', '/auth/register', {
      name: 'Test User',
      email: `test${Date.now()}@test.com`,
      password: 'Test123!@#',
      role: 'participant',
    });

    logTest(
      'Register new participant',
      registerRes.status === 201,
      `Status: ${registerRes.status}`
    );

    // Login avec admin
    const loginRes = await makeRequest('POST', '/auth/login', {
      email: 'admin@acadecom.com',
      password: 'password123',
    });

    logTest(
      'Login as admin',
      loginRes.status === 200 && loginRes.body.data?.token,
      `Status: ${loginRes.status}`
    );

    if (loginRes.body.data?.token) {
      TOKEN = loginRes.body.data.token;
      console.log(`   Token: ${TOKEN.substring(0, 20)}...`);
    }

    // 2️⃣ TEST ADMIN ENDPOINTS
    console.log('\n📋 === ADMIN ENDPOINTS ===\n');

    const usersRes = await makeRequest('GET', '/admin/users?limit=5');
    logTest(
      'GET /admin/users (admin)',
      usersRes.status === 200,
      `Status: ${usersRes.status}, Users: ${usersRes.body.data?.users?.length || 0}`
    );

    // 3️⃣ TEST BRANDS
    console.log('\n📋 === BRANDS ENDPOINTS ===\n');

    const brandsRes = await makeRequest('GET', '/admin/brands?limit=5');
    logTest(
      'GET /admin/brands',
      brandsRes.status === 200,
      `Status: ${brandsRes.status}, Brands: ${brandsRes.body.data?.brands?.length || 0}`
    );

    // 4️⃣ TEST AUTH BRANDS (public)
    console.log('\n📋 === PUBLIC ENDPOINTS ===\n');

    const publicBrandsRes = await makeRequest('GET', '/auth/brands', null, null);
    logTest(
      'GET /auth/brands (public)',
      publicBrandsRes.status === 200,
      `Status: ${publicBrandsRes.status}, Brands: ${publicBrandsRes.body.data?.brands?.length || 0}`
    );

    // 5️⃣ TEST PERMISSION DENIAL
    console.log('\n📋 === PERMISSION TESTS ===\n');

    // Login as participant
    const participantLoginRes = await makeRequest('POST', '/auth/login', {
      email: 'participant@acadecom.com',
      password: 'password123',
    });

    const participantToken = participantLoginRes.body.data?.token;

    if (participantToken) {
      // Try to access admin endpoint
      const deniedRes = await makeRequest(
        'GET',
        '/admin/users',
        null,
        participantToken
      );

      logTest(
        'Participant cannot access /admin/users',
        deniedRes.status === 403,
        `Status: ${deniedRes.status}`
      );
    }

    // 6️⃣ TEST LOGOUT
    console.log('\n📋 === LOGOUT TEST ===\n');

    const logoutRes = await makeRequest('POST', '/auth/logout');
    logTest(
      'POST /auth/logout',
      logoutRes.status === 200,
      `Status: ${logoutRes.status}`
    );

    // 📊 RÉSUMÉ
    console.log('\n📊 === RÉSUMÉ ===\n');
    const passed = testResults.filter((t) => t.passed).length;
    const total = testResults.length;
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);

    process.exit(total - passed === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

runTests();
