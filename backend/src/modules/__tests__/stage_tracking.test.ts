import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../config', () => ({
  config: {
    metrics: { namespace: 'test' },
    rateLimit: { enabled: false },
  },
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../audit', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../gear_db', () => ({
  getDefeatedBossesFromDB: jest.fn().mockReturnValue([]),
}));

jest.mock('../validation', () => ({
  validatePayload: jest.fn((schema: unknown, payload: string, name: string) => {
    try {
      const data = JSON.parse(payload);
      return { success: true, data };
    } catch {
      return { success: false, error: `Invalid JSON for ${name}` };
    }
  }),
  ZodSchemas: {
    get_all_stage_completions: {},
  },
  MAX_STAGE_SCORE: 1000000,
  createValidationErrorResponse: jest.fn((name: string, error: string) =>
    JSON.stringify({ success: false, error: `${name}: ${error}` })
  ),
}));

jest.mock('../../utils/circuitBreaker', () => ({
  withCircuitBreaker: jest.fn((_name: string, fn: Function) => fn()),
  getAllCircuitInfo: jest.fn().mockReturnValue([]),
}));

import {
  rpcGetCompletedStages,
  registerRpcGetCompletedStages,
  registerRpcGetCampaignProgress,
  rpcGetCampaignProgress,
} from '../stage_tracking';
import { getDefeatedBossesFromDB } from '../gear_db';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockNk = () => ({
  storageRead: jest.fn().mockReturnValue([]),
  storageWrite: jest.fn(),
  dbQuery: jest.fn().mockReturnValue([]),
});

/**
 * Issue #1069 decommissioned `rpcCompleteStage` (the `complete_stage` RPC).
 * Its write-path behavior — clamps, best-of records, claim-first atomicity,
 * idempotent retries — is covered by stage_progression.test.ts against the
 * consolidated survivor `rpcStageComplete` in gear_system.ts. This file
 * covers the surviving read RPCs only.
 */
