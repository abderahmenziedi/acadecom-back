/**
 * participant.routes.test.js — HTTP integration tests for the participant flow.
 *
 * Verifies routing, validation, RBAC, and the canonical envelope. The full
 * gamification path is exercised by the service unit tests; this file
 * focuses on the HTTP boundary.
 */

jest.mock('../../src/config/prisma', () => require('../helpers/prismaMock').makePrismaMock());
jest.mock('../../src/services/gamification.service', () => ({
  processQuizCompletion: jest.fn(async () => ({
    xpEarned: 0,
    couponsEarned: 0,
    passed: false,
  })),
}));
jest.mock('../../src/services/notification.service', () => ({
  notifyParticipantQuizPlayed: jest.fn(async () => null),
  notifyQuizPlayed: jest.fn(async () => null),
  notifyQuizStatsMilestone: jest.fn(async () => null),
}));
jest.mock('../../src/services/activityLog.service', () => ({
  log: jest.fn(async () => null),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');

const prisma = require('../../src/config/prisma');
const app = require('../../src/app');
const { resetPrismaMock } = require('../helpers/prismaMock');

const participantToken = () =>
  jwt.sign({ id: 5, role: 'participant' }, process.env.JWT_SECRET, { expiresIn: '1h' });

function mockAuthSnapshot(role = 'participant') {
  prisma.user.findUnique.mockResolvedValueOnce({
    id: 5,
    role,
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

describe('GET /api/v1/participant/quizzes/available', () => {
  test('returns the paginated catalog', async () => {
    mockAuthSnapshot();
    prisma.$transaction.mockResolvedValueOnce([[{ id: 1, title: 'Q1' }], 1]);

    const res = await request(app)
      .get('/api/v1/participant/quizzes/available')
      .set('Authorization', `Bearer ${participantToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ items: expect.any(Array), total: 1, page: 1 }),
    );
  });
});

describe('POST /api/v1/participant/quizzes/:quizId/start', () => {
  test('happy path returns the attempt + questions', async () => {
    mockAuthSnapshot();
    prisma.quiz.findUnique.mockResolvedValueOnce({
      id: 1,
      isActive: true,
      title: 'Q',
      description: '',
      timeLimit: 60,
      shuffleQuestions: false,
      couponReward: 0,
      questions: [{ id: 1, text: 'Q1', points: 5, options: [{ id: 10, text: 'a' }] }],
    });
    prisma.attempt.findFirst.mockResolvedValueOnce(null);
    prisma.attempt.create.mockResolvedValueOnce({
      id: 1,
      quizId: 1,
      maxScore: 5,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/participant/quizzes/1/start')
      .set('Authorization', `Bearer ${participantToken()}`);

    expect(res.status).toBe(201);
    expect(res.body.data.attempt.id).toBe(1);
    expect(res.body.data.questions).toHaveLength(1);
  });

  test('422 when :quizId is not numeric', async () => {
    mockAuthSnapshot();
    const res = await request(app)
      .post('/api/v1/participant/quizzes/foo/start')
      .set('Authorization', `Bearer ${participantToken()}`);
    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/participant/attempts/:attemptId/submit', () => {
  test('422 when answers payload is missing', async () => {
    mockAuthSnapshot();
    const res = await request(app)
      .post('/api/v1/participant/attempts/1/submit')
      .set('Authorization', `Bearer ${participantToken()}`)
      .send({});
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/participant/me', () => {
  test('returns participant profile', async () => {
    mockAuthSnapshot();
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 5,
      name: 'Sara',
      email: 'sara@x.io',
      role: 'participant',
      xp: 50,
      coupons: 3,
      createdAt: new Date(),
    });

    const res = await request(app)
      .get('/api/v1/participant/me')
      .set('Authorization', `Bearer ${participantToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profile.email).toBe('sara@x.io');
  });
});
