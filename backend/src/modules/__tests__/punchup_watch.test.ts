/**
 * Unit tests for the LC-T3 punch-up wager abuse watch (issue #864).
 */
import {
  recordPunchUpLossAndEvaluate,
  resetPunchUpWatchState,
  PUNCH_UP_WATCH_WINDOW_MS,
  PAIR_FARMING_MIN_LOSSES,
  ABNORMAL_FREQUENCY_MIN_LOSSES,
} from '../punchup_watch';

describe('punchup_watch', () => {
  const BASE_TIME = 1_800_000_000_000;

  const recordLoss = (
    winnerId: string,
    loserId: string,
    timestamp: number,
    matchId = `match_${timestamp}_${loserId}`
  ) => recordPunchUpLossAndEvaluate({ matchId, winnerId, loserId, timestamp });

  beforeEach(() => {
    resetPunchUpWatchState();
  });

  describe('normal play (no false flags)', () => {
    it('does not flag an isolated punch-up loss', () => {
      const verdict = recordLoss('favorite-a', 'underdog-a', BASE_TIME);

      expect(verdict.flagged).toBe(false);
      expect(verdict.reason).toBe('none');
      expect(verdict.pairLossCount).toBe(1);
      expect(verdict.playerLossCount).toBe(1);
    });

    it('does not flag losses spread across different opponents under the frequency bar', () => {
      let verdict = recordLoss('favorite-a', 'underdog-a', BASE_TIME).flagged;
      expect(verdict).toBe(false);

      for (let i = 1; i < ABNORMAL_FREQUENCY_MIN_LOSSES - 1; i++) {
        verdict = recordLoss(`favorite-${i}`, 'underdog-a', BASE_TIME + i * 60_000).flagged;
        expect(verdict).toBe(false);
      }
    });

    it('does not count records outside the observation window', () => {
      // Pair losses spaced beyond the 24h window never accumulate
      recordLoss('favorite-a', 'underdog-a', BASE_TIME);
      const staleTime = BASE_TIME + PUNCH_UP_WATCH_WINDOW_MS + 1;
      const verdict = recordLoss('favorite-a', 'underdog-a', staleTime);

      expect(verdict.flagged).toBe(false);
      expect(verdict.pairLossCount).toBe(1);
    });

    it('does not flag two same-pair losses (below the farming bar)', () => {
      recordLoss('favorite-a', 'underdog-a', BASE_TIME);
      const verdict = recordLoss('favorite-a', 'underdog-a', BASE_TIME + 3_600_000);

      expect(verdict.flagged).toBe(false);
      expect(verdict.pairLossCount).toBe(2);
    });
  });

  describe('pair farming detection', () => {
    it('flags repeated same-pair punch-up losses within the window', () => {
      recordLoss('favorite-a', 'underdog-a', BASE_TIME);
      recordLoss('favorite-a', 'underdog-a', BASE_TIME + 3_600_000);
      const verdict = recordLoss('favorite-a', 'underdog-a', BASE_TIME + 7_200_000);

      expect(verdict.flagged).toBe(true);
      expect(verdict.reason).toBe('pair_farming');
      expect(verdict.pairLossCount).toBe(PAIR_FARMING_MIN_LOSSES);
      expect(verdict.playerLossCount).toBe(PAIR_FARMING_MIN_LOSSES);
    });

    it('does not pair-count matches the loser lost against other winners', () => {
      recordLoss('favorite-a', 'underdog-a', BASE_TIME);
      recordLoss('favorite-b', 'underdog-a', BASE_TIME + 60_000);
      const verdict = recordLoss('favorite-a', 'underdog-a', BASE_TIME + 120_000);

      expect(verdict.flagged).toBe(false);
      expect(verdict.pairLossCount).toBe(2);
      expect(verdict.playerLossCount).toBe(3);
    });
  });

  describe('abnormal frequency detection', () => {
    it('flags a single player accruing abnormal punch-up loss volume', () => {
      let verdict = recordLoss('favorite-0', 'grinder', BASE_TIME);
      for (let i = 1; i < ABNORMAL_FREQUENCY_MIN_LOSSES - 1; i++) {
        verdict = recordLoss(`favorite-${i}`, 'grinder', BASE_TIME + i * 60_000);
        expect(verdict.flagged).toBe(false);
      }

      verdict = recordLoss(
        `favorite-${ABNORMAL_FREQUENCY_MIN_LOSSES - 1}`,
        'grinder',
        BASE_TIME + (ABNORMAL_FREQUENCY_MIN_LOSSES - 1) * 60_000
      );

      expect(verdict.flagged).toBe(true);
      expect(verdict.reason).toBe('loss_frequency');
      expect(verdict.playerLossCount).toBe(ABNORMAL_FREQUENCY_MIN_LOSSES);
    });

    it('reports a combined reason when both heuristics trigger', () => {
      // Same pair all the way to the frequency bar as well
      for (let i = 0; i < ABNORMAL_FREQUENCY_MIN_LOSSES - 1; i++) {
        recordLoss('favorite-a', 'underdog-a', BASE_TIME + i * 60_000);
      }
      const verdict = recordLoss(
        'favorite-a',
        'underdog-a',
        BASE_TIME + (ABNORMAL_FREQUENCY_MIN_LOSSES - 1) * 60_000
      );

      expect(verdict.flagged).toBe(true);
      expect(verdict.reason).toBe('pair_farming+loss_frequency');
    });
  });

  describe('state reset', () => {
    it('clears observation history', () => {
      recordLoss('favorite-a', 'underdog-a', BASE_TIME);
      recordLoss('favorite-a', 'underdog-a', BASE_TIME + 60_000);
      resetPunchUpWatchState();

      const verdict = recordLoss('favorite-a', 'underdog-a', BASE_TIME + 120_000);

      expect(verdict.flagged).toBe(false);
      expect(verdict.pairLossCount).toBe(1);
      expect(verdict.playerLossCount).toBe(1);
    });
  });

  describe('verdict metadata', () => {
    it('reports the configured window', () => {
      const verdict = recordLoss('favorite-a', 'underdog-a', BASE_TIME);
      expect(verdict.windowMs).toBe(PUNCH_UP_WATCH_WINDOW_MS);
    });
  });
});
