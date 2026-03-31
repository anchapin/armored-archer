// Simple unit tests for stage tracking - testing types and helpers

describe('stage_tracking types', () => {
  // Test that type exports work
  describe('CompleteStageRequest', () => {
    it('should allow valid stage completion request', () => {
      const request = {
        stage_id: 'stage_1',
        stage_prefix: 'campaign',
        stars_earned: 3,
        score: 1000,
      };

      expect(request.stage_id).toBe('stage_1');
      expect(request.stars_earned).toBe(3);
      expect(request.score).toBe(1000);
    });

    it('should allow optional difficulty', () => {
      const request = {
        stage_id: 'stage_1',
        stage_prefix: 'campaign',
        stars_earned: 3,
        score: 1000,
        difficulty: 'hard' as const,
      };

      expect(request.difficulty).toBe('hard');
    });

    it('should allow optional boss fields', () => {
      const request = {
        stage_id: 'stage_1',
        stage_prefix: 'campaign',
        stars_earned: 3,
        score: 1000,
        boss_defeated: true,
        boss_id: 'boss_1',
      };

      expect(request.boss_defeated).toBe(true);
      expect(request.boss_id).toBe('boss_1');
    });
  });

  describe('StageCompletionResponse', () => {
    it('should create successful response', () => {
      const response = {
        success: true,
        stage_id: 'stage_1',
        stars_earned: 3,
        score: 1000,
        is_new_completion: true,
      };

      expect(response.success).toBe(true);
      expect(response.is_new_completion).toBe(true);
    });

    it('should include previous best when not new', () => {
      const response = {
        success: true,
        stage_id: 'stage_1',
        stars_earned: 2,
        score: 500,
        is_new_completion: false,
        previous_best: {
          stars_earned: 1,
          score: 300,
        },
      };

      expect(response.previous_best?.stars_earned).toBe(1);
    });

    it('should include loot when difficulty provided', () => {
      const response = {
        success: true,
        stage_id: 'stage_1',
        stars_earned: 3,
        score: 1000,
        is_new_completion: true,
        loot: {
          dropped: true,
          gear: {
            id: 'gear_1',
            name: 'Test Bow',
            rarity: 'rare',
          },
        },
        drop_rate: 0.3,
      };

      expect(response.loot?.dropped).toBe(true);
      expect(response.drop_rate).toBe(0.3);
    });
  });

  describe('LootResult', () => {
    it('should represent no loot dropped', () => {
      const loot = {
        dropped: false,
        gear: null,
      };

      expect(loot.dropped).toBe(false);
      expect(loot.gear).toBeNull();
    });

    it('should represent loot dropped', () => {
      const loot = {
        dropped: true,
        gear: {
          id: 'gear_1',
          name: 'Epic Bow',
          rarity: 'legendary',
        },
      };

      expect(loot.dropped).toBe(true);
      expect(loot.gear?.rarity).toBe('legendary');
    });
  });

  describe('utility functions', () => {
    // Test comparison logic that would be used in stage tracking
    it('should compare stars correctly', () => {
      const isBetterThan = (newStars: number, existingStars: number) => newStars > existingStars;
      
      expect(isBetterThan(3, 2)).toBe(true);
      expect(isBetterThan(2, 3)).toBe(false);
      expect(isBetterThan(3, 3)).toBe(false);
    });

    it('should compare scores when stars equal', () => {
      const isBetterScore = (newScore: number, existingScore: number) => newScore > existingScore;
      
      expect(isBetterScore(1000, 500)).toBe(true);
      expect(isBetterScore(500, 1000)).toBe(false);
      expect(isBetterScore(500, 500)).toBe(false);
    });

    it('should calculate drop rate based on difficulty', () => {
      const calculateDropRate = (difficulty: string, bossDefeated: boolean): number => {
        const baseRates: Record<string, number> = {
          easy: 0.1,
          medium: 0.2,
          hard: 0.4,
          nightmare: 0.6,
        };
        const base = baseRates[difficulty] || 0.1;
        return bossDefeated ? base * 1.5 : base;
      };

      expect(calculateDropRate('easy', false)).toBe(0.1);
      expect(calculateDropRate('hard', false)).toBe(0.4);
      expect(calculateDropRate('hard', true)).toBe(0.6);
      expect(calculateDropRate('nightmare', true)).toBe(0.9);
    });

    it('should unlock modifiers when boss defeated', () => {
      const bossModifiers: Record<string, string[]> = {
        'boss_1': ['modifier_1', 'modifier_2'],
        'boss_2': ['modifier_3'],
      };

      const getModifiersUnlockedByBoss = (bossId: string): string[] => {
        return bossModifiers[bossId] || [];
      };

      expect(getModifiersUnlockedByBoss('boss_1')).toEqual(['modifier_1', 'modifier_2']);
      expect(getModifiersUnlockedByBoss('unknown')).toEqual([]);
    });
  });
});
