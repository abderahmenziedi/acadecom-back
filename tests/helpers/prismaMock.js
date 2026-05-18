/**
 * prismaMock.js — shared helper that returns a fresh deep-mock PrismaClient
 * proxy whose method signatures match the real client.
 *
 * Each test file mocks the Prisma module like this:
 *
 *   jest.mock('../../src/config/prisma', () => require('../helpers/prismaMock').makePrismaMock());
 *
 * The deep mock will return `undefined` for every method by default; tests
 * call `prisma.user.findUnique.mockResolvedValue(...)` to set up scenarios.
 */

const { mockDeep, mockReset } = require('jest-mock-extended');

/**
 * Build a singleton deep-mock for the lifetime of the test file.
 * Re-exposed via `getPrismaMock` so individual tests can introspect calls.
 */
function makePrismaMock() {
  const prismaMock = mockDeep();

  // $transaction(array) -> resolve all promises in the array.
  // $transaction(callback) -> run the callback with the same mock client.
  prismaMock.$transaction.mockImplementation((arg) => {
    if (typeof arg === 'function') return Promise.resolve(arg(prismaMock));
    return Promise.all(arg);
  });

  globalThis.__prismaMock = prismaMock;
  return prismaMock;
}

function getPrismaMock() {
  if (!globalThis.__prismaMock) throw new Error('Prisma mock not initialised yet');
  return globalThis.__prismaMock;
}

function resetPrismaMock() {
  if (globalThis.__prismaMock) mockReset(globalThis.__prismaMock);
}

module.exports = { makePrismaMock, getPrismaMock, resetPrismaMock };
