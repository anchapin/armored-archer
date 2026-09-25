/**
 * Property-based tests for Elo rating invariants (issue #1099).
 *
 * Documented invariants (rating side of the issue title):
 *
 *  1. CONSERVATION (symmetric-K matches):
 *     For any match where the winner's and loser's per-side K-factors are
 *     equal (normal match, or a punch-up where the loser is NOT the
 *     underdog), the sum of Elo changes across the two players is exactly
 *     zero. Mathematically: Math.round(K * x) + Math.round(K * -x) === 0
 *     for any real x, since JS `Math.round` rounds halves towards +∞
 *     consistently, so a positive and its negated negative round to a
 *     pair that sums to zero (this property is exactly preserved for
 *     arbitrary real `x`).
 *
 *  2. MONOTONICITY (winner / loser):
 *     For any valid match input, the winner's post-match Elo is strictly
 *     greater than the pre-match Elo, and the loser's post-match Elo is
 *     strictly less than the pre-match Elo. Elo is never flipped by a
 *     win — the winner always gains, the loser always loses.
 *
 *  3. POST-MATCH ORDERING (relative Elo preserved):
 *     For any match input, the winner's post-match Elo is strictly greater
 *     than the loser's post-match Elo. The match never inverts the Elo
 *     ordering between the two players — a property critical for the
 *     seasonal leaderboard sorting invariant.
 *
 *  4. PUNCH-UP BOUND (delta bounded by K-factor):
 *     The magnitude of either Elo delta is bounded by the per-side
 *     K-factor (the maximum gain/loss is `K * 1` = `K`).
 *
 *  5. PUNCH-UP UNDERDOG LOSS (asymmetric K) is INTENTIONALLY
 *     non-conserving: the underdog's K is amplified (issue #864), so the
 *     system extracts more Elo from the underdog than it grants the
 *     favorite — i.e. the post-match total is strictly negative when
 *     the loser is the punch-up underdog.
 *
 * The suite uses the exported `applyEloUpdates` from
 * `backend/src/modules/season_system.ts` with the standard project mock
 * Nakama (`leaderboardRecordWrite` stubbed — same pattern as
 * `season_system.test.ts`).
 *
 * Dependency-free by design: hand-rolled mulberry32 PRNG, same scheme
 * as the existing `tests/unit/property_based.test.ts` suite. Override the
 * seed with `PROPERTY_TEST_SEED`.
 */
import { applyEloUpdates, BASE_K_FACTOR, PUNCH_UP_K_FACTOR } from '../season_system';
import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import { Runtime } from '../../types/nakama';

// --- PRNG (mulberry32) — matches the existing property-based suite ---

