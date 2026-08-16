/**
 * Casual rewards guard (issue #872).
 *
 * Ratified rule (CONTEXT.md): Casual PvP never exposes the punch-up wager.
 * Casual = reduced-but-never-negative rewards, no rank or season effect,
 * and no punch-up shaping of any kind.
 *
 * These tests settle casual matches through rpcCompleteMatch — exercising
 * the real reward-composition path (calculateXPGain / calculateMatchRewards)
 * — and assert the settled rewards are punch-up-free even when the
 * server-recorded match flag says is_punch_up: true (the worst case: match
 * creation auto-detects punch-up from rank gap without consulting
 * match_type, so such records can exist).
 */
import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import { rpcCompleteMatch, type PvPMatch } from '../matchmaker';
import { resetRateLimiting, initializeRateLimiting } from '../rate_limit';

// Mock anti_cheat module (same shape as matchmaker.test.ts)
jest.mock('../anti_cheat', () => ({
  isPlayerFlagged: jest.fn(),
  getFlagReason: jest.fn(),
  recordMatchResult: jest.fn(),
  getPlayerMatchHistory: jest.fn(),
}));

// Mock season_system module (Elo/Ladder Rating writes are unit-mocked so we
// can observe whether the settlement path ever touches them for casual).
jest.mock('../season_system', () => ({
  getCurrentSeason: jest.fn(),
  applyEloUpdates: jest.fn(),
  getEloKFactors: jest.fn((isPunchUp: boolean, loserIsUnderdog: boolean) => ({
    winnerK: isPunchUp ? 50 : 32,
    loserK: isPunchUp && loserIsUnderdog ? 100 : isPunchUp ? 50 : 32,
  })),
  getLeaderboardEntry: jest.fn(),
  recordPlayerActivity: jest.fn(),
  applyRankDecay: jest.fn(),
}));

// Mock audit module
jest.mock('../audit', () => ({
  logAudit: jest.fn(),
}));

import { isPlayerFlagged, getFlagReason, recordMatchResult } from '../anti_cheat';
import {
  getCurrentSeason,
  applyEloUpdates,
  getEloKFactors,
  getLeaderboardEntry,
  recordPlayerActivity,
  applyRankDecay,
} from '../season_system';
import { logAudit } from '../audit';

