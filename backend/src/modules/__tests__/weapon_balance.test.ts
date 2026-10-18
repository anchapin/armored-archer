/**
 * Tests for weapon_balance module
 */

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { rpcGetBalanceMetrics, WeaponTier, BalanceAdjustment } from '../weapon_balance';
import { Runtime } from '../types/nakama';

function createMockNk(overrides: Record<string, unknown> = {}): Runtime.Nakama {
  return {
    storageRead: jest.fn().mockReturnValue([]),
    storageWrite: jest.fn().mockReturnValue(undefined),
    ...overrides,
  } as unknown as Runtime.Nakama;
}

function createMockLogger(): Runtime.Logger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Runtime.Logger;
}

function createMockCtx(userId: string): Runtime.Context {
  return { userId } as unknown as Runtime.Context;
}

function adminMetadataObject(isAdmin: boolean): { value: string } {
  return { value: JSON.stringify({ is_admin: isAdmin }) };
}

function adjustmentObject(
  weaponId: string,
  multiplier: number,
  createTime: number
): { value: string; createTime: number } {
  return {
    value: JSON.stringify({
      adjustment_id: `bal_${createTime}`,
      weapon_id: weaponId,
      multiplier,
      reason: 'test',
      created_at: createTime,
      created_by: 'admin-1',
    }),
    createTime,
  };
}

