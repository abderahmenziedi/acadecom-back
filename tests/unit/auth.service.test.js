/**
 * auth.service.test.js — unit tests for the AuthService.
 *
 * Strategy: deep-mock the Prisma client so we exercise pure business logic
 * (role rules, password hashing, JWT issuance) without spinning up MySQL.
 */

jest.mock('../../src/config/prisma', () => require('../helpers/prismaMock').makePrismaMock());

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = require('../../src/config/prisma');
const AuthService = require('../../src/services/auth.service');
const { resetPrismaMock } = require('../helpers/prismaMock');

beforeEach(() => {
  resetPrismaMock();
  // $transaction is re-installed by resetPrismaMock — wire it back to its array shape.
  prisma.$transaction.mockImplementation((arg) =>
    typeof arg === 'function' ? Promise.resolve(arg(prisma)) : Promise.all(arg),
  );
});

describe('AuthService.register', () => {
  test('creates a participant with a hashed password', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // emailExists()
    prisma.user.create.mockResolvedValueOnce({
      id: 42,
      name: 'Yasmine',
      email: 'yasmine@test.io',
      role: 'participant',
      isBlocked: false,
      brandId: null,
      avatar: null,
      xp: 0,
      coupons: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const user = await AuthService.register({
      name: 'Yasmine',
      email: 'yasmine@test.io',
      password: 'supersecret',
    });

    expect(user.email).toBe('yasmine@test.io');
    expect(user).not.toHaveProperty('password');

    const createArg = prisma.user.create.mock.calls[0][0].data;
    expect(createArg.role).toBe('participant');
    // bcrypt-hashed values look like $2b$10$...
    expect(createArg.password).toMatch(/^\$2[aby]\$/);
  });

  test('rejects duplicate emails with 409', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1 });

    await expect(
      AuthService.register({ name: 'X', email: 'x@x.io', password: 'supersecret' }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('quizmaster without brandId is rejected', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      AuthService.register({
        name: 'QM',
        email: 'qm@x.io',
        password: 'supersecret',
        role: 'quizmaster',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('quizmaster pointing at non-brand user is rejected', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // email lookup
      .mockResolvedValueOnce({ id: 9, role: 'participant' }); // brand lookup

    await expect(
      AuthService.register({
        name: 'QM',
        email: 'qm@x.io',
        password: 'supersecret',
        role: 'quizmaster',
        brandId: 9,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('quizmaster pointing at blocked brand is rejected', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 7, role: 'brand', isBlocked: true });

    await expect(
      AuthService.register({
        name: 'QM',
        email: 'qm@x.io',
        password: 'supersecret',
        role: 'quizmaster',
        brandId: 7,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('AuthService.login', () => {
  test('returns a valid JWT + safe user on success', async () => {
    const password = 'supersecret';
    const hashed = await bcrypt.hash(password, 4);

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 12,
      name: 'Anis',
      email: 'anis@a.io',
      password: hashed,
      role: 'participant',
      avatar: null,
      isBlocked: false,
      brandId: null,
      brandDeletedAt: null,
      deactivatedReason: null,
    });

    const result = await AuthService.login({ email: 'anis@a.io', password });

    expect(result.user).toMatchObject({ id: 12, email: 'anis@a.io', role: 'participant' });
    expect(result.user).not.toHaveProperty('password');
    expect(result.token).toEqual(expect.any(String));

    const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
    expect(decoded).toMatchObject({ id: 12, role: 'participant' });
  });

  test('returns a uniform 401 for unknown email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      AuthService.login({ email: 'ghost@x.io', password: 'nope' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Identifiants invalides' });
  });

  test('returns a uniform 401 for wrong password', async () => {
    const hashed = await bcrypt.hash('right-password', 4);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: 'u@x.io',
      password: hashed,
      role: 'participant',
      isBlocked: false,
    });
    await expect(
      AuthService.login({ email: 'u@x.io', password: 'wrong-password' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Identifiants invalides' });
  });

  test('blocked account is rejected with code ACCOUNT_REVOKED', async () => {
    const hashed = await bcrypt.hash('p', 4);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: 'u@x.io',
      password: hashed,
      role: 'participant',
      isBlocked: true,
      deactivatedReason: 'Spam',
    });
    await expect(
      AuthService.login({ email: 'u@x.io', password: 'p' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_REVOKED' });
  });

  test('archived brand is rejected with code BRAND_REMOVED', async () => {
    const hashed = await bcrypt.hash('p', 4);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 5,
      email: 'b@x.io',
      password: hashed,
      role: 'brand',
      isBlocked: true,
      brandDeletedAt: new Date(),
    });
    await expect(
      AuthService.login({ email: 'b@x.io', password: 'p' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'BRAND_REMOVED' });
  });

  test('quizmaster whose parent brand is gone gets ACCOUNT_REVOKED', async () => {
    const hashed = await bcrypt.hash('p', 4);
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 10,
        email: 'qm@x.io',
        password: hashed,
        role: 'quizmaster',
        isBlocked: false,
        brandId: 3,
      })
      .mockResolvedValueOnce({ id: 3, isBlocked: true });

    await expect(
      AuthService.login({ email: 'qm@x.io', password: 'p' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_REVOKED' });
  });
});

describe('AuthService.listPublicBrands', () => {
  test('returns active brands sorted by name', async () => {
    prisma.user.findMany.mockResolvedValueOnce([{ id: 1, name: 'Acme', industry: 'Tech' }]);
    const brands = await AuthService.listPublicBrands();
    expect(brands).toEqual([{ id: 1, name: 'Acme', industry: 'Tech' }]);

    const filter = prisma.user.findMany.mock.calls[0][0];
    expect(filter.where).toMatchObject({ role: 'brand', isBlocked: false, brandDeletedAt: null });
    expect(filter.orderBy).toEqual({ name: 'asc' });
  });
});
