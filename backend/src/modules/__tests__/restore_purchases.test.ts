/**
 * Restore Purchases RPC Unit Tests
 * Tests for IAP purchase restore flows (Issue #721)
 */
import { rpcRestorePurchases } from '../store';
import { createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import { Runtime } from '../../types/nakama';

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../utils/cache', () => ({
  getCacheManager: jest.fn(() => mockCache),
  resetCacheManager: jest.fn(),
}));

const createTestNakama = (overrides?: Partial<Runtime.Nakama>): Runtime.Nakama => {
  const base = createMockNakama();
  return {
    ...base,
    ...overrides,
  };
};

const mockCtx = {
  userId: 'test-user-123',
  username: 'testuser',
  ipAddress: '127.0.0.1',
  env: {},
};

describe('rpcRestorePurchases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockReturnValue(undefined);
    mockCache.set.mockClear();
    mockCache.delete.mockClear();
  });

  describe('Validation', () => {
    it('should reject empty payload', async () => {
      const nk = createTestNakama();

      const result = await rpcRestorePurchases(mockCtx as any, createMockLogger(), nk, '');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBeFalsy();
    });

    it('should reject invalid JSON payload', async () => {
      const nk = createTestNakama();

      const result = await rpcRestorePurchases(
        mockCtx as any,
        createMockLogger(),
        nk,
        'not-valid-json'
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBeFalsy();
    });

    it('should reject payload with invalid platform', async () => {
      const nk = createTestNakama();

      const result = await rpcRestorePurchases(
        mockCtx as any,
        createMockLogger(),
        nk,
        JSON.stringify({ platform: 'windows' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBeFalsy();
    });
  });

  describe('Successful Restore', () => {
    it('should return no purchases when RevenueCat reports no subscriber', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ subscriber: null }),
      });

      // Need REVENUECAT_SECRET_KEY set
      process.env.REVENUECAT_SECRET_KEY = 'test-api-key';

      const nk = createTestNakama({
        storageRead: jest.fn().mockReturnValue([]),
      });

      const result = await rpcRestorePurchases(
        mockCtx as any,
        createMockLogger(),
        nk,
        JSON.stringify({ platform: 'ios' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.restored).toBe(0);

      global.fetch = originalFetch;
      delete process.env.REVENUECAT_SECRET_KEY;
    });

    it('should restore non-subscription purchases and award gems', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          subscriber: {
            non_subscriptions: {
              'com.armoredarcher.gems.small': [
                { id: 'txn-restore-1', product_id: 'com.armoredarcher.gems.small' },
              ],
            },
          },
        }),
      });

      process.env.REVENUECAT_SECRET_KEY = 'test-api-key';

      const storageWriteFn = jest.fn().mockReturnValue([]);
      const nk = createTestNakama({
        storageRead: jest.fn().mockReturnValue([]),
        storageWrite: storageWriteFn,
      });

      const result = await rpcRestorePurchases(
        mockCtx as any,
        createMockLogger(),
        nk,
        JSON.stringify({ platform: 'ios' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.restored).toBe(1);
      expect(parsed.purchases).toHaveLength(1);
      expect(parsed.purchases[0].product_id).toBe('com.armoredarcher.gems.small');
      expect(parsed.purchases[0].gems_awarded).toBe(100);

      global.fetch = originalFetch;
      delete process.env.REVENUECAT_SECRET_KEY;
    });

    it('should skip already-processed purchases during restore', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          subscriber: {
            non_subscriptions: {
              'com.armoredarcher.gems.medium': [
                { id: 'txn-already-processed', product_id: 'com.armoredarcher.gems.medium' },
              ],
            },
          },
        }),
      });

      process.env.REVENUECAT_SECRET_KEY = 'test-api-key';

      // Mock storageRead to return an existing receipt (already processed)
      const nk = createTestNakama({
        storageRead: jest.fn().mockReturnValue([
          {
            collection: 'validated_receipts',
            key: 'receipt_some_hash',
            value: JSON.stringify({ validated_at: Date.now() }),
          },
        ]),
        storageWrite: jest.fn().mockReturnValue([]),
      });

      const result = await rpcRestorePurchases(
        mockCtx as any,
        createMockLogger(),
        nk,
        JSON.stringify({ platform: 'android' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.restored).toBe(0);

      global.fetch = originalFetch;
      delete process.env.REVENUECAT_SECRET_KEY;
    });

    it('should restore purchases from entitlements', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              premium: {
                product_id: 'com.armoredarcher.gems.large',
                transaction_id: 'ent-txn-123',
              },
            },
          },
        }),
      });

      process.env.REVENUECAT_SECRET_KEY = 'test-api-key';

      const storageWriteFn = jest.fn().mockReturnValue([]);
      const nk = createTestNakama({
        storageRead: jest.fn().mockReturnValue([]),
        storageWrite: storageWriteFn,
      });

      const result = await rpcRestorePurchases(
        mockCtx as any,
        createMockLogger(),
        nk,
        JSON.stringify({ platform: 'ios' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.restored).toBe(1);
      expect(parsed.purchases[0].gems_awarded).toBe(1200);

      global.fetch = originalFetch;
      delete process.env.REVENUECAT_SECRET_KEY;
    });
  });

  describe('Error Handling', () => {
    it('should return error when RevenueCat API key not configured', async () => {
      delete process.env.REVENUECAT_SECRET_KEY;

      const nk = createTestNakama();

      const result = await rpcRestorePurchases(
        mockCtx as any,
        createMockLogger(),
        nk,
        JSON.stringify({ platform: 'ios' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Purchase restore not configured');
    });

    it('should handle RevenueCat API errors gracefully', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      process.env.REVENUECAT_SECRET_KEY = 'test-api-key';

      const nk = createTestNakama();

      const result = await rpcRestorePurchases(
        mockCtx as any,
        createMockLogger(),
        nk,
        JSON.stringify({ platform: 'ios' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.restored).toBe(0);

      global.fetch = originalFetch;
      delete process.env.REVENUECAT_SECRET_KEY;
    });
  });

  describe('Balance Limits', () => {
    it('should not restore purchase if it would exceed max balance', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          subscriber: {
            non_subscriptions: {
              'com.armoredarcher.gems.large': [
                { id: 'txn-exceed-balance', product_id: 'com.armoredarcher.gems.large' },
              ],
            },
          },
        }),
      });

      process.env.REVENUECAT_SECRET_KEY = 'test-api-key';

      // Player already at max balance
      const existingCurrency = {
        user_id: 'test-user-123',
        gems: 9999999,
        coins: 0,
      };

      const nk = createTestNakama({
        storageRead: jest.fn().mockReturnValue([
          {
            collection: 'player_currency',
            key: 'test-user-123',
            value: JSON.stringify(existingCurrency),
          },
        ]),
        storageWrite: jest.fn().mockReturnValue([]),
      });

      const result = await rpcRestorePurchases(
        mockCtx as any,
        createMockLogger(),
        nk,
        JSON.stringify({ platform: 'android' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      // Should not award gems because it would exceed max balance
      expect(parsed.restored).toBe(0);

      global.fetch = originalFetch;
      delete process.env.REVENUECAT_SECRET_KEY;
    });
  });
});
