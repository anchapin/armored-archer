/**
 * Dynamic Difficulty module tests.
 * Tests for win/lose streak tracking, difficulty modifiers, and performance ratings.
 *
 * Since #870 the module is server-authoritative: PvE wins only count when
 * corroborated by server-known stage results (the `stage_completion`
 * storage written by the validated `complete_stage` RPC), so tests that
 * expect wins to count must seed completions via `seedStageCompletions`.
 * Losses remain client hints (no server-side loss signal exists) and PvP
 * outcomes never affect the modifier (PvE-only constraint).
 */
import {
  trackMatchOutcome,
  getDifficultyModifier,
  getDifficultyLevelString,
  getPerformanceRating,
  getWinRate,
  calculateTargetDifficulty,
  getEncounterRewardModifier,
  resetDifficulty,
  setDifficultyModifier,
  getDifficultyState,
  rpcTrackMatchOutcome,
  rpcGetPlayerPerformance,
  rpcSyncDifficulty,
} from '../dynamic_difficulty';
import { rpcCompleteStage } from '../stage_tracking';
import { Runtime } from '../../types/nakama';

/** Silent logger stub for RPC-level tests. */
const silentLogger: Runtime.Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

describe('DynamicDifficulty', () => {
  let mockCtx: Partial<Runtime>;
  let testUserId = 'test-user-123';
  // In-memory storage for testing
  const storage = new Map();

  beforeEach(() => {
    // Clear storage before each test
    storage.clear();

    // Create mock that maintains state (pattern from combat_system.test.ts)
    const mockStorageRead = jest.fn((objects: any) => {
      return objects
        .map((obj: any) => {
          const val = storage.get(`${obj.collection}:${obj.key}`);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        })
        .filter(Boolean);
    });

    const mockStorageWrite = jest.fn((objects: any) => {
      objects.forEach((obj: any) => {
        storage.set(`${obj.collection}:${obj.key}`, obj.value);
      });
      return Promise.resolve(undefined);
    });

    mockCtx = {
      storageWrite: mockStorageWrite,
      storageRead: mockStorageRead,
      storageList: jest.fn().mockResolvedValue([]),
      env: {},
    } as any;

    // Reset difficulty state before each test (this writes to storage)
    resetDifficulty(mockCtx, testUserId);
  });

  // Helper to get the internal storage map
  function getInternalStorage() {
    return storage;
  }

  /**
   * Seeds the authoritative server-side stage completion storage with
   * accepted completion events (the server-known PvE results).
   *
   * @param stageIds - Stages the server has accepted completions for
   * @param ageSeconds - Age of the completion events (default: just now)
   */
  function seedStageCompletions(stageIds: string[], ageSeconds: number = 0): void {
    const ts = new Date(Date.now() - ageSeconds * 1000).toISOString();
    const completions: Record<string, unknown> = {};
    for (const stageId of stageIds) {
      completions[stageId] = {
        stage_id: stageId,
        stage_prefix: 'c1',
        stars_earned: 3,
        score: 100,
        completed_at: ts,
        updated_at: ts,
      };
    }
    storage.set(
      `stage_completion:${testUserId}`,
      JSON.stringify({ user_id: testUserId, completions })
    );
  }

  /**
   * Simulates the server accepting an improved replay of a stage: refreshes
   * `updated_at` on the stored completion record (exactly what
   * `complete_stage` does for an accepted improvement).
   */
  function refreshStageCompletion(stageId: string): void {
    const raw = storage.get(`stage_completion:${testUserId}`);
    const parsed = raw ? JSON.parse(raw) : { user_id: testUserId, completions: {} };
    const record = parsed.completions[stageId];
    if (!record) {
      throw new Error(`refreshStageCompletion: stage ${stageId} not seeded`);
    }
    record.updated_at = new Date().toISOString();
    storage.set(`stage_completion:${testUserId}`, JSON.stringify(parsed));
  }

  describe('trackMatchOutcome', () => {
    it('should increment win streak on a server-corroborated win', () => {
      seedStageCompletions(['stage_1']);
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      const state = getDifficultyState(mockCtx, testUserId);

      expect(state.win_streak).toBe(1);
      expect(state.lose_streak).toBe(0);
    });

    it('should not count a PvE win without server-side corroboration', () => {
      // No stage completions seeded — the server knows of no stage results.
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      const state = getDifficultyState(mockCtx, testUserId);

      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(0);
      // The hint is still recorded for analytics.
      expect(state.match_history.length).toBe(1);
      expect(state.match_history[0].verified).toBe(false);
      expect(state.match_history[0].counted).toBe(false);
    });

    it('should increment lose streak on loss', () => {
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      const state = getDifficultyState(mockCtx, testUserId);

      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(1);
    });

    it('should reset win streak on loss', () => {
      seedStageCompletions(['stage_1']);
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(1);
    });

    it('should reset lose streak on a corroborated win', () => {
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      seedStageCompletions(['stage_1']);
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(1);
      expect(state.lose_streak).toBe(0);
    });

    it('should treat an uncorroborated win report as transparent', () => {
      // Two counted losses, then an unverified win: the hint must neither
      // extend a win streak nor reset the lose streak.
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(2);
    });

    it('should track match history', () => {
      for (let i = 0; i < 5; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: i % 2 === 0, match_type: 'pve' });
      }

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.match_history.length).toBe(5);
    });

    it('should limit history to 100 matches', () => {
      for (let i = 0; i < 110; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.match_history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Server-side streak re-derivation (#870)', () => {
    it('should verify a PvE win against server-known stage results', () => {
      seedStageCompletions(['stage_1']);
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.match_history[0].verified).toBe(true);
      expect(state.match_history[0].counted).toBe(true);
    });

    it('should consume a completion event: one event verifies one report', () => {
      seedStageCompletions(['stage_1']);

      // First report is corroborated.
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      // Replaying the report gains nothing — evidence already consumed.
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(1);
      expect(state.current_modifier).toBe(0.0);
    });

    it('should not corroborate with a completion older than the evidence window', () => {
      seedStageCompletions(['stage_1'], 31 * 60); // 31 minutes ago (window is 30)
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(0);
      expect(state.match_history[0].verified).toBe(false);
    });

    it('should corroborate again after the server accepts an improved replay', () => {
      // Seed one minute in the past so the refreshed timestamp is strictly newer.
      seedStageCompletions(['stage_1'], 60);
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      // Server accepts an improved replay -> updated_at refreshes.
      refreshStageCompletion('stage_1');
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(2);
    });

    it('should re-derive streaks from the ledger, ignoring drifted persisted streaks', () => {
      // Simulate stale/corrupted persisted streak fields (client-truth era).
      getInternalStorage().set(
        `difficulty_state:${testUserId}`,
        JSON.stringify({
          player_id: testUserId,
          current_modifier: 0.0,
          win_streak: 99,
          lose_streak: 0,
          updated_at: Math.floor(Date.now() / 1000),
          last_adjusted_seq: 0,
          corroborated_completions: {},
        })
      );

      seedStageCompletions(['stage_1']);
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      // The derived streak comes from the ledger (1 entry), not 99 + 1.
      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(1);
    });

    it('should treat legacy pre-hardening history entries as non-counted', () => {
      // Legacy entries lack seq/verified/counted and must never count.
      getInternalStorage().set(
        `match_history:${testUserId}`,
        JSON.stringify([
          {
            match_id: 'legacy-1',
            won: true,
            match_type: 'pve',
            timestamp: Math.floor(Date.now() / 1000) - 100,
            base_difficulty: 0.0,
          },
        ])
      );

      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(1); // Only the new server-classified entry.
    });
  });

  describe('PvE-only enforcement', () => {
    it('should record PvP outcomes without affecting streaks or modifier', () => {
      for (let i = 0; i < 5; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pvp' });
      }

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(0);
      expect(state.current_modifier).toBe(0.0);
      // Still recorded for analytics.
      expect(state.match_history.length).toBe(5);
      expect(state.match_history.every((m) => m.counted === false)).toBe(true);
    });

    it('should not let PvP wins trigger difficulty adjustments', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.1);

      for (let i = 0; i < 10; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pvp' });
      }

      expect(getDifficultyModifier(mockCtx, testUserId)).toBe(0.1);
    });

    it('should not let PvP losses change the modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.15);

      for (let i = 0; i < 10; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pvp' });
      }

      expect(getDifficultyModifier(mockCtx, testUserId)).toBe(0.15);
    });
  });

  describe('Difficulty adjustment on streaks', () => {
    it('should increase difficulty after 3+ corroborated win streak', () => {
      const initialModifier = getDifficultyModifier(mockCtx, testUserId);

      // Three server-accepted stage completions, three reported wins.
      seedStageCompletions(['stage_1', 'stage_2', 'stage_3']);
      for (let i = 0; i < 3; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      const newModifier = getDifficultyModifier(mockCtx, testUserId);
      expect(newModifier).toBeGreaterThan(initialModifier);
    });

    it('should decrease difficulty after 3+ lose streak', () => {
      // Set to higher difficulty first
      setDifficultyModifier(mockCtx, testUserId, 0.15);

      const initialModifier = getDifficultyModifier(mockCtx, testUserId);

      // Track 3 losses
      for (let i = 0; i < 3; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const newModifier = getDifficultyModifier(mockCtx, testUserId);
      expect(newModifier).toBeLessThan(initialModifier);
    });

    it('should not increase difficulty below threshold', () => {
      // Two server-accepted completions: verified streak of 2 (< threshold).
      seedStageCompletions(['stage_1', 'stage_2']);
      for (let i = 0; i < 2; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBe(0.0); // Should remain at normal
    });

    it('should not increase difficulty from uncorroborated win reports', () => {
      // No completions seeded: spamming win reports must never adjust.
      for (let i = 0; i < 25; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBe(0.0);
    });

    it('should not decrease difficulty below threshold', () => {
      // Set to higher difficulty first
      setDifficultyModifier(mockCtx, testUserId, 0.1);

      // Track only 2 losses (below threshold)
      for (let i = 0; i < 2; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBe(0.1); // Should remain unchanged
    });
  });

  describe('Difficulty modifier limits', () => {
    it('should not exceed +20% (0.20)', () => {
      // Ten server-accepted completions, ten corroborated wins.
      seedStageCompletions([
        'stage_1',
        'stage_2',
        'stage_3',
        'stage_4',
        'stage_5',
        'stage_6',
        'stage_7',
        'stage_8',
        'stage_9',
        'stage_10',
      ]);
      for (let i = 0; i < 10; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBeLessThanOrEqual(0.2);
    });

    it('should not go below -20% (-0.20)', () => {
      // Set to high difficulty first
      setDifficultyModifier(mockCtx, testUserId, 0.15);

      // Track many consecutive losses
      for (let i = 0; i < 10; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBeGreaterThanOrEqual(-0.2);
    });

    it('should clamp to valid range', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.3); // Try to set above max
      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBe(0.2);

      setDifficultyModifier(mockCtx, testUserId, -0.3); // Try to set below min
      const modifier2 = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier2).toBe(-0.2);
    });
  });

  describe('getDifficultyLevelString', () => {
    it('should return "Easy" for -20% modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, -0.2);
      const level = getDifficultyLevelString(mockCtx, testUserId);
      expect(level).toBe('Easy');
    });

    it('should return "Normal" for 0% modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.0);
      const level = getDifficultyLevelString(mockCtx, testUserId);
      expect(level).toBe('Normal');
    });

    it('should return "Hard" for +10% modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.1);
      const level = getDifficultyLevelString(mockCtx, testUserId);
      expect(level).toBe('Hard');
    });

    it('should return "Extreme" for +20% modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.2);
      const level = getDifficultyLevelString(mockCtx, testUserId);
      expect(level).toBe('Extreme');
    });
  });

  describe('getPerformanceRating', () => {
    it('should return "Excellent" for 80%+ win rate', () => {
      // Track 8 wins, 2 losses (all recorded for analytics win rate)
      for (let i = 0; i < 8; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 2; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Excellent');
    });

    it('should return "Good" for 60-79% win rate', () => {
      resetDifficulty(mockCtx, testUserId);

      // Track 6 wins, 4 losses
      for (let i = 0; i < 6; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 4; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Good');
    });

    it('should return "Average" for 40-59% win rate', () => {
      resetDifficulty(mockCtx, testUserId);

      // Track 5 wins, 5 losses
      for (let i = 0; i < 5; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 5; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Average');
    });

    it('should return "Poor" for <40% win rate', () => {
      resetDifficulty(mockCtx, testUserId);

      // Track 3 wins, 7 losses
      for (let i = 0; i < 3; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 7; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Poor');
    });

    it('should return "Poor" with no match history', () => {
      resetDifficulty(mockCtx, testUserId);
      const rating = getPerformanceRating(mockCtx, testUserId);
      expect(rating).toBe('Poor');
    });
  });

  describe('getWinRate', () => {
    it('should calculate win rate from recent matches', () => {
      // Track 10 matches: 7 wins, 3 losses
      for (let i = 0; i < 7; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 3; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const winRate = getWinRate(mockCtx, testUserId, 10);
      expect(winRate).toBeCloseTo(0.7, 0.01);
    });

    it('should support custom window size', () => {
      // Track 20 matches
      for (let i = 0; i < 14; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }
      for (let i = 0; i < 6; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      }

      const winRate5 = getWinRate(mockCtx, testUserId, 5);
      const winRate10 = getWinRate(mockCtx, testUserId, 10);
      const winRate20 = getWinRate(mockCtx, testUserId, 20);

      expect(winRate5).toBeGreaterThanOrEqual(0);
      expect(winRate10).toBeGreaterThanOrEqual(0);
      expect(winRate20).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 with no match history', () => {
      resetDifficulty(mockCtx, testUserId);
      const winRate = getWinRate(mockCtx, testUserId, 10);
      expect(winRate).toBe(0);
    });
  });

  describe('calculateTargetDifficulty', () => {
    it('should apply modifier to base difficulty', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.0);
      const target = calculateTargetDifficulty(mockCtx, testUserId, 0.5);
      expect(target).toBeCloseTo(0.5, 0.01);
    });

    it('should increase difficulty with positive modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.2);
      const target = calculateTargetDifficulty(mockCtx, testUserId, 0.5);
      expect(target).toBeCloseTo(0.6, 0.01);
    });

    it('should decrease difficulty with negative modifier', () => {
      setDifficultyModifier(mockCtx, testUserId, -0.2);
      const target = calculateTargetDifficulty(mockCtx, testUserId, 0.5);
      expect(target).toBeCloseTo(0.4, 0.01);
    });

    it('should clamp to maximum of 1.5', () => {
      const target = calculateTargetDifficulty(mockCtx, testUserId, 1.0, 0.2);
      expect(target).toBeLessThanOrEqual(1.5);
    });

    it('should clamp to minimum of 0.0', () => {
      const target = calculateTargetDifficulty(mockCtx, testUserId, 0.5, -0.2);
      expect(target).toBeGreaterThanOrEqual(0.0);
    });
  });

  describe('getEncounterRewardModifier (reward neutrality)', () => {
    it('should return exactly 1.0x for Easy difficulty — rewards are neutral', () => {
      setDifficultyModifier(mockCtx, testUserId, -0.2);
      const modifier = getEncounterRewardModifier(mockCtx, testUserId);
      expect(modifier).toBe(1.0);
    });

    it('should return exactly 1.0x for Normal difficulty', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.0);
      const modifier = getEncounterRewardModifier(mockCtx, testUserId);
      expect(modifier).toBe(1.0);
    });

    it('should return exactly 1.0x for Hard difficulty — no reward inflation', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.1);
      const modifier = getEncounterRewardModifier(mockCtx, testUserId);
      expect(modifier).toBe(1.0);
    });

    it('should return exactly 1.0x for Extreme difficulty — no reward inflation', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.2);
      const modifier = getEncounterRewardModifier(mockCtx, testUserId);
      expect(modifier).toBe(1.0);
    });
  });

  describe('Reward neutrality regression (loot path)', () => {
    const stagePayload = JSON.stringify({
      stage_id: 'stage_neutrality_1',
      stage_prefix: 'c1',
      stars_earned: 3,
      score: 500,
      difficulty: 'hard',
      boss_defeated: true,
      boss_id: 'boss_neutrality',
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should produce identical loot for the same stage regardless of modifier', () => {
      // Deterministic RNG + clock so loot decisions depend only on inputs.
      jest.spyOn(Math, 'random').mockReturnValue(0.42);
      jest.spyOn(Date, 'now').mockReturnValue(1755300000000);

      // Two players at opposite ends of the dynamic modifier.
      setDifficultyModifier(mockCtx, 'loot-user-easy', -0.2);
      setDifficultyModifier(mockCtx, 'loot-user-hard', 0.2);

      const ctxEasy = { userId: 'loot-user-easy', ipAddress: '127.0.0.1' } as Runtime.Context;
      const ctxHard = { userId: 'loot-user-hard', ipAddress: '127.0.0.1' } as Runtime.Context;

      const resEasy = JSON.parse(
        rpcCompleteStage(ctxEasy, silentLogger, mockCtx as unknown as Runtime.Nakama, stagePayload)
      );
      const resHard = JSON.parse(
        rpcCompleteStage(ctxHard, silentLogger, mockCtx as unknown as Runtime.Nakama, stagePayload)
      );

      expect(resEasy.success).toBe(true);
      expect(resHard.success).toBe(true);
      // Same stage, same rewards — the modifier must never change loot.
      expect(resEasy.drop_rate).toBe(resHard.drop_rate);
      expect(resEasy.loot).toEqual(resHard.loot);
    });

    it('should never read difficulty state while completing a stage', () => {
      setDifficultyModifier(mockCtx, 'loot-user-spy', 0.2);

      const ctx = { userId: 'loot-user-spy', ipAddress: '127.0.0.1' } as Runtime.Context;
      const res = JSON.parse(
        rpcCompleteStage(
          ctx,
          silentLogger,
          mockCtx as unknown as Runtime.Nakama,
          stagePayload.replace('stage_neutrality_1', 'stage_neutrality_2')
        )
      );
      expect(res.success).toBe(true);

      const readCalls = (mockCtx.storageRead as jest.Mock).mock.calls.flat();
      const difficultyReads = readCalls.filter(
        (obj: any) => obj.collection === 'difficulty_state'
      );
      expect(difficultyReads).toEqual([]);
    });
  });

  describe('track_match_outcome RPC', () => {
    function rpcContext(): Runtime.Context {
      return { userId: testUserId, ipAddress: '127.0.0.1' } as Runtime.Context;
    }

    it('should disclose verification status in the response', () => {
      const response = JSON.parse(
        rpcTrackMatchOutcome(
          rpcContext(),
          silentLogger,
          mockCtx as unknown as Runtime.Nakama,
          JSON.stringify({ match_id: 'm1', won: true, match_type: 'pve', duration: 120 })
        )
      );

      expect(response.success).toBe(true);
      expect(response.verified).toBe(false); // No server-side evidence.
      expect(response.counted).toBe(false);
      expect(response.win_streak).toBe(0);
      expect(response.modifier).toBe(0.0);
    });

    it('should count a corroborated win via the RPC', () => {
      seedStageCompletions(['stage_rpc_1']);
      const response = JSON.parse(
        rpcTrackMatchOutcome(
          rpcContext(),
          silentLogger,
          mockCtx as unknown as Runtime.Nakama,
          JSON.stringify({ match_id: 'm2', won: true, match_type: 'pve', duration: 120 })
        )
      );

      expect(response.verified).toBe(true);
      expect(response.counted).toBe(true);
      expect(response.win_streak).toBe(1);
    });

    it('should reject invalid payloads', () => {
      const response = JSON.parse(
        rpcTrackMatchOutcome(
          rpcContext(),
          silentLogger,
          mockCtx as unknown as Runtime.Nakama,
          JSON.stringify({ match_id: '', won: true, match_type: 'pve', duration: -5 })
        )
      );

      expect(response.success).toBe(false);
      expect(response.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('get_player_performance RPC', () => {
    it('should re-derive streaks from the ledger instead of persisted fields', () => {
      seedStageCompletions(['stage_perf_1']);
      trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });

      // Corrupt the persisted streak cache; the RPC must re-derive.
      const state = getDifficultyState(mockCtx, testUserId);
      state.win_streak = 77;
      getInternalStorage().set(`difficulty_state:${testUserId}`, JSON.stringify(state));

      const response = JSON.parse(
        rpcGetPlayerPerformance(
          { userId: testUserId, ipAddress: '127.0.0.1' } as Runtime.Context,
          silentLogger,
          mockCtx as unknown as Runtime.Nakama,
          ''
        )
      );

      expect(response.win_streak).toBe(1);
      expect(response.lose_streak).toBe(0);
      expect(response.matches_tracked).toBe(1);
    });
  });

  describe('sync_difficulty hint semantics (#870)', () => {
    it('should record the client hint without changing the server-derived state', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.1);
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });

      const response = JSON.parse(
        rpcSyncDifficulty(
          { userId: testUserId, ipAddress: '127.0.0.1' } as Runtime.Context,
          silentLogger,
          mockCtx as unknown as Runtime.Nakama,
          JSON.stringify({ difficulty_modifier: 0.2, difficulty_level: 'Extreme' })
        )
      );

      expect(response.success).toBe(true);
      expect(response.synced).toBe(true);
      // The server-derived modifier is disclosed, not the client's claim.
      expect(response.modifier).toBe(0.1);
      expect(response.difficulty_level).toBe('Hard');

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.current_modifier).toBe(0.1); // Unchanged by the sync.
      expect(state.lose_streak).toBe(1); // Streaks untouched.
      expect(state.client_reported_modifier).toBe(0.2); // Hint recorded.
      expect(state.client_reported_level).toBe('Extreme');
    });

    it('should reject a hint whose modifier does not match its level', () => {
      const response = JSON.parse(
        rpcSyncDifficulty(
          { userId: testUserId, ipAddress: '127.0.0.1' } as Runtime.Context,
          silentLogger,
          mockCtx as unknown as Runtime.Nakama,
          JSON.stringify({ difficulty_modifier: 0.2, difficulty_level: 'Easy' })
        )
      );

      expect(response.error).toBeDefined();
    });
  });

  describe('resetDifficulty', () => {
    it('should reset modifier to 0.0', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.15);
      resetDifficulty(mockCtx, testUserId);

      const modifier = getDifficultyModifier(mockCtx, testUserId);
      expect(modifier).toBe(0.0);
    });

    it('should reset streaks to 0', () => {
      // Build streaks first
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });
      trackMatchOutcome(mockCtx, testUserId, { won: false, match_type: 'pve' });

      resetDifficulty(mockCtx, testUserId);
      const state = getDifficultyState(mockCtx, testUserId);

      expect(state.win_streak).toBe(0);
      expect(state.lose_streak).toBe(0);
    });

    it('should clear match history', () => {
      // Add some history first
      for (let i = 0; i < 5; i++) {
        trackMatchOutcome(mockCtx, testUserId, { won: true, match_type: 'pve' });
      }

      resetDifficulty(mockCtx, testUserId);
      const state = getDifficultyState(mockCtx, testUserId);

      expect(state.match_history).toEqual([]);
    });
  });

  describe('Persistence', () => {
    it('should save difficulty state to storage', () => {
      setDifficultyModifier(mockCtx, testUserId, 0.1);

      expect(mockCtx.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'difficulty_state',
          key: testUserId,
          value: expect.stringContaining('current_modifier'),
        }),
      ]);
    });

    it('should load difficulty state from storage', () => {
      const savedState = {
        player_id: testUserId,
        current_modifier: 0.15,
        win_streak: 3,
        lose_streak: 0,
        match_history: [],
        updated_at: Date.now(),
      };

      // Directly set storage to simulate pre-existing state
      getInternalStorage().set(`difficulty_state:${testUserId}`, JSON.stringify(savedState));

      const state = getDifficultyState(mockCtx, testUserId);
      expect(state.current_modifier).toBe(0.15);
      expect(state.win_streak).toBe(3);
    });
  });
});
