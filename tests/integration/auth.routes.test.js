/**
 * auth.routes.test.js — HTTP integration tests for the auth module.
 *
 * Uses supertest against the Express app with a mocked Prisma client. Verifies
 * the response envelope, validation errors, and JWT round-trip.
 */

jest.mock('../../src/config/prisma', () => require('../helpers/prismaMock').makePrismaMock());

const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = require('../../src/config/prisma');
const app = require('../../src/app');
const { resetPrismaMock } = require('../helpers/prismaMock');

beforeEach(() => {
  resetPrismaMock();
  prisma.$transaction.mockImplementation((arg) =>
    typeof arg === 'function' ? Promise.resolve(arg(prisma)) : Promise.all(arg),
  );
});

describe('POST /api/v1/auth/register', () => {
  test('422 when fields are missing', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({});
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  test('201 returns the user without password', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({
      id: 1,
      name: 'Yasmine',
      email: 'yasmine@test.io',
      role: 'participant',
      createdAt: new Date(),
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Yasmine',
      email: 'yasmine@test.io',
      password: 'supersecret',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  test('409 on duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1 });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Xander', email: 'x@x.io', password: 'supersecret' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/v1/auth/login', () => {
  test('401 with uniform message on bad credentials', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@x.io', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Identifiants invalides');
  });

  test('200 returns JWT + user; JWT is verifiable', async () => {
    const password = 'supersecret';
    const hashed = await bcrypt.hash(password, 4);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 9,
      name: 'Sara',
      email: 'sara@x.io',
      password: hashed,
      role: 'participant',
      isBlocked: false,
      brandId: null,
      brandDeletedAt: null,
      deactivatedReason: null,
      avatar: null,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'sara@x.io', password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { token, user } = res.body.data;
    expect(user.id).toBe(9);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(9);
  });
});

describe('GET /api/v1/auth/brands', () => {
  test('returns active brands', async () => {
    prisma.user.findMany.mockResolvedValueOnce([{ id: 1, name: 'Acme', industry: 'Tech' }]);
    const res = await request(app).get('/api/v1/auth/brands');
    expect(res.status).toBe(200);
    expect(res.body.data.brands).toEqual([{ id: 1, name: 'Acme', industry: 'Tech' }]);
  });
});

describe('GET /api/v1/auth/me', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('TOKEN_MISSING');
  });

  test('200 with a valid token returns the safe user', async () => {
    const token = jwt.sign({ id: 7, role: 'participant' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    const safeUser = {
      id: 7,
      name: 'Lina',
      email: 'lina@x.io',
      role: 'participant',
      isBlocked: false,
      brandId: null,
      brand: null,
    };
    // First call: auth middleware status snapshot.
    prisma.user.findUnique.mockResolvedValueOnce({ ...safeUser });
    // Second call: AuthService.me -> UserRepository.findById.
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 7,
      name: 'Lina',
      email: 'lina@x.io',
      role: 'participant',
      isBlocked: false,
      brandId: null,
      avatar: null,
      xp: 0,
      coupons: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('lina@x.io');
  });

  test('403 with code ACCOUNT_REVOKED when user is blocked', async () => {
    const token = jwt.sign({ id: 4, role: 'participant' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 4,
      role: 'participant',
      isBlocked: true,
      deactivatedReason: 'Spam',
      brandId: null,
      brand: null,
    });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('ACCOUNT_REVOKED');
  });
});
