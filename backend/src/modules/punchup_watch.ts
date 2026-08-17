/**
 * Punch-Up Loss Watch (LC-T3).
 * @fileoverview Server-side anomaly detection for "punch-up wager abuse"
 * (docs/LAUNCH_PATH_DECISION.md launch criterion LC-T3).
 *
 * The amplified punch-up loss (issue #864, 2x K-factor deduction) also
 * amplifies win-trading value: a cooperating pair can farm the favorite's
 * ladder rating by repeatedly feeding punch-up wins, and a single account
 * can tank/boost via abnormal punch-up frequency. This module records
 * settled punch-up losses and FLAGS statistically anomalous patterns.
 *
 * This is a WATCH, not enforcement: verdicts are logged (winston + audit)
 * and exported as Prometheus counters for LC-T3 review. Nothing here blocks,
 * bans, or alters settlement outcomes.
 *
 * Detection state is in-memory per server process, matching the tradeoff of
 * the existing anti-cheat history tracking in anti_cheat.ts / rate_limit.ts.
 */

/**
 * Observation window for all punch-up loss heuristics (24 hours).
 */
export const PUNCH_UP_WATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Same-pair punch-up losses within the window before a `pair_farming` flag.
 * Matches the minimum-sample bar used by detectWinTrading.
 */
export const PAIR_FARMING_MIN_LOSSES = 3;

/**
 * Total punch-up losses by one player within the window before a
 * `loss_frequency` flag. Losing a punch-up costs an amplified 2x-K deduction,
 * so sustained repeated punch-up losses are statistically anomalous.
 */
export const ABNORMAL_FREQUENCY_MIN_LOSSES = 8;

/**
 * A settled punch-up loss observation.
 *
 * @property matchId - ID of the settled match
 * @property winnerId - Favorite (higher-ranked) player who won
 * @property loserId - Underdog who lost the punch-up wager
 * @property timestamp - Settlement timestamp (ms since epoch)
 */
interface PunchUpLossRecord {
  matchId: string;
  winnerId: string;
  loserId: string;
  timestamp: number;
}

/**
 * Why (or why not) the watch flagged a punch-up loss.
 */
export type PunchUpWatchReason =
  'none' | 'pair_farming' | 'loss_frequency' | 'pair_farming+loss_frequency';

/**
 * Verdict for a recorded punch-up loss.
 *
 * @property flagged - Whether any anomaly threshold was met
 * @property reason - Which heuristic(s) triggered
 * @property pairLossCount - Same-pair punch-up losses in the window (incl. this one)
 * @property playerLossCount - Loser's total punch-up losses in the window (incl. this one)
 * @property windowMs - Observation window used for the counts
 */
export interface PunchUpWatchVerdict {
  flagged: boolean;
  reason: PunchUpWatchReason;
  pairLossCount: number;
  playerLossCount: number;
  windowMs: number;
}

/** Recent punch-up loss observations (in-memory, per process). */
const punchUpLossRecords: PunchUpLossRecord[] = [];

/**
 * Records a settled punch-up loss and evaluates LC-T3 anomaly heuristics.
 *
 * @param input - The punch-up loss observation
 * @returns Watch verdict for logging/metrics; never blocks settlement
 */
export function recordPunchUpLossAndEvaluate(input: {
  matchId: string;
  winnerId: string;
  loserId: string;
  timestamp: number;
}): PunchUpWatchVerdict {
  punchUpLossRecords.push({
    matchId: input.matchId,
    winnerId: input.winnerId,
    loserId: input.loserId,
    timestamp: input.timestamp,
  });

  pruneExpiredRecords(input.timestamp);

  const windowStart = input.timestamp - PUNCH_UP_WATCH_WINDOW_MS;
  const inWindow = punchUpLossRecords.filter((r) => r.timestamp > windowStart);

  const pairLossCount = inWindow.filter(
    (r) => r.winnerId === input.winnerId && r.loserId === input.loserId
  ).length;
  const playerLossCount = inWindow.filter((r) => r.loserId === input.loserId).length;

  const pairFarming = pairLossCount >= PAIR_FARMING_MIN_LOSSES;
  const abnormalFrequency = playerLossCount >= ABNORMAL_FREQUENCY_MIN_LOSSES;

  let reason: PunchUpWatchReason = 'none';
  if (pairFarming && abnormalFrequency) {
    reason = 'pair_farming+loss_frequency';
  } else if (pairFarming) {
    reason = 'pair_farming';
  } else if (abnormalFrequency) {
    reason = 'loss_frequency';
  }

  return {
    flagged: reason !== 'none',
    reason,
    pairLossCount,
    playerLossCount,
    windowMs: PUNCH_UP_WATCH_WINDOW_MS,
  };
}

/**
 * Drops records older than the observation window (relative to `now`).
 * Order-independent: safe even if observations arrive with non-monotonic
 * timestamps.
 *
 * @param now - Reference timestamp (ms since epoch)
 */
function pruneExpiredRecords(now: number): void {
  const windowStart = now - PUNCH_UP_WATCH_WINDOW_MS;
  for (let i = punchUpLossRecords.length - 1; i >= 0; i--) {
    if (punchUpLossRecords[i].timestamp <= windowStart) {
      punchUpLossRecords.splice(i, 1);
    }
  }
}

/**
 * Clears all watch state. Used by tests; also safe to call from operational
 * tooling to reset per-process detection history.
 */
export function resetPunchUpWatchState(): void {
  punchUpLossRecords.length = 0;
}
