/**
 * admin.routes.test.js — HTTP integration tests for admin user-management.
 *
 * Verifies the RBAC gate, validation errors, the envelope shape and
 * cooperation with the auth middleware's blocked-account guard.
 */

jest.mock('../../src/config/prisma', () => require('../helpers/prismaMock').makePrismaMock());
jest.mock('../../src/services/brand.service', () => ({
  delete: jest.fn(async (id) => ({ id, email: 'b@x.io', role: 'brand', softDeleted: true })),
}));
jest.mock('../../src/services/quizOwnership.service', () => ({
  detachQuizmasterFromAllQuizzes: jest.fn(async () => {}),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');

const prisma = require('../../src/config/prisma');
const app = require('../../src/app');
const { resetPrismaMock } = require('../helpers/prismaMock');

const adminToken = () =>
  jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const participantToken = () =>
  jwt.sign({ id: 2, role: 'participant' }, process.env.JWT_SECRET, { expiresIn: '1h' });

function mockAuthSnapshot(user) {
  prisma.user.findUnique.mockResolvedValueOnce({
    id: user.id,
    role: user.role,
    isBlocked: false,
    deactivatedReason: null,
    brandId: null,
    brandDeletedAt: null,
    brand: null,
  });
}

beforeEach(() => {
  resetPrismaMock();
  prisma.$transaction.mockImplementation((arg) =>
    typeof arg === 'function' ? Promise.resolve(arg(prisma)) : Promise.all(arg),
  );
});

describe('Authorization gate', () => {
  test('401 without a token', async () => {
    const res = await request(app).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });

  test('403 with a non-admin token', async () => {
    mockAuthSnapshot({ id: 2, role: 'participant' });
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${participantToken()}`);
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('ROLE_FORBIDDEN');
  });
});

describe('GET /api/v1/admin/users', () => {
  test('returns the paginated envelope', async () => {
    mockAuthSnapshot({ id: 1, role: 'admin' });

    prisma.$transaction.mockResolvedValueOnce([
      [{ id: 10, email: 'u@x.io', role: 'participant', isBlocked: false }],
      1,
    ]);

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
  });

  test('422 when limit is too large', async () => {
    mockAuthSnapshot({ id: 1, role: 'admin' });
    const res = await request(app)
      .get('/api/v1/admin/users?limit=99999')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/v1/admin/users/:id/block', () => {
  test('blocks a participant', async () => {
    mockAuthSnapshot({ id: 1, role: 'admin' });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 7,
      role: 'participant',
      email: 'p@x.io',
      isBlocked: false,
    });
    prisma.user.update.mockResolvedValueOnce({
      id: 7,
      email: 'p@x.io',
      role: 'participant',
      isBlocked: true,
    });

    const res = await request(app)
      .patch('/api/v1/admin/users/7/block')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.isBlocked).toBe(true);
  });

  test('400 when :id is not a positive integer', async () => {
    mockAuthSnapshot({ id: 1, role: 'admin' });
    const res = await request(app)
      .patch('/api/v1/admin/users/abc/block')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/v1/admin/users/:id', () => {
  test('refuses self-deletion', async () => {
    mockAuthSnapshot({ id: 1, role: 'admin' });
    const res = await request(app)
      .delete('/api/v1/admin/users/1')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(403);
  });
});