describe('weapon_balance', () => {
  describe('rpcGetBalanceMetrics', () => {
    function usageStatsObject(stats: Record<string, unknown>): { value: Record<string, unknown> } {
      return { value: stats };
    }

    it('should return an adjustment summary for an empty payload', () => {
      const nk = createMockNk({
        storageList: jest.fn().mockImplementation((_userId: string, collection: string) => {
          if (collection === 'weapon_balance_adjustments') {
            return [adjustmentObject('bow_a', 1.2, 100), adjustmentObject('bow_b', 0.8, 200)];
          }
          return [];
        }),
        storageRead: jest.fn().mockReturnValue([]),
      });

      const response = rpcGetBalanceMetrics(createMockCtx('admin-1'), createMockLogger(), nk, '');

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.active_adjustments).toBe(2);
      expect(result.adjustments).toEqual({ bow_a: 1.2, bow_b: 0.8 });
      expect(result.weapons).toEqual([]);
      expect(result.flagged_weapons).toEqual([]);
    });

    it('should return the same summary for an empty JSON object payload', () => {
      const nk = createMockNk();

      const response = rpcGetBalanceMetrics(createMockCtx('admin-1'), createMockLogger(), nk, '{}');

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.active_adjustments).toBe(0);
      expect(result.adjustments).toEqual({});
    });

    it('should unwrap a storageList { objects } envelope', () => {
      const nk = createMockNk({
        storageList: jest.fn().mockImplementation((_userId: string, collection: string) => {
          if (collection === 'weapon_balance_adjustments') {
            return { objects: [adjustmentObject('bow_a', 1.2, 100)] };
          }
          return { objects: [] };
        }),
      });

      const response = rpcGetBalanceMetrics(createMockCtx('admin-1'), createMockLogger(), nk, '');

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.adjustments).toEqual({ bow_a: 1.2 });
    });

    it('should still report when the adjustments listing fails', () => {
      const nk = createMockNk({
        storageList: jest.fn().mockImplementation(() => {
          throw new Error('storage down');
        }),
      });

      const response = rpcGetBalanceMetrics(createMockCtx('admin-1'), createMockLogger(), nk, '');

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.active_adjustments).toBe(0);
      expect(result.adjustments).toEqual({});
    });

    it('should include per-weapon report rows and flag out-of-band win rates', () => {
      const over = {
        weapon_id: 'bow_over',
        matches_played: 40,
        wins: 30,
        losses: 10,
        win_rate: 0.75,
        avg_rating_diff: 5,
        last_updated: 999,
      };
      const under = {
        weapon_id: 'bow_under',
        matches_played: 25,
        wins: 5,
        losses: 20,
        win_rate: 0.2,
        avg_rating_diff: -3,
        last_updated: 998,
      };
      const lowSample = {
        weapon_id: 'bow_new',
        matches_played: 3,
        wins: 0,
        losses: 3,
        win_rate: 0,
        avg_rating_diff: 0,
        last_updated: 997,
      };
      const nk = createMockNk({
        storageList: jest.fn().mockReturnValue([]),
        storageRead: jest
          .fn()
          .mockReturnValue([
            usageStatsObject(over),
            usageStatsObject(under),
            usageStatsObject(lowSample),
          ]),
      });

      const response = rpcGetBalanceMetrics(createMockCtx('admin-1'), createMockLogger(), nk, '');

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.weapons).toHaveLength(3);
      const overRow = result.weapons.find(
        (row: { weapon_id: string }) => row.weapon_id === 'bow_over'
      );
      expect(overRow.win_rate).toBeCloseTo(0.75);
      expect(overRow.flagged).toBe(true);
      expect(overRow.flag_reason).toBe('overperforming');
      const underRow = result.weapons.find(
        (row: { weapon_id: string }) => row.weapon_id === 'bow_under'
      );
      expect(underRow.flag_reason).toBe('underperforming');
      const newRow = result.weapons.find(
        (row: { weapon_id: string }) => row.weapon_id === 'bow_new'
      );
      expect(newRow.flagged).toBe(false);
      expect(result.flagged_weapons).toEqual(['bow_over', 'bow_under']);
    });

    it('should return weapon-specific metrics when a weapon_id is provided', () => {
      const usageStats = {
        weapon_id: 'bow_a',
        matches_played: 5,
        wins: 3,
        losses: 2,
        win_rate: 0.6,
        avg_rating_diff: 4,
        last_updated: 999,
      };
      const nk = createMockNk({
        storageList: jest.fn().mockImplementation((_userId: string, collection: string) => {
          if (collection === 'weapon_balance_adjustments') {
            return [adjustmentObject('bow_a', 1.2, 100)];
          }
          return [];
        }),
        storageRead: jest.fn().mockReturnValue([usageStatsObject(usageStats)]),
      });

      const response = rpcGetBalanceMetrics(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        JSON.stringify({ weapon_id: 'bow_a' })
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.weapon_id).toBe('bow_a');
      expect(result.balance_multiplier).toBe(1.2);
      expect(result.usage_stats.weapon_id).toBe('bow_a');
      expect(result.usage_stats.matches_played).toBe(5);
      expect(result.usage_stats.win_rate).toBeCloseTo(0.6);
    });

    it('should default the balance multiplier and report null stats for an unknown weapon', () => {
      const nk = createMockNk({
        storageList: jest.fn().mockImplementation((_userId: string, collection: string) => {
          if (collection === 'weapon_balance_adjustments') {
            return [adjustmentObject('bow_a', 1.2, 100)];
          }
          return [];
        }),
        storageRead: jest.fn().mockReturnValue([]),
      });

      const response = rpcGetBalanceMetrics(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        JSON.stringify({ weapon_id: 'bow_unknown' })
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.weapon_id).toBe('bow_unknown');
      expect(result.balance_multiplier).toBe(1.0);
      expect(result.usage_stats).toBeNull();
    });

    it('should reject a payload that is not valid JSON', () => {
      const nk = createMockNk();

      const response = rpcGetBalanceMetrics(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        'not-json'
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(false);
    });

    it('should reject an out-of-shape weapon_id', () => {
      const nk = createMockNk();

      const response = rpcGetBalanceMetrics(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        JSON.stringify({ weapon_id: 42 })
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(false);
    });

    it('should never return a Promise (ADR-0008 sync tripwire)', () => {
      const nk = createMockNk();

      const response = rpcGetBalanceMetrics(createMockCtx('admin-1'), createMockLogger(), nk, '');

      expect(typeof (response as unknown as Promise<string>)?.then).not.toBe('function');
      expect(typeof response).toBe('string');
    });
  });

  describe('registerRpcGetBalanceMetrics admin gate', () => {
    const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
    let savedAdminEnv: string | undefined;

    beforeEach(() => {
      savedAdminEnv = process.env.ADMIN_USER_IDS;
      process.env.ADMIN_USER_IDS = ADMIN_ID;
      jest.resetModules();
    });

    afterEach(() => {
      if (savedAdminEnv === undefined) {
        delete process.env.ADMIN_USER_IDS;
      } else {
        process.env.ADMIN_USER_IDS = savedAdminEnv;
      }
    });

    function registerAndCapture(): (ctx: Runtime.Context, payload: string) => string {
      const { registerRpcGetBalanceMetrics } = jest.requireActual('../weapon_balance');
      let captured: ((...args: unknown[]) => string) | undefined;
      const initializer = {
        registerRpc: jest.fn((id: string, handler: (...args: unknown[]) => string) => {
          expect(id).toBe('armored_archer/get_balance_metrics');
          captured = handler;
        }),
      };
      registerRpcGetBalanceMetrics(
        initializer as unknown as import('../types/nakama').Runtime.Initializer
      );
      expect(captured).toBeDefined();
      return (ctx, payload) =>
        captured!(ctx, createMockLogger(), createMockNk(), payload) as string;
    }

    it('should reject non-admin callers with a generic error', () => {
      const handler = registerAndCapture();

      const response = handler(createMockCtx('not-an-admin'), '');

      const result = JSON.parse(response);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authorized');
    });

    it('should reject callers with no userId', () => {
      const handler = registerAndCapture();

      const response = handler({} as Runtime.Context, '');

      const result = JSON.parse(response);
      expect(result.success).toBe(false);
    });

    it('should serve the report to allowlisted admins', () => {
      const handler = registerAndCapture();

      const response = handler(createMockCtx(ADMIN_ID), '{}');

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.weapons).toEqual([]);
    });
  });
});