describe('casual rewards guard (issue #872)', () => {
  let mockLogger: any;
  let mockCtx: any;
  let mockNk: any;

  const CREATOR_ID = 'test-user-123';
  const OPPONENT_ID = 'opponent-user';

  /**
   * Active async match fixture. Defaults describe a casual match whose
   * server record carries is_punch_up: true with a rank gap of 10
   * (inside the 5-15 punch-up window, both ranks >= 20) — the worst case
   * for the casual punch-up leak this guard protects against.
   */
  const createActiveMatch = (overrides: Partial<PvPMatch> = {}): PvPMatch => ({
    match_id: 'match_casual_guard',
    creator_id: CREATOR_ID,
    opponent_id: OPPONENT_ID,
    // Rank gap 10: reward_multiplier 1.6x, favorite penalty 0.6x, gem bonus 6
    creator_rank: 40,
    opponent_rank: 50,
    match_type: 'casual',
    is_punch_up: true,
    status: 'active',
    created_at: Date.now() - 10000,
    updated_at: Date.now() - 10000,
    expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
    last_turn_timestamp: Date.now() - 10000,
    current_turn: 1,
    current_player: CREATOR_ID,
    turn_time_limit_ms: 30000,
    creator_health: 100,
    opponent_health: 100,
    max_turns: 10,
    creator_consecutive_timeouts: 0,
    opponent_consecutive_timeouts: 0,
    ...overrides,
  });

  /**
   * Installs a stateful storage mock so settlement writes become visible
   * to subsequent reads (needed for double-settlement verification).
   */
  const installStatefulStorage = (match: PvPMatch) => {
    const stored: Record<string, string> = {
      [`pvp_matches:${match.match_id}`]: JSON.stringify(match),
    };
    mockNk.storageRead = jest.fn((objects: any[]) =>
      objects
        .map((o) => {
          const value = stored[`${o.collection}:${o.key}`];
          return value ? { collection: o.collection, key: o.key, value } : null;
        })
        .filter(Boolean)
    );
    mockNk.storageWrite = jest.fn((writes: any[]) => {
      writes.forEach((w) => {
        stored[`${w.collection}:${w.key}`] = w.value;
      });
      return writes.map((w) => ({ key: w.key, version: '2' }));
    });
    return stored;
  };

  /** Settles a match through the real RPC settlement path. */
  const settleMatch = (match: PvPMatch): any => {
    const result = rpcCompleteMatch(
      mockCtx,
      mockLogger,
      mockNk,
      JSON.stringify({
        match_id: match.match_id,
        winner_id: CREATOR_ID,
        loser_id: OPPONENT_ID,
      })
    );
    return JSON.parse(result);
  };

  beforeEach(() => {
    // Reset rate limiting state before each test to prevent interference
    resetRateLimiting();
    initializeRateLimiting();

    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: CREATOR_ID });
    mockNk = createMockNakama();
    jest.clearAllMocks();

    (isPlayerFlagged as jest.Mock).mockReturnValue(false);
    (getFlagReason as jest.Mock).mockReturnValue('No reason');
    (getCurrentSeason as jest.Mock).mockReturnValue({
      season_id: 'season_1',
      start_time: 0,
      end_time: Date.now() + 86400000,
    });
    (getLeaderboardEntry as jest.Mock).mockReturnValue(null);
    (applyEloUpdates as jest.Mock).mockReturnValue({
      winnerNewElo: 1210,
      loserNewElo: 1140,
    });
    (recordPlayerActivity as jest.Mock).mockImplementation();
    (applyRankDecay as jest.Mock).mockImplementation((_nk: any, _userId: string, rank: number) => rank);
    (logAudit as jest.Mock).mockImplementation();
    (recordMatchResult as jest.Mock).mockImplementation();
  });

  describe('punch-up-free casual rewards', () => {
    it('applies no punch-up XP multiplier, favorite penalty, or gem bonus when the underdog wins a punch-up-flagged casual match', () => {
      // Creator (rank 40, underdog) defeats opponent (rank 50, favorite).
      // If punch-up leaked into casual: winner XP would be 80 (50 x 1.6),
      // winner would receive 6 gems, and the favorite loser's coins would
      // drop to 3 (5 x 0.6).
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const parsed = settleMatch(match);

      expect(parsed.success).toBe(true);
      expect(parsed.is_punch_up).toBe(true); // stored flag remains recorded...
      expect(parsed.winner.xp_gained).toBe(50); // ...but casual XP is unamplified
      expect(parsed.loser.xp_gained).toBe(15); // favorite loss penalty would give 9

      const winnerCoinReward = parsed.winner.rewards.find((r: any) => r.type === 'coin');
      const loserCoinReward = parsed.loser.rewards.find((r: any) => r.type === 'coin');
      expect(winnerCoinReward.quantity).toBe(25); // favorite penalty would give 15
      expect(loserCoinReward.quantity).toBe(5); // favorite penalty would give 3

      // No gem reward may exist in a casual settlement
      const allRewards = [...parsed.winner.rewards, ...parsed.loser.rewards];
      expect(allRewards.some((r: any) => r.type === 'gem')).toBe(false);
    });

    it('keeps full casual loss XP for the underdog when losing a punch-up-flagged casual match', () => {
      // Opponent (rank 50, favorite) defeats creator (rank 40, underdog).
      // If the punch-up-loss reduction leaked into casual: loser XP would
      // be max(1, round(15 x 0.5)) = 8 instead of the casual loss baseline.
      const match = createActiveMatch({ creator_health: 0 });
      installStatefulStorage(match);

      const parsed = settleMatch(match);

      expect(parsed.success).toBe(true);
      expect(parsed.loser.user_id).toBe(CREATOR_ID); // underdog lost
      expect(parsed.loser.xp_gained).toBe(15); // punch-up-loss reduction would give 8
      expect(parsed.winner.xp_gained).toBe(50); // favorite penalty would give 30

      const winnerCoinReward = parsed.winner.rewards.find((r: any) => r.type === 'coin');
      const loserCoinReward = parsed.loser.rewards.find((r: any) => r.type === 'coin');
      expect(winnerCoinReward.quantity).toBe(25); // favorite penalty would give 15
      expect(loserCoinReward.quantity).toBe(5);

      const allRewards = [...parsed.winner.rewards, ...parsed.loser.rewards];
      expect(allRewards.some((r: any) => r.type === 'gem')).toBe(false);
    });

    it('never writes gems to the wallet when settling a punch-up-flagged casual match', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const parsed = settleMatch(match);

      expect(parsed.success).toBe(true);
      const walletCalls = (mockNk.walletUpdate as jest.Mock).mock.calls as Array<
        [string, Record<string, number>]
      >;
      expect(walletCalls.length).toBeGreaterThan(0);
      for (const [, changes] of walletCalls) {
        expect(changes).not.toHaveProperty('gems');
      }
    });
  });

  describe('reduced-but-never-negative casual rewards vs ranked baseline', () => {
    it('awards strictly less XP and Coins than the identical ranked match, and never zero or negative', () => {
      // Identical non-punch-up match shape (rank gap 2, outside the 5-15
      // punch-up window) settled once per mode isolates the mode effect.
      const rankedMatch = createActiveMatch({
        match_id: 'match_baseline_ranked',
        match_type: 'ranked',
        is_punch_up: false,
        opponent_rank: 42,
        opponent_health: 0,
      });
      installStatefulStorage(rankedMatch);
      const ranked = settleMatch(rankedMatch);

      resetRateLimiting();
      initializeRateLimiting();

      const casualMatch = createActiveMatch({
        match_id: 'match_baseline_casual',
        match_type: 'casual',
        is_punch_up: false,
        opponent_rank: 42,
        opponent_health: 0,
      });
      installStatefulStorage(casualMatch);
      const casual = settleMatch(casualMatch);

      expect(ranked.success).toBe(true);
      expect(casual.success).toBe(true);

      // Reduced: casual rewards are strictly below the ranked baseline
      expect(casual.winner.xp_gained).toBeLessThan(ranked.winner.xp_gained);
      expect(casual.loser.xp_gained).toBeLessThan(ranked.loser.xp_gained);
      const casualWinCoins = casual.winner.rewards.find((r: any) => r.type === 'coin').quantity;
      const casualLossCoins = casual.loser.rewards.find((r: any) => r.type === 'coin').quantity;
      const rankedWinCoins = ranked.winner.rewards.find((r: any) => r.type === 'coin').quantity;
      const rankedLossCoins = ranked.loser.rewards.find((r: any) => r.type === 'coin').quantity;
      expect(casualWinCoins).toBeLessThan(rankedWinCoins);
      expect(casualLossCoins).toBeLessThan(rankedLossCoins);

      // Never negative (and never zero): casual always grants progression
      expect(casual.winner.xp_gained).toBeGreaterThan(0);
      expect(casual.loser.xp_gained).toBeGreaterThan(0);
      expect(casualWinCoins).toBeGreaterThan(0);
      expect(casualLossCoins).toBeGreaterThan(0);

      // Exact composition: 50% of ranked win/loss XP and Coins
      expect(casual.winner.xp_gained).toBe(50);
      expect(casual.loser.xp_gained).toBe(15);
      expect(casualWinCoins).toBe(25);
      expect(casualLossCoins).toBe(5);
    });
  });

  describe('no Ladder Rating effect in casual', () => {
    it('skips Elo updates and K-factor application entirely for a punch-up-flagged casual match', () => {
      const match = createActiveMatch({ opponent_health: 0 });
      installStatefulStorage(match);

      const parsed = settleMatch(match);

      expect(parsed.success).toBe(true);
      // The ranked settlement path (Elo writes + K-factor selection) is skipped
      expect(applyEloUpdates).not.toHaveBeenCalled();
      expect(getEloKFactors).not.toHaveBeenCalled();
      // No rank movement for either side
      expect(parsed.winner.rank_change).toBe(0);
      expect(parsed.loser.rank_change).toBe(0);
    });
  });
});
