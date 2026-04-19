import { createMockLogger, createMockContext, createMockNakama, testStorage } from '../../__mocks__/nakama';
import { Runtime } from '../../types/nakama';

jest.mock('../../utils/circuitBreaker', () => ({
  withCircuitBreaker: jest.fn((_name: string, fn: () => any) => fn()),
  createCircuitBreaker: jest.fn(),
  getCircuitBreaker: jest.fn(),
  resetAllCircuits: jest.fn(),
}));

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  getMetrics: jest.fn(),
  getAllMetrics: jest.fn(),
};

jest.mock('../../utils/cache', () => ({
  getCacheManager: jest.fn(() => mockCache),
  resetCacheManager: jest.fn(),
}));

import {
  rpcGetCurrency,
  rpcSpendGems,
  validatedReceipts,
} from '../store';

describe('Purchase flow integration', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;
  const originalEnv = process.env;

  beforeEach(() => {
    testStorage.clear();
    validatedReceipts.clear();
    mockCache.get.mockReturnValue(undefined);
    mockCache.set.mockClear();
    mockCache.delete.mockClear();

    process.env = { ...originalEnv, REVENUECAT_SECRET_KEY: 'test-api-key' };
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should reflect gem balance after spend', () => {
    // Seed currency
    const currency = { gems: 500, gold: 1000 };
    testStorage.set('player_currency:test-user', JSON.stringify(currency));

    mockNk.storageRead = jest.fn((objects: any[]) => {
      return objects
        .map((obj: any) => {
          const key = `${obj.collection}:${obj.key}`;
          const val = testStorage.get(key);
          if (!val) return null;
          return { collection: obj.collection, key: obj.key, value: val };
        })
        .filter(Boolean);
    });

    mockNk.storageWrite = jest.fn((objects: any[]) => {
      objects.forEach((obj: any) => {
        testStorage.set(`${obj.collection}:${obj.key}`, obj.value);
      });
    });

    // Verify initial balance
    const getResult = rpcGetCurrency(mockCtx, mockLogger, mockNk, JSON.stringify({}));
    const balance = JSON.parse(getResult);
    expect(balance.gems).toBe(500);

    // Spend 200 gems
    const spendResult = rpcSpendGems(
      mockCtx, mockLogger, mockNk,
      JSON.stringify({ amount: 200, reason: 'test_purchase' })
    );
    const spendParsed = JSON.parse(spendResult);
    expect(spendParsed.success).toBe(true);
    expect(spendParsed.new_balance).toBe(300);
    expect(spendParsed.amount_spent).toBe(200);
  });

  it('should prevent double-spending gems concurrently', () => {
    // Seed currency with exactly 100 gems
    const currency = { gems: 100, gold: 0 };
    testStorage.set('player_currency:test-user', JSON.stringify(currency));

    let callCount = 0;
    mockNk.storageRead = jest.fn((objects: any[]) => {
      return objects
        .map((obj: any) => {
          const key = `${obj.collection}:${obj.key}`;
          const val = testStorage.get(key);
          if (!val) return null;
          return { collection: obj.collection, key: obj.key, value: val };
        })
        .filter(Boolean);
    });

    mockNk.storageWrite = jest.fn((objects: any[]) => {
      objects.forEach((obj: any) => {
        testStorage.set(`${obj.collection}:${obj.key}`, obj.value);
      });
    });

    // First spend succeeds
    const result1 = rpcSpendGems(
      mockCtx, mockLogger, mockNk,
      JSON.stringify({ amount: 100, reason: 'first_purchase' })
    );
    const parsed1 = JSON.parse(result1);
    expect(parsed1.success).toBe(true);

    // Second spend should fail - insufficient gems
    const result2 = rpcSpendGems(
      mockCtx, mockLogger, mockNk,
      JSON.stringify({ amount: 100, reason: 'second_purchase' })
    );
    const parsed2 = JSON.parse(result2);
    expect(parsed2.error).toBe('Insufficient gems');
  });
});