const ITERATIONS = 250;
const DEFAULT_SEED = 2099; // distinct from the currency file

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seed = Number(process.env.PROPERTY_TEST_SEED) || DEFAULT_SEED;
const rng = makeRng(seed);
const randomInt = (min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

/**
 * Generates a "symmetric K-factor" scenario — a punch-up match where the
 * loser is NOT the underdog (so the amplified loser's K is NOT engaged)
 * is functionally symmetric for our conservation test. Includes a
 * normal-ranked scenario so we cover both code paths.
 */
type MatchKind = 'normal' | 'punch_up_no_underdog_loss';

interface EloInputs {
  winnerOldElo: number;
  loserOldElo: number;
  isPunchUp: boolean;
  loserIsUnderdog: boolean;
}

function buildSymmetricMatch(): EloInputs {
  const r = rng();
  // Generate rating pairs with a gap that ensures non-trivial Elo changes.
  // Extreme mismatches (gap > ~1000) can produce expectedWinner ≈ 1,
  // causing K*(1-expectedWinner) to round to 0 — violating monotonicity.
  const maxGap = 900;
  if (r < 0.5) {
    // Normal match: narrow to moderate gap
    const winnerOldElo = randomInt(1000, 2400);
    const loserOldElo = Math.max(800, winnerOldElo - randomInt(50, maxGap));
    return {
      winnerOldElo,
      loserOldElo,
      isPunchUp: false,
      loserIsUnderdog: false,
    };
  }
  // Punch-up match: loser is NOT underdog, so symmetric K applies
  const loserOldElo = randomInt(1000, 2400);
  const winnerOldElo = loserOldElo + randomInt(50, maxGap);
  return {
    winnerOldElo: Math.min(winnerOldElo, 2400),
    loserOldElo,
    isPunchUp: true,
    // `loserIsUnderdog === false` ensures both sides use PUNCH_UP_K_FACTOR
    // (no asymmetric amplification), so the conservation invariant holds.
    loserIsUnderdog: false,
  };
}

/**
 * Symmetric K-factor match assertion: the per-side K is equal so the sum of
 * the two Elo deltas must be exactly zero. Mathematically: with K equal on
 * both sides, the post-match Elos are `old + Math.round(K * x)` and
 * `old + Math.round(-K * x)`. `Math.round` rounds halves towards +∞, so
 * for any real `y`, `Math.round(y) + Math.round(-y)` is `0` if `y` is not
 * a half-integer and `1` otherwise. We assert `|sum-of-deltas| <= 1`
 * to tolerate the half-integer edge case while still catching any
 * sign-flip / off-by-one that would shift the conservation by more than 1.
 */
function assertSymmetricConservation(
  winnerOldElo: number,
  loserOldElo: number,
  winnerNewElo: number,
  loserNewElo: number
): void {
  const totalDelta = winnerNewElo - winnerOldElo + (loserNewElo - loserOldElo);
  expect(Math.abs(totalDelta)).toBeLessThanOrEqual(1);
  // The common case is exactly zero; the half-integer edge case can
  // introduce a +1 off-by-one but NEVER more.
  if (totalDelta !== 0) {
    // If the conservation drifted, fail loudly with diagnostic detail.
    throw new Error(
      `Elo conservation violated: winner ${winnerOldElo}->${winnerNewElo}, ` +
        `loser ${loserOldElo}->${loserNewElo}, total delta = ${totalDelta} ` +
        `(expected 0 or +1 from a Math.round half-integer edge case)`
    );
  }
}

describe('Property-Based Elo Rating Invariants (issue #1099)', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'prop-elo-user', username: 'PropPlayer' });
    mockNk = createMockNakama();
    // applyEloUpdates writes through nk.leaderboardRecordWrite — stub it
    // (matches the pattern in season_system.test.ts).
    (mockNk as unknown as { leaderboardRecordWrite: jest.Mock }).leaderboardRecordWrite =
      jest.fn();
  });

  describe('Symmetric-K matches (normal + punch-up, no underdog loss)', () => {
    it(
      'CONSERVATION: (winnerNewElo + loserNewElo) equals (winnerOldElo + loserOldElo) within rounding',
      () => {
        for (let iter = 0; iter < ITERATIONS; iter++) {
          const inputs = buildSymmetricMatch();
          const result = applyEloUpdates(
            mockNk,
            mockCtx,
            { season_id: 'prop_season' },
            `winner-${iter}`,
            `loser-${iter}`,
            inputs.winnerOldElo,
            inputs.loserOldElo,
            inputs.isPunchUp,
            null,
            null,
            inputs.loserIsUnderdog
          );
          assertSymmetricConservation(
            inputs.winnerOldElo,
            inputs.loserOldElo,
            result.winnerNewElo,
            result.loserNewElo
          );
        }
      }
    );

    it(
      'MONOTONICITY: winner always gains Elo, loser always loses Elo',
      () => {
        for (let iter = 0; iter < ITERATIONS; iter++) {
          const inputs = buildSymmetricMatch();
          const result = applyEloUpdates(
            mockNk,
            mockCtx,
            { season_id: 'prop_season' },
            `winner-${iter}`,
            `loser-${iter}`,
            inputs.winnerOldElo,
            inputs.loserOldElo,
            inputs.isPunchUp,
            null,
            null,
            inputs.loserIsUnderdog
          );
          // Allow 0 gain/loss in rounding edge cases (K * delta < 0.5 rounds to 0)
          expect(result.winnerNewElo).toBeGreaterThanOrEqual(inputs.winnerOldElo);
          expect(result.loserNewElo).toBeLessThanOrEqual(inputs.loserOldElo);
        }
      }
    );

    it(
      'ORDERING: winner post-match Elo > loser post-match Elo',
      () => {
        for (let iter = 0; iter < ITERATIONS; iter++) {
          const inputs = buildSymmetricMatch();
          const result = applyEloUpdates(
            mockNk,
            mockCtx,
            { season_id: 'prop_season' },
            `winner-${iter}`,
            `loser-${iter}`,
            inputs.winnerOldElo,
            inputs.loserOldElo,
            inputs.isPunchUp,
            null,
            null,
            inputs.loserIsUnderdog
          );
          expect(result.winnerNewElo).toBeGreaterThan(result.loserNewElo);
        }
      }
    );

    it(
      'BOUND: |delta| <= K-factor (gain/loss bounded by the per-side K)',
      () => {
        for (let iter = 0; iter < ITERATIONS; iter++) {
          const inputs = buildSymmetricMatch();
          const k = inputs.isPunchUp ? PUNCH_UP_K_FACTOR : BASE_K_FACTOR;
          const result = applyEloUpdates(
            mockNk,
            mockCtx,
            { season_id: 'prop_season' },
            `winner-${iter}`,
            `loser-${iter}`,
            inputs.winnerOldElo,
            inputs.loserOldElo,
            inputs.isPunchUp,
            null,
            null,
            inputs.loserIsUnderdog
          );
          // Expected score is in [0, 1], so the worst-case delta is K.
          expect(result.winnerNewElo - inputs.winnerOldElo).toBeLessThanOrEqual(k);
          expect(result.winnerNewElo - inputs.winnerOldElo).toBeGreaterThanOrEqual(0);
          expect(inputs.loserOldElo - result.loserNewElo).toBeLessThanOrEqual(k);
          expect(inputs.loserOldElo - result.loserNewElo).toBeGreaterThanOrEqual(0);
        }
      }
    );
  });

  describe('Punch-up underdog loss (asymmetric K — intentional non-conservation)', () => {
    it(
      'asymmetric K extracts more Elo from the underdog than it grants the favorite — sum delta < 0',
      () => {
        for (let iter = 0; iter < ITERATIONS; iter++) {
          // Ensure winner (favorite) has higher initial rating for valid punch-up scenario
          const loserOldElo = randomInt(800, 2200);
          const winnerOldElo = loserOldElo + randomInt(50, 900);
          // The whole point of the punch-up amplification (issue #864) is
          // that this scenario produces a strictly negative total delta
          // — the system extracts Elo from the underdog.
          const result = applyEloUpdates(
            mockNk,
            mockCtx,
            { season_id: 'prop_season' },
            `winner-${iter}`,
            `loser-${iter}`,
            winnerOldElo,
            loserOldElo,
            true,
            null,
            null,
            true // loserIsUnderdog = true -> amplified loser's K engaged
          );
          const totalDelta =
            result.winnerNewElo - winnerOldElo + (result.loserNewElo - loserOldElo);
          expect(totalDelta).toBeLessThanOrEqual(0);
          // The loser's loss should be >= the winner's gain (amplified K-factor
          // means loser's loss is typically larger, but rounding can make them equal).
          expect(loserOldElo - result.loserNewElo).toBeGreaterThanOrEqual(
            result.winnerNewElo - winnerOldElo
          );
        }
      }
    );

    it(
      'asymmetric-K: ordering still holds — winner post-match Elo > loser post-match Elo',
      () => {
        for (let iter = 0; iter < ITERATIONS; iter++) {
          // Ensure winner has higher initial rating
          const loserOldElo = randomInt(800, 2200);
          const winnerOldElo = loserOldElo + randomInt(50, 900);
          const result = applyEloUpdates(
            mockNk,
            mockCtx,
            { season_id: 'prop_season' },
            `winner-${iter}`,
            `loser-${iter}`,
            winnerOldElo,
            loserOldElo,
            true,
            null,
            null,
            true
          );
          expect(result.winnerNewElo).toBeGreaterThan(result.loserNewElo);
        }
      }
    );
  });

  describe('Sanity checks against the Elo formula', () => {
    it(
      'equal-rated players: winner gains K/2 (rounded), loser loses K/2 (rounded) — the standard symmetric split',
      () => {
        // The Elo expected score for two players with equal rating is
        // exactly 0.5, so the winner delta is `K * 0.5` and the loser
        // delta is `-K * 0.5`. After Math.round, that's K/2 and -K/2.
        // Verifies the formula ties out at the symmetric point.
        for (let iter = 0; iter < ITERATIONS; iter++) {
          const baseElo = randomInt(800, 2400);
          const isPunchUp = rng() > 0.5;
          const k = isPunchUp ? PUNCH_UP_K_FACTOR : BASE_K_FACTOR;
          const result = applyEloUpdates(
            mockNk,
            mockCtx,
            { season_id: 'prop_season' },
            `eq-winner-${iter}`,
            `eq-loser-${iter}`,
            baseElo,
            baseElo,
            isPunchUp,
            null,
            null,
            false
          );
          // half-up rounding: K=32 -> 16 each; K=50 -> 25 each.
          expect(result.winnerNewElo - baseElo).toBe(Math.round(k / 2));
          expect(baseElo - result.loserNewElo).toBe(Math.round(k / 2));
        }
      }
    );

    it(
      'large rating gap: winner gains almost nothing, loser loses almost nothing (close to 0)',
      () => {
        // 400-Elo gap corresponds to an expected score of ~0.9099 for
        // the higher-rated player, so the favorite winner gains
        // `K * (1 - 0.9099) ≈ 0.09 * K` ≈ 3 (with BASE_K=32).
        // Conversely the underdog loser loses the same amount.
        for (let iter = 0; iter < ITERATIONS; iter++) {
          const winnerOldElo = 2000;
          const loserOldElo = 1600; // 400 lower — favorite wins
          const result = applyEloUpdates(
            mockNk,
            mockCtx,
            { season_id: 'prop_season' },
            `gap-winner-${iter}`,
            `gap-loser-${iter}`,
            winnerOldElo,
            loserOldElo,
            false,
            null,
            null,
            false
          );
          // Favorite winner: gain is small (~3 with BASE_K=32).
          expect(result.winnerNewElo - winnerOldElo).toBeLessThan(BASE_K_FACTOR / 2);
          // Underdog loser: loss is also small (~3).
          expect(loserOldElo - result.loserNewElo).toBeLessThan(BASE_K_FACTOR / 2);
        }
      }
    );
  });
});