describe('stage_tracking module (read RPCs)', () => {
  beforeEach(() => {
    (getDefeatedBossesFromDB as jest.Mock).mockReturnValue([]);
  });

  describe('registerRpcGetCompletedStages', () => {
    it('should register the get_completed_stages RPC', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcGetCompletedStages(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_completed_stages',
        expect.any(Function)
      );
    });
  });

  describe('rpcGetCompletedStages', () => {
    const mockCtx = { userId: 'user_123' } as any;

    it('should reject unauthenticated requests', () => {
      const ctxNoUser = { userId: null } as any;
      const result = rpcGetCompletedStages(
        ctxNoUser,
        createMockLogger() as any,
        createMockNk() as any,
        '{}'
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('UNAUTHORIZED');
    });

    it('should return empty completions for new user', () => {
      const nk = createMockNk();
      const result = rpcGetCompletedStages(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stages).toEqual([]);
      expect(parsed.count).toBe(0);
    });

    it('should return existing completions', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              forest_1: {
                stage_id: 'forest_1',
                stage_prefix: 'forest',
                stars_earned: 3,
                score: 1500,
                completed_at: '2024-01-02T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
              },
              cavern_1: {
                stage_id: 'cavern_1',
                stage_prefix: 'cavern',
                stars_earned: 2,
                score: 1000,
                completed_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
            },
          }),
        },
      ]);

      const result = rpcGetCompletedStages(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stages.length).toBe(2);
      expect(parsed.count).toBe(2);
    });

    it('should filter completions by stage prefix', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              forest_1: {
                stage_id: 'forest_1',
                stage_prefix: 'forest',
                stars_earned: 3,
                score: 1500,
                completed_at: '2024-01-02T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
              },
              cavern_1: {
                stage_id: 'cavern_1',
                stage_prefix: 'cavern',
                stars_earned: 2,
                score: 1000,
                completed_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
            },
          }),
        },
      ]);

      const payload = JSON.stringify({ stage_prefix: 'forest' });
      const result = rpcGetCompletedStages(mockCtx, createMockLogger() as any, nk as any, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stages.length).toBe(1);
      expect(parsed.stages[0].stage_prefix).toBe('forest');
    });

    it('should handle empty payload', () => {
      const nk = createMockNk();
      const result = rpcGetCompletedStages(mockCtx, createMockLogger() as any, nk as any, '');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should handle corrupted storage data gracefully', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([{ value: 'corrupted json{' }]);

      const result = rpcGetCompletedStages(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stages.length).toBe(0);
    });

    it('should sort completions by date descending', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              a: {
                stage_id: 'a',
                stage_prefix: 'test',
                stars_earned: 1,
                score: 100,
                completed_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              b: {
                stage_id: 'b',
                stage_prefix: 'test',
                stars_earned: 3,
                score: 300,
                completed_at: '2024-01-03T00:00:00Z',
                updated_at: '2024-01-03T00:00:00Z',
              },
            },
          }),
        },
      ]);

      const result = rpcGetCompletedStages(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.stages[0].stage_id).toBe('b');
      expect(parsed.stages[1].stage_id).toBe('a');
    });

    it('should handle storage read errors gracefully', () => {
      const nk = createMockNk();
      nk.storageRead.mockImplementation(() => {
        throw new Error('Storage read failed');
      });

      const result = rpcGetCompletedStages(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('INTERNAL_ERROR');
    });
  });

  describe('registerRpcGetCampaignProgress', () => {
    it('should register the get_campaign_progress RPC', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcGetCampaignProgress(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_campaign_progress',
        expect.any(Function)
      );
    });
  });

  describe('rpcGetCampaignProgress', () => {
    const mockCtx = { userId: 'user_123' } as any;

    it('should reject unauthenticated requests', () => {
      const ctxNoUser = { userId: null } as any;
      const result = rpcGetCampaignProgress(
        ctxNoUser,
        createMockLogger() as any,
        createMockNk() as any,
        '{}'
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('UNAUTHORIZED');
    });

    it('should return empty progress for new user', () => {
      const nk = createMockNk();
      const result = rpcGetCampaignProgress(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.completed_stages).toEqual([]);
      expect(parsed.unlocked_stages).toEqual(['1_1']);
      expect(parsed.bosses_defeated).toEqual([]);
    });

    it('should return progress for user with completed stages', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              '1_1': {
                stage_id: '1_1',
                stage_prefix: 'forest',
                stars_earned: 3,
                score: 1000,
                completed_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              '1_2': {
                stage_id: '1_2',
                stage_prefix: 'forest',
                stars_earned: 2,
                score: 800,
                completed_at: '2024-01-02T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
              },
            },
          }),
        },
      ]);

      const result = rpcGetCampaignProgress(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.completed_stages).toEqual(['1_1', '1_2']);
      expect(parsed.unlocked_stages).toContain('1_3');
      expect(parsed.unlocked_stages).toContain('1_1');
    });

    it('should handle corrupted storage data gracefully', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([{ value: 'corrupted json{' }]);

      const result = rpcGetCampaignProgress(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.completed_stages).toEqual([]);
      expect(parsed.unlocked_stages).toContain('1_1');
    });

    it('should handle storage read errors', () => {
      const nk = createMockNk();
      nk.storageRead.mockImplementation(() => {
        throw new Error('Storage failed');
      });

      const result = rpcGetCampaignProgress(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('INTERNAL_ERROR');
    });

    it('should return bosses defeated from the DB layer, not the orphaned player_inventory storage (issue #1069)', () => {
      (getDefeatedBossesFromDB as jest.Mock).mockReturnValue(['boss_dragon', 'boss_lich']);
      const nk = createMockNk();

      const result = rpcGetCampaignProgress(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(getDefeatedBossesFromDB).toHaveBeenCalledWith(expect.anything(), 'user_123');
      expect(parsed.bosses_defeated).toContain('boss_dragon');
      expect(parsed.bosses_defeated).toContain('boss_lich');

      // The orphaned read of the player_inventory storage collection is gone
      const readCalls = (nk.storageRead as jest.Mock).mock.calls.flat();
      const inventoryReads = readCalls.filter((obj: any) => obj?.collection === 'player_inventory');
      expect(inventoryReads).toEqual([]);
    });

    it('should derive next stage IDs from completions', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              '1_1': {
                stage_id: '1_1',
                stage_prefix: 'forest',
                stars_earned: 3,
                score: 1000,
                completed_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              '2_5': {
                stage_id: '2_5',
                stage_prefix: 'cavern',
                stars_earned: 3,
                score: 2000,
                completed_at: '2024-01-02T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
              },
            },
          }),
        },
      ]);

      const result = rpcGetCampaignProgress(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.unlocked_stages).toContain('1_2');
      expect(parsed.unlocked_stages).toContain('2_6');
    });
  });

  describe('deriveNextStageId edge cases', () => {
    const mockCtx = { userId: 'user_123' } as any;

    it('deriveNextStageId returns null for invalid format', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              'invalid-format': {
                stage_id: 'invalid-format',
                stage_prefix: 'test',
                stars_earned: 3,
                score: 1000,
                completed_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
            },
          }),
        },
      ]);

      const result = rpcGetCampaignProgress(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      // Should not add any invalid stage IDs to unlocked
      expect(parsed.unlocked_stages.every((id) => !id.includes('invalid'))).toBe(true);
    });

    it('deriveNextStageId handles edge cases', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              '1_0': {
                stage_id: '1_0',
                stage_prefix: 'test',
                stars_earned: 3,
                score: 1000,
                completed_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
            },
          }),
        },
      ]);

      const result = rpcGetCampaignProgress(mockCtx, createMockLogger() as any, nk as any, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.unlocked_stages).toContain('1_1');
    });
  });
});
