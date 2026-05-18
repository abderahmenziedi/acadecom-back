/**
 * admin.service.test.js — unit tests for the AdminService.
 *
 * Focuses on the role-guards (self-block, admin-vs-admin), the soft archive
 * vs. hard delete dispatch, and the transactional cleanup for participants.
 */

jest.mock('../../src/config/prisma', () => require('../helpers/prismaMock').makePrismaMock());

// BrandService.delete is exercised through admin.deleteUser('brand'). Mock it so
// we don't reach the real implementation.
jest.mock('../../src/services/brand.service', () => ({
  delete: jest.fn(async (id) => ({ id, email: 'brand@x.io', role: 'brand', softDeleted: true })),
}));

// Same for the orphan-quiz cleanup helper.
jest.mock('../../src/services/quizOwnership.service', () => ({
  detachQuizmasterFromAllQuizzes: jest.fn(async () => {}),
}));

const prisma = require('../../src/config/prisma');
const AdminService = require('../../src/services/admin.service');
const BrandService = require('../../src/services/brand.service');
const { resetPrismaMock } = require('../helpers/prismaMock');

beforeEach(() => {
  resetPrismaMock();
  prisma.$transaction.mockImplementation((arg) =>
    typeof arg === 'function' ? Promise.resolve(arg(prisma)) : Promise.all(arg),
  );
  BrandService.delete.mockClear();
});

describe('AdminService.blockUser', () => {
  test('refuses to block self', async () => {
    await expect(AdminService.blockUser(5, 5)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('refuses to block other admins', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 2,
      role: 'admin',
      email: 'a@x.io',
      isBlocked: false,
    });
    await expect(AdminService.blockUser(2, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('refuses to re-block an already-blocked user', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 7,
      role: 'participant',
      email: 'p@x.io',
      isBlocked: true,
    });
    await expect(AdminService.blockUser(7, 1)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('blocks a participant and clears deactivatedReason', async () => {
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

    const user = await AdminService.blockUser(7, 1);
    expect(user.isBlocked).toBe(true);

    const updateArg = prisma.user.update.mock.calls[0][0];
    expect(updateArg.data).toEqual({ isBlocked: true, deactivatedReason: null });
  });
});

describe('AdminService.unblockUser', () => {
  test('refuses to unblock self', async () => {
    await expect(AdminService.unblockUser(5, 5)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('refuses to reactivate an archived brand', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 9,
      role: 'brand',
      email: 'b@x.io',
      isBlocked: true,
      brandDeletedAt: new Date(),
    });
    await expect(AdminService.unblockUser(9, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('unblocks a previously blocked user', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 4,
      role: 'participant',
      email: 'p@x.io',
      isBlocked: true,
      brandDeletedAt: null,
    });
    prisma.user.update.mockResolvedValueOnce({
      id: 4,
      email: 'p@x.io',
      role: 'participant',
      isBlocked: false,
    });

    const user = await AdminService.unblockUser(4, 1);
    expect(user.isBlocked).toBe(false);
  });
});

describe('AdminService.deleteUser', () => {
  test('refuses to delete self', async () => {
    await expect(AdminService.deleteUser(1, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('refuses to delete other admins', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 2, role: 'admin', email: 'a@x.io' });
    await expect(AdminService.deleteUser(2, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('delegates brand deletion to BrandService (soft-archive)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 7, role: 'brand', email: 'b@x.io' });

    const result = await AdminService.deleteUser(7, 1);
    expect(BrandService.delete).toHaveBeenCalledWith(7);
    expect(result.softDeleted).toBe(true);
  });

  test('participant deletion runs all cleanup in a single transaction', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 5, role: 'participant', email: 'p@x.io' });
    prisma.attempt.findMany.mockResolvedValueOnce([{ id: 11 }, { id: 12 }]);
    prisma.user.delete.mockResolvedValueOnce({
      id: 5,
      email: 'p@x.io',
      role: 'participant',
      createdAt: new Date(),
    });

    const result = await AdminService.deleteUser(5, 1);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 5 } }));
    expect(result.email).toBe('p@x.io');
  });

  test('quizmaster deletion detaches their quizzes and deactivates them', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 9, role: 'quizmaster', email: 'qm@x.io' });
    prisma.quiz.findMany.mockResolvedValueOnce([{ id: 100 }, { id: 101 }]);
    prisma.user.delete.mockResolvedValueOnce({
      id: 9,
      email: 'qm@x.io',
      role: 'quizmaster',
      createdAt: new Date(),
    });

    const result = await AdminService.deleteUser(9, 1);

    expect(prisma.quiz.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [100, 101] } },
      data: { isActive: false },
    });
    expect(result.quizzesTransferredToBrand).toBe(true);
  });
});
