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

jest.mock('../gear_system', () => ({
  generateGearItem: jest.fn().mockReturnValue({
    id: 'gear_1',
    name: 'Test Bow',
    rarity: 'rare',
    type: 'bow',
  }),
  calculateDropRate: jest.fn().mockReturnValue(0.25),
  GearItem: {},
  getModifiersUnlockedByBoss: jest.fn().mockReturnValue([]),
  getPlayerInventory: jest.fn().mockReturnValue({
    gear: [],
    unlocked_modifier_pools: [],
  }),
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
    complete_stage: {},
    get_all_stage_completions: {},
  },
  createValidationErrorResponse: jest.fn((name: string, error: string) =>
    JSON.stringify({ success: false, error: `${name}: ${error}` })
  ),
}));

jest.mock('../../utils/circuitBreaker', () => ({
  withCircuitBreaker: jest.fn((_name: string, fn: Function) => fn()),
  getAllCircuitInfo: jest.fn().mockReturnValue([]),
}));

import {
  rpcCompleteStage,
  rpcGetCompletedStages,
  registerRpcCompleteStage,
  registerRpcGetCompletedStages,
} from '../stage_tracking';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockNk = () => ({
  storageRead: jest.fn().mockReturnValue([]),
  storageWrite: jest.fn(),
});

describe('stage_tracking module', () => {
  describe('registerRpcCompleteStage', () => {
    it('should register the complete_stage RPC', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcCompleteStage(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/complete_stage',
        expect.any(Function)
      );
    });
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

  describe('rpcCompleteStage', () => {
    const mockCtx = { userId: 'user_123', ipAddress: '127.0.0.1' } as any;

    it('should reject unauthenticated requests', () => {
      const ctxNoUser = { userId: null } as any;
      const result = rpcCompleteStage(
        ctxNoUser,
        createMockLogger() as any,
        createMockNk() as any,
        '{}'
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('UNAUTHORIZED');
    });

    it('should handle invalid JSON payload', () => {
      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        createMockNk() as any,
        'not json'
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it('should process a new stage completion', () => {
      const nk = createMockNk();
      const payload = JSON.stringify({
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 3,
        score: 1500,
      });

      const result = rpcCompleteStage(mockCtx, createMockLogger() as any, nk as any, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stage_id).toBe('forest_1');
      expect(parsed.stars_earned).toBe(3);
      expect(parsed.score).toBe(1500);
      expect(parsed.is_new_completion).toBe(true);
      expect(nk.storageWrite).toHaveBeenCalled();
    });

    it('should handle stage replay with no improvement', () => {
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
                score: 2000,
                completed_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
            },
          }),
        },
      ]);

      const payload = JSON.stringify({
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 2,
        score: 1000,
      });

      const result = rpcCompleteStage(mockCtx, createMockLogger() as any, nk as any, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.is_new_completion).toBe(false);
      expect(parsed.message).toBe('No improvement over previous completion');
    });

    it('should process stage completion with loot generation', () => {
      const nk = createMockNk();
      const payload = JSON.stringify({
        stage_id: 'cavern_1',
        stage_prefix: 'cavern',
        stars_earned: 3,
        score: 2000,
        difficulty: 'hard',
        boss_defeated: true,
        boss_id: 'boss_1',
      });

      const result = rpcCompleteStage(mockCtx, createMockLogger() as any, nk as any, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.loot).toBeDefined();
      expect(parsed.drop_rate).toBeDefined();
    });

    it('should handle stage replay with improvement', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              forest_1: {
                stage_id: 'forest_1',
                stage_prefix: 'forest',
                stars_earned: 1,
                score: 500,
                completed_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
            },
          }),
        },
      ]);

      const payload = JSON.stringify({
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 3,
        score: 1500,
      });

      const result = rpcCompleteStage(mockCtx, createMockLogger() as any, nk as any, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.is_new_completion).toBe(false);
      expect(parsed.previous_best).toBeDefined();
      expect(parsed.previous_best!.stars_earned).toBe(1);
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
  });
});
