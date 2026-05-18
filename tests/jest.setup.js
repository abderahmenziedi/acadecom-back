/**
 * jest.setup.js — sets env vars so the app boots inside the Jest worker.
 *
 * Runs *before* any test file imports `src/...`. Tests that need to mock
 * Prisma call `jest.mock('../../src/config/prisma', ...)` from their own
 * file — see `tests/helpers/prismaMock.js`.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-which-is-definitely-long-enough';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://test:test@localhost:3306/acadecom_test';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
process.env.PORT = '0';
process.env.LOG_LEVEL = 'error';
