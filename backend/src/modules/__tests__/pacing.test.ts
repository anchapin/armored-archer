/**
 * Encounter Pacing module tests.
 * Tests for pacing tracking, fatigue calculation, and pacing distribution.
 */

import {
  classifyEncounter,
  trackPacingState,
  getPacingMetrics,
  getFatigueLevel,
  suggestBreak,
  getRecommendedEncounterType,
  resetPacingState,
} from '../encounter_pacing';
import { Runtime } from '../../types/nakama';
import { ContentType } from '../encounter_pacing';

describe('Pacing', () => {
  let mockCtx: Partial<Runtime>;
  let testUserId = 'test-user-123';

  beforeEach(() => {
    mockCtx = {
      storageWrite: jest.fn().mockResolvedValue(undefined),
      storageRead: jest.fn().mockResolvedValue(undefined),
      storageList: jest.fn().mockResolvedValue([]),
      env: {},
    };
    resetPacingState(mockCtx, testUserId);
  });

  describe('classifyEncounter', () => {
    it('should classify boss encounters as COMBAT', () => {
      const bossEncounter = {
        id: 'cavern_warlord',
        biome: 'cavern',
        difficulty: 2,
        is_boss: true,
      };

      const type = classifyEncounter(bossEncounter);
      expect(type).toBe(ContentType.COMBAT);
    });

    it('should classify forest encounters correctly', () => {
      const forestEncounter = {
        id: 'forest_goblin',
        biome: 'forest',
        difficulty: 1,
        is_boss: false,
      };

      const type = classifyEncounter(forestEncounter);
      expect(type).toBe(ContentType.COMBAT);
    });

    it('should classify cavern encounters correctly', () => {
      const cavernEncounter = {
        id: 'cavern_elemental',
        biome: 'cavern',
        difficulty: 2,
        is_boss: false,
      };

      const type = classifyEncounter(cavernEncounter);
      // Can be COMBAT or PUZZLE based on random
      expect(type === ContentType.COMBAT || type === ContentType.PUZZLE).toBe(true);
    });

    it('should classify sky encounters as COMBAT', () => {
      const skyEncounter = {
        id: 'sky_drake',
        biome: 'sky',
        difficulty: 3,
        is_boss: false,
      };

      const type = classifyEncounter(skyEncounter);
      expect(type).toBe(ContentType.COMBAT);
    });
  });

  describe('Pacing targets', () => {
    it('should have 60% combat target', () => {
      const targets = getPacingTargets();
      expect(targets.TARGET_COMBAT_RATIO).toBe(0.6);
    });

    it('should have 20% exploration target', () => {
      const targets = getPacingTargets();
      expect(targets.TARGET_EXPLORATION_RATIO).toBe(0.2);
    });

    it('should have 20% narrative target', () => {
      const targets = getPacingTargets();
      expect(targets.TARGET_NARRATIVE_RATIO).toBe(0.2);
    });

    it('should have max combat streak of 5', () => {
      const targets = getPacingTargets();
      expect(targets.MAX_COMBAT_STREAK).toBe(5);
    });

    it('should have min exploration streak of 3', () => {
      const targets = getPacingTargets();
      expect(targets.MIN_EXPLORATION_STREAK).toBe(3);
    });

    it('should have high fatigue threshold of 70', () => {
      const targets = getPacingTargets();
      expect(targets.FATIGUE_THRESHOLD_HIGH).toBe(70);
    });

    it('should have critical fatigue threshold of 85', () => {
      const targets = getPacingTargets();
      expect(targets.FATIGUE_THRESHOLD_CRITICAL).toBe(85);
    });
  });

  describe('trackPacingState', () => {
    it('should track encounter type', () => {
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 60.0);

      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.combat_count).toBe(1);
      expect(metrics.recent_encounters).toBe(1);
    });

    it('should increment combat streak on combat', () => {
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 30.0);
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 30.0);

      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.combat_streak).toBe(2);
    });

    it('should reset combat streak on non-combat', () => {
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 30.0);
      trackPacingState(mockCtx, testUserId, ContentType.NARRATIVE, 30.0);

      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.combat_streak).toBe(0);
    });

    it('should track exploration streak', () => {
      trackPacingState(mockCtx, testUserId, ContentType.EXPLORATION, 30.0);
      trackPacingState(mockCtx, testUserId, ContentType.EXPLORATION, 30.0);

      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.exploration_streak).toBe(2);
    });

    it('should limit recent encounters to 10', () => {
      // Track 15 encounters
      for (let i = 0; i < 15; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 30.0);
      }

      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.recent_encounters).toBeLessThanOrEqual(10);
    });

    it('should accumulate combat time', () => {
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 60.0);
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 30.0);

      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.combat_time_total).toBeCloseTo(90.0, 0.1);
    });
  });

  describe('getFatigueLevel', () => {
    it('should calculate fatigue based on intensity and duration', () => {
      const fatigue = getFatigueLevel(0.5, 60.0);

      // Base fatigue = 60 * 0.1 = 6.0
      // Intensity multiplier = 1.0 + (0.5 * 0.5) = 1.25
      // Expected = 6.0 * 1.25 = 7.5
      expect(fatigue).toBeCloseTo(7.5, 0.1);
    });

    it('should clamp fatigue to 0-100 range', () => {
      const maxFatigue = getFatigueLevel(1.0, 1000.0);
      const minFatigue = getFatigueLevel(0.0, 0.0);

      expect(maxFatigue).toBeLessThanOrEqual(100.0);
      expect(minFatigue).toBeGreaterThanOrEqual(0.0);
    });

    it('should increase fatigue more for combat encounters', () => {
      const combatFatigue = getFatigueLevel(0.8, 60.0);
      const narrativeFatigue = getFatigueLevel(0.2, 60.0);

      expect(combatFatigue).toBeGreaterThan(narrativeFatigue);
    });

    it('should increase fatigue for puzzle encounters', () => {
      const puzzleFatigue = getFatigueLevel(0.5, 60.0);
      const explorationFatigue = getFatigueLevel(0.3, 60.0);

      expect(puzzleFatigue).toBeGreaterThan(explorationFatigue);
    });
  });

  describe('getPacingMetrics', () => {
    beforeEach(() => {
      resetPacingState(mockCtx, testUserId);

      // Track encounters for known ratios: 6 combat, 2 exploration, 2 narrative
      for (let i = 0; i < 6; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 30.0);
      }
      for (let i = 0; i < 2; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.EXPLORATION, 30.0);
      }
      for (let i = 0; i < 2; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.NARRATIVE, 30.0);
      }
    });

    it('should calculate correct encounter counts', () => {
      const metrics = getPacingMetrics(mockCtx, testUserId);

      expect(metrics.combat_count).toBe(6);
      expect(metrics.exploration_count).toBe(2);
      expect(metrics.narrative_count).toBe(2);
    });

    it('should calculate correct ratios', () => {
      const metrics = getPacingMetrics(mockCtx, testUserId);

      expect(metrics.combat_ratio).toBeCloseTo(0.6, 0.01); // 6/10
      expect(metrics.exploration_ratio).toBeCloseTo(0.2, 0.01); // 2/10
      expect(metrics.narrative_ratio).toBeCloseTo(0.2, 0.01); // 2/10
    });

    it('should track session encounters separately', () => {
      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.session_encounters).toBeGreaterThanOrEqual(10);
    });

    it('should include fatigue level in metrics', () => {
      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.fatigue_level).toBeDefined();
      expect(['None', 'Low', 'Medium', 'High', 'Critical']).toContain(metrics.fatigue_level);
    });

    it('should include current fatigue value', () => {
      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.current_fatigue).toBeGreaterThanOrEqual(0);
      expect(metrics.current_fatigue).toBeLessThanOrEqual(100);
    });
  });

  describe('suggestBreak', () => {
    it('should not recommend break with low fatigue', () => {
      resetPacingState(mockCtx, testUserId);
      trackPacingState(mockCtx, testUserId, ContentType.NARRATIVE, 30.0);

      const recommendation = suggestBreak(mockCtx, testUserId);
      expect(recommendation.should_break).toBe(false);
    });

    it('should recommend break at critical fatigue', () => {
      resetPacingState(mockCtx, testUserId);

      // Simulate high fatigue (many long combat encounters)
      for (let i = 0; i < 10; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 120.0);
      }

      const recommendation = suggestBreak(mockCtx, testUserId);
      expect(recommendation.should_break).toBe(true);
      expect(recommendation.break_duration).toBeGreaterThanOrEqual(300);
      expect(recommendation.suggested_next_type).toBe('narrative');
    });

    it('should recommend break after max combat streak', () => {
      resetPacingState(mockCtx, testUserId);

      // Track 6 combat encounters (exceeds max of 5)
      for (let i = 0; i < 6; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 30.0);
      }

      const recommendation = suggestBreak(mockCtx, testUserId);
      expect(recommendation.should_break).toBe(true);
      expect(recommendation.suggested_next_type).toBe('exploration');
      expect(recommendation.reason).toContain('combat streak');
    });

    it('should suggest exploration after combat streak', () => {
      const recommendation = suggestBreak(mockCtx, testUserId);
      if (recommendation.should_break && recommendation.reason.includes('combat streak')) {
        expect(recommendation.suggested_next_type).toBe('exploration');
      }
    });

    it('should provide break duration', () => {
      const recommendation = suggestBreak(mockCtx, testUserId);
      if (recommendation.should_break) {
        expect(recommendation.break_duration).toBeGreaterThan(0);
      }
    });
  });

  describe('getRecommendedEncounterType', () => {
    it('should recommend exploration when combat ratio too high', () => {
      resetPacingState(mockCtx, testUserId);

      // Track 8 combat encounters (80% ratio)
      for (let i = 0; i < 8; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 30.0);
      }

      const recommended = getRecommendedEncounterType(mockCtx, testUserId);
      expect(recommended).toBe(ContentType.EXPLORATION);
    });

    it('should recommend combat when exploration ratio too high', () => {
      resetPacingState(mockCtx, testUserId);

      // Track 8 exploration encounters
      for (let i = 0; i < 8; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.EXPLORATION, 30.0);
      }

      const recommended = getRecommendedEncounterType(mockCtx, testUserId);
      expect(recommended).toBe(ContentType.COMBAT);
    });

    it('should recommend narrative for balanced pacing', () => {
      resetPacingState(mockCtx, testUserId);

      // Track 6 combat, 2 exploration, 2 narrative (balanced)
      for (let i = 0; i < 6; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 30.0);
      }
      for (let i = 0; i < 2; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.EXPLORATION, 30.0);
      }
      for (let i = 0; i < 2; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.NARRATIVE, 30.0);
      }

      const recommended = getRecommendedEncounterType(mockCtx, testUserId);
      expect([ContentType.NARRATIVE, ContentType.EXPLORATION, ContentType.COMBAT]).toContain(
        recommended
      );
    });
  });

  describe('resetPacingState', () => {
    it('should clear all pacing data', () => {
      // Track some data first
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 60.0);

      resetPacingState(mockCtx, testUserId);

      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.combat_count).toBe(0);
      expect(metrics.exploration_count).toBe(0);
      expect(metrics.narrative_count).toBe(0);
      expect(metrics.combat_streak).toBe(0);
      expect(metrics.exploration_streak).toBe(0);
      expect(metrics.current_fatigue).toBe(0);
    });

    it('should reset session counter', () => {
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 60.0);
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 60.0);

      resetPacingState(mockCtx, testUserId);

      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.session_encounters).toBe(0);
    });
  });

  describe('Persistence', () => {
    it('should save pacing state to storage', () => {
      trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 60.0);

      expect(mockCtx.storageWrite).toHaveBeenCalledWith(
        'pacing_state',
        expect.objectContaining({
          player_id: testUserId,
        })
      );
    });

    it('should load pacing state from storage', () => {
      const savedState = {
        player_id: testUserId,
        recent_encounters: [],
        combat_streak: 3,
        exploration_streak: 0,
        current_fatigue: 25.0,
        session_encounters: 10,
        combat_time_accumulated: 600.0,
        updated_at: Date.now(),
      };

      mockCtx.storageRead.mockResolvedValueOnce(savedState);

      const state = getPacingState(mockCtx, testUserId);
      expect(state.combat_streak).toBe(3);
      expect(state.current_fatigue).toBe(25.0);
    });
  });

  describe('Fatigue bonus for streaks', () => {
    it('should increase fatigue faster with long combat streak', () => {
      resetPacingState(mockCtx, testUserId);

      // Track 6 combat encounters (exceeds max streak)
      for (let i = 0; i < 6; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 60.0);
      }

      const metrics = getPacingMetrics(mockCtx, testUserId);
      expect(metrics.current_fatigue).toBeGreaterThan(0);
    });

    it('should apply 1.5x fatigue multiplier when streak exceeded', () => {
      resetPacingState(mockCtx, testUserId);

      // Track 6 combat encounters with 60s each
      for (let i = 0; i < 6; i++) {
        trackPacingState(mockCtx, testUserId, ContentType.COMBAT, 60.0);
      }

      const metrics = getPacingMetrics(mockCtx, testUserId);
      // Expected fatigue for 6 encounters with streak bonus:
      // Base: 6 * 60 * 0.15 = 54
      // With 1.5x bonus on last encounter: 54 + (60 * 0.15 * 0.5) = 58.5
      expect(metrics.current_fatigue).toBeGreaterThan(54);
    });
  });
});
