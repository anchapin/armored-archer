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
  registerRpcGetCampaignProgress,
  rpcGetCampaignProgress,
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

    it('should handle storage read errors gracefully', () => {
      const nk = createMockNk();
      nk.storageRead.mockImplementation(() => {
        throw new Error('Storage read failed');
      });

      const result = rpcGetCompletedStages(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        '{}'
      );
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
      const result = rpcGetCampaignProgress(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        '{}'
      );
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

      const result = rpcGetCampaignProgress(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        '{}'
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.completed_stages).toEqual(['1_1', '1_2']);
      expect(parsed.unlocked_stages).toContain('1_3');
      expect(parsed.unlocked_stages).toContain('1_1');
    });

    it('should handle corrupted storage data gracefully', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([{ value: 'corrupted json{' }]);

      const result = rpcGetCampaignProgress(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        '{}'
      );
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

      const result = rpcGetCampaignProgress(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        '{}'
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('INTERNAL_ERROR');
    });

    it('should return bosses defeated from inventory', () => {
      const nk = createMockNk();
      nk.storageRead.mockImplementation((keys: any[]) => {
        if (keys[0].collection === 'stage_completion') {
          return [
            {
              value: JSON.stringify({
                user_id: 'user_123',
                completions: {},
              }),
            },
          ];
        }
        if (keys[0].collection === 'player_inventory') {
          return [
            {
              value: JSON.stringify({
                gear: [],
                unlocked_modifier_pools: ['fire_modifiers', 'ice_modifiers'],
              }),
            },
          ];
        }
        return [];
      });

      const result = rpcGetCampaignProgress(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        '{}'
      );
      const parsed = JSON.parse(result);

      expect(parsed.bosses_defeated).toContain('fire_modifiers');
      expect(parsed.bosses_defeated).toContain('ice_modifiers');
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

      const result = rpcGetCampaignProgress(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        '{}'
      );
      const parsed = JSON.parse(result);

      expect(parsed.unlocked_stages).toContain('1_2');
      expect(parsed.unlocked_stages).toContain('2_6');
    });
  });

  describe('rpcCompleteStage edge cases', () => {
    const mockCtx = { userId: 'user_123', ipAddress: '127.0.0.1' } as any;

    it('should handle storage errors during completion', () => {
      const nk = createMockNk();
      nk.storageRead.mockImplementation(() => {
        throw new Error('Storage read failed');
      });

      const payload = JSON.stringify({
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 3,
        score: 1500,
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('INTERNAL_ERROR');
    });

    it('should handle storage errors during loot processing', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {},
          }),
        },
      ]);
      nk.storageWrite.mockImplementation(() => {
        throw new Error('Storage write failed');
      });

      const payload = JSON.stringify({
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 3,
        score: 1500,
        difficulty: 'hard',
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('INTERNAL_ERROR');
    });

    it('should handle loot generation when drop is successful', () => {
      const { calculateDropRate } = require('../gear_system');
      (calculateDropRate as jest.Mock).mockReturnValue(1.0); // 100% drop rate

      const nk = createMockNk();
      const payload = JSON.stringify({
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 3,
        score: 1500,
        difficulty: 'hard',
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.loot?.dropped).toBe(true);
      expect(parsed.loot?.gear).toBeDefined();
    });

    it('should handle loot generation when drop fails', () => {
      const { calculateDropRate } = require('../gear_system');
      (calculateDropRate as jest.Mock).mockReturnValue(0.0); // 0% drop rate

      const nk = createMockNk();
      const payload = JSON.stringify({
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 3,
        score: 1500,
        difficulty: 'hard',
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.loot?.dropped).toBe(false);
    });

    it('should unlock modifier pools when boss is defeated', () => {
      const { getModifiersUnlockedByBoss } = require('../gear_system');
      (getModifiersUnlockedByBoss as jest.Mock).mockReturnValue(['boss_mod_1', 'boss_mod_2']);

      const nk = createMockNk();
      const payload = JSON.stringify({
        stage_id: 'boss_stage',
        stage_prefix: 'boss',
        stars_earned: 3,
        score: 5000,
        difficulty: 'nightmare',
        boss_defeated: true,
        boss_id: 'boss_dragon',
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toContain('boss_mod_1');
      expect(parsed.unlocked_modifier_pools).toContain('boss_mod_2');
    });

    it('should handle stage replay with same stars but higher score', () => {
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
        score: 2000,
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.is_new_completion).toBe(false);
      expect(parsed.previous_best?.stars_earned).toBe(3);
      expect(parsed.previous_best?.score).toBe(1500);
    });

    it('should include previous_best when improving completion', () => {
      const nk = createMockNk();
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              forest_1: {
                stage_id: 'forest_1',
                stage_prefix: 'forest',
                stars_earned: 2,
                score: 1000,
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

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.previous_best).toBeDefined();
      expect(parsed.previous_best!.stars_earned).toBe(2);
      expect(parsed.previous_best!.score).toBe(1000);
    });

    it('should not include previous_best for new completion', () => {
      const nk = createMockNk();
      const payload = JSON.stringify({
        stage_id: 'new_stage',
        stage_prefix: 'new',
        stars_earned: 1,
        score: 500,
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.is_new_completion).toBe(true);
      expect(parsed.previous_best).toBeUndefined();
    });

    it('should handle all difficulty levels', () => {
      const difficulties: ('easy' | 'medium' | 'hard' | 'nightmare')[] = ['easy', 'medium', 'hard', 'nightmare'];
      const nk = createMockNk();

      for (const difficulty of difficulties) {
        const payload = JSON.stringify({
          stage_id: 'test_stage',
          stage_prefix: 'test',
          stars_earned: 3,
          score: 1000,
          difficulty,
        });

        const result = rpcCompleteStage(
          mockCtx,
          createMockLogger() as any,
          nk as any,
          payload
        );
        const parsed = JSON.parse(result);

        expect(parsed.success).toBe(true);
        expect(parsed.loot).toBeDefined();
      }
    });

    it('should not process loot when difficulty is not provided', () => {
      const nk = createMockNk();
      const payload = JSON.stringify({
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 3,
        score: 1500,
        // no difficulty field
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.loot).toBeUndefined();
      expect(parsed.drop_rate).toBeUndefined();
      expect(parsed.unlocked_modifier_pools).toBeUndefined();
    });
  });

  describe('Helper functions behavior', () => {
    const mockCtx = { userId: 'user_123', ipAddress: '127.0.0.1' } as any;

    it('isBetterCompletion returns true for higher stars', () => {
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
                score: 5000,
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
        score: 1000, // Lower score but higher stars
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stars_earned).toBe(3);
    });

    it('isBetterCompletion returns true for same stars with higher score', () => {
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
                score: 1000,
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

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.score).toBe(1500);
    });

    it('isBetterCompletion returns false for lower stars', () => {
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
        stars_earned: 2,
        score: 5000,
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('No improvement over previous completion');
    });

    it('isBetterCompletion returns false for same stars with lower score', () => {
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
        score: 1000,
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('No improvement over previous completion');
    });

    it('createCompletionRecord creates proper record with timestamps', () => {
      const nk = createMockNk();
      const beforeDate = new Date();

      const payload = JSON.stringify({
        stage_id: 'test_1',
        stage_prefix: 'test',
        stars_earned: 3,
        score: 1000,
      });

      const result = rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );

      const afterDate = new Date();

      expect(nk.storageWrite).toHaveBeenCalled();
      const writeCalls = (nk.storageWrite as jest.Mock).mock.calls[0][0];
      const storageData = JSON.parse(writeCalls[0].value);
      const completion = storageData.completions.test_1;

      expect(completion.stage_id).toBe('test_1');
      expect(completion.stage_prefix).toBe('test');
      expect(completion.stars_earned).toBe(3);
      expect(completion.score).toBe(1000);

      const completedAt = new Date(completion.completed_at);
      const updatedAt = new Date(completion.updated_at);
      expect(completedAt).toBeInstanceOf(Date);
      expect(updatedAt).toBeInstanceOf(Date);
    });

    it('updateCompletionRecord preserves original completion date', () => {
      const nk = createMockNk();
      const originalDate = '2024-01-01T00:00:00Z';
      nk.storageRead.mockReturnValue([
        {
          value: JSON.stringify({
            user_id: 'user_123',
            completions: {
              forest_1: {
                stage_id: 'forest_1',
                stage_prefix: 'forest',
                stars_earned: 2,
                score: 1000,
                completed_at: originalDate,
                updated_at: originalDate,
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

      rpcCompleteStage(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        payload
      );

      const writeCalls = (nk.storageWrite as jest.Mock).mock.calls[0][0];
      const storageData = JSON.parse(writeCalls[0].value);
      const completion = storageData.completions.forest_1;

      expect(completion.completed_at).toBe(originalDate);
      expect(completion.updated_at).not.toBe(originalDate);
      expect(completion.stars_earned).toBe(3);
      expect(completion.score).toBe(1500);
    });

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

      const result = rpcGetCampaignProgress(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        '{}'
      );
      const parsed = JSON.parse(result);

      // Should not add any invalid stage IDs to unlocked
      expect(parsed.unlocked_stages.every(id => !id.includes('invalid'))).toBe(true);
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

      const result = rpcGetCampaignProgress(
        mockCtx,
        createMockLogger() as any,
        nk as any,
        '{}'
      );
      const parsed = JSON.parse(result);

      expect(parsed.unlocked_stages).toContain('1_1');
    });
  });
});
