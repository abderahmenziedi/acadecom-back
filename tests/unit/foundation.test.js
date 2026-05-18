/**
 * foundation.test.js — sanity checks for the cross-cutting utilities.
 */

const ApiError = require('../../src/utils/ApiError');
const { parsePagination, paginatedPayload } = require('../../src/utils/pagination');
const { ok, created, envelope } = require('../../src/utils/responder');

describe('ApiError factories', () => {
  test('produces operational errors with sensible defaults', () => {
    const err = ApiError.badRequest();
    expect(err.statusCode).toBe(400);
    expect(err.status).toBe('fail');
    expect(err.isOperational).toBe(true);
  });

  test('internal() defaults to non-operational', () => {
    const err = ApiError.internal();
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(false);
  });

  test('details + code propagate', () => {
    const err = ApiError.unprocessable('bad', { code: 'VALIDATION_ERROR', details: [{ field: 'x' }] });
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual([{ field: 'x' }]);
  });
});

describe('parsePagination', () => {
  test('applies defaults and clamps the limit', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(parsePagination({ page: '2', limit: '5' })).toEqual({ page: 2, limit: 5, skip: 5 });
    expect(parsePagination({ page: '0', limit: '99999' })).toEqual({
      page: 1,
      limit: 100,
      skip: 0,
    });
  });
});

describe('paginatedPayload', () => {
  test('computes totalPages correctly', () => {
    const payload = paginatedPayload({ items: [{}], total: 25, page: 3, limit: 10 });
    expect(payload.totalPages).toBe(3);
    expect(payload.items).toEqual([{}]);
  });
});

describe('responder', () => {
  test('envelope shape', () => {
    expect(envelope('hi', { x: 1 })).toEqual({
      success: true,
      status: 'success',
      message: 'hi',
      data: { x: 1 },
    });
  });

  test('ok / created delegate to res.status().json()', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    ok(res, { a: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      status: 'success',
      data: { a: 1 },
    });

    created(res, { a: 2 }, 'done');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenLastCalledWith({
      success: true,
      status: 'success',
      message: 'done',
      data: { a: 2 },
    });
  });
});
