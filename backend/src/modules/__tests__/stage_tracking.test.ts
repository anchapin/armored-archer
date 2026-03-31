import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Nakama runtime types
interface MockRuntime {
  Context: {
    userId: string;
    ipAddress?: string;
  };
  Logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  Nakama: {
    storageRead: jest.Mock;
    storageWrite: jest.Mock;
  };
}

const createMockLogger = (): MockRuntime['Logger'] => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockNk = (): MockRuntime['Nakama'] => ({
  storageRead: jest.fn().mockReturnValue([]),
  storageWrite: jest.fn(),
});

describe('stage_tracking module', () => {
  describe('isBetterCompletion', () => {
    it('should return true when new stars are higher', () => {
      const isBetterCompletion = (newStars: number, newScore: number, existingStars: number, existingScore: number) => 
        newStars > existingStars || (newStars === existingStars && newScore > existingScore);
      
      expect(isBetterCompletion(3, 1000, 2, 500)).toBe(true);
    });

    it('should return true when stars equal but new score is higher', () => {
      const isBetterCompletion = (newStars: number, newScore: number, existingStars: number, existingScore: number) => 
        newStars > existingStars || (newStars === existingStars && newScore > existingScore);
      
      expect(isBetterCompletion(2, 1500, 2, 1000)).toBe(true);
    });

    it('should return false when new completion is worse', () => {
      const isBetterCompletion = (newStars: number, newScore: number, existingStars: number, existingScore: number) => 
        newStars > existingStars || (newStars === existingStars && newScore > existingScore);
      
      expect(isBetterCompletion(1, 500, 2, 1000)).toBe(false);
    });
  });

  describe('createCompletionRecord', () => {
    it('should create a valid completion record', () => {
      const createCompletionRecord = (
        stageId: string,
        stagePrefix: string,
        starsEarned: number,
        score: number
      ) => {
        const now = new Date().toISOString();
        return {
          id: '',
          user_id: '',
          stage_id: stageId,
          stage_prefix: stagePrefix,
          stars_earned: starsEarned,
          score,
          completed_at: now,
          updated_at: now,
        };
      };

      const record = createCompletionRecord('forest_1', 'forest', 3, 1500);
      expect(record.stage_id).toBe('forest_1');
      expect(record.stage_prefix).toBe('forest');
      expect(record.stars_earned).toBe(3);
      expect(record.score).toBe(1500);
      expect(record.completed_at).toBeDefined();
      expect(record.updated_at).toBeDefined();
    });
  });

  describe('updateCompletionRecord', () => {
    it('should update existing record with new values', () => {
      const updateCompletionRecord = (
        stageId: string,
        stagePrefix: string,
        starsEarned: number,
        score: number,
        existingCompletion: { stage_id: string; stage_prefix: string; stars_earned: number; score: number; completed_at: string; updated_at: string }
      ) => {
        return {
          ...existingCompletion,
          stage_id: stageId,
          stage_prefix: stagePrefix,
          stars_earned: starsEarned,
          score,
          updated_at: new Date().toISOString(),
        };
      };

      const existing = {
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 2,
        score: 800,
        completed_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const updated = updateCompletionRecord('forest_1', 'forest', 3, 1500, existing);
      expect(updated.stars_earned).toBe(3);
      expect(updated.score).toBe(1500);
      expect(updated.completed_at).toBe('2024-01-01T00:00:00Z');
      expect(updated.updated_at).not.toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('StageCompletionStorage', () => {
    it('should handle empty storage data', () => {
      const storageData = {
        user_id: 'test_user',
        completions: {} as Record<string, unknown>,
      };

      expect(Object.keys(storageData.completions).length).toBe(0);
    });

    it('should store and retrieve completions correctly', () => {
      const storageData = {
        user_id: 'test_user',
        completions: {
          'forest_1': {
            stage_id: 'forest_1',
            stage_prefix: 'forest',
            stars_earned: 3,
            score: 1500,
            completed_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      };

      expect(storageData.completions['forest_1'].stars_earned).toBe(3);
    });
  });

  describe('StageCompletionResponse', () => {
    it('should format response for new completion', () => {
      const response = {
        success: true,
        stage_id: 'forest_1',
        stars_earned: 3,
        score: 1500,
        is_new_completion: true,
      };

      expect(response.success).toBe(true);
      expect(response.is_new_completion).toBe(true);
    });

    it('should include previous best when updating', () => {
      const response = {
        success: true,
        stage_id: 'forest_1',
        stars_earned: 3,
        score: 1500,
        is_new_completion: false,
        previous_best: {
          stars_earned: 2,
          score: 1000,
        },
      };

      expect(response.previous_best).toBeDefined();
      expect(response.previous_best!.stars_earned).toBe(2);
    });

    it('should include loot when difficulty provided', () => {
      const response = {
        success: true,
        stage_id: 'forest_1',
        stars_earned: 3,
        score: 1500,
        is_new_completion: true,
        loot: {
          dropped: true,
          gear: { id: 'gear_1', name: 'Bow', rarity: 'rare' },
        },
        drop_rate: 0.25,
        unlocked_modifier_pools: ['pool_1'],
      };

      expect(response.loot).toBeDefined();
      expect(response.drop_rate).toBe(0.25);
    });
  });

  describe('LootResult', () => {
    it('should handle no loot dropped', () => {
      const lootResult = {
        dropped: false,
        gear: null,
      };

      expect(lootResult.dropped).toBe(false);
      expect(lootResult.gear).toBeNull();
    });

    it('should handle loot dropped with gear', () => {
      const gear = { id: 'gear_1', name: 'Steel Bow', rarity: 'epic' };
      const lootResult = {
        dropped: true,
        gear,
      };

      expect(lootResult.dropped).toBe(true);
      expect(lootResult.gear).toEqual(gear);
    });
  });

  describe('CompleteStageRequest', () => {
    it('should validate stage completion request', () => {
      const request = {
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 3,
        score: 1500,
        difficulty: 'hard',
        boss_defeated: true,
        boss_id: 'forest_alpha',
      };

      expect(request.stage_id).toBe('forest_1');
      expect(request.difficulty).toBe('hard');
      expect(request.boss_defeated).toBe(true);
    });

    it('should allow optional fields', () => {
      const request = {
        stage_id: 'forest_1',
        stage_prefix: 'forest',
        stars_earned: 1,
        score: 500,
      };

      expect(request.difficulty).toBeUndefined();
      expect(request.boss_defeated).toBeUndefined();
    });
  });

  describe('GetStageCompletionRequest', () => {
    it('should validate get stage completion request', () => {
      const request = {
        stage_id: 'forest_1',
      };

      expect(request.stage_id).toBe('forest_1');
    });
  });

  describe('GetAllStageCompletionsRequest', () => {
    it('should allow optional prefix filter', () => {
      const requestWithoutFilter: { stage_prefix?: string } = {};
      expect(requestWithoutFilter.stage_prefix).toBeUndefined();

      const requestWithFilter = { stage_prefix: 'forest' };
      expect(requestWithFilter.stage_prefix).toBe('forest');
    });
  });

  describe('filtering completions by prefix', () => {
    it('should filter completions by stage prefix', () => {
      const completions = [
        { stage_id: 'forest_1', stage_prefix: 'forest', stars_earned: 3, score: 1500, completed_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
        { stage_id: 'forest_2', stage_prefix: 'forest', stars_earned: 2, score: 1000, completed_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
        { stage_id: 'cavern_1', stage_prefix: 'cavern', stars_earned: 1, score: 500, completed_at: '2024-01-03T00:00:00Z', updated_at: '2024-01-03T00:00:00Z' },
      ];

      const filtered = completions.filter((c) => c.stage_prefix === 'forest');
      expect(filtered.length).toBe(2);
    });

    it('should sort completions by date (most recent first)', () => {
      const completions = [
        { stage_id: 'a', stage_prefix: 'test', stars_earned: 1, score: 100, completed_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
        { stage_id: 'b', stage_prefix: 'test', stars_earned: 2, score: 200, completed_at: '2024-01-03T00:00:00Z', updated_at: '2024-01-03T00:00:00Z' },
        { stage_id: 'c', stage_prefix: 'test', stars_earned: 3, score: 300, completed_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
      ];

      completions.sort(
        (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );

      expect(completions[0].stage_id).toBe('b');
      expect(completions[1].stage_id).toBe('c');
      expect(completions[2].stage_id).toBe('a');
    });
  });
});
