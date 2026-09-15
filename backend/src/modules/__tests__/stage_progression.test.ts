/**
 * Consolidated stage-completion tests (issue #1069).
 *
 * Covers the survivor RPC `rpcStageComplete` (gear_system.ts) against the
 * issue's acceptance criteria:
 * - claim-first atomicity: the `stage_completion_claims` marker is written
 *   BEFORE any loot/XP/stars grant, so a retry after success no-ops;
 * - a mid-sequence failure after the claim leaves no duplicate loot on
 *   retry (the retry is rejected as a duplicate);
 * - loot persists through the DB layer (INSERT INTO inventory_items) and
 *   the orphaned `player_inventory` storage write is gone;
 * - issue #1068 protections survive the consolidation: stars clamp to 0-3,
 *   score caps at MAX_STAGE_SCORE (schema bounds are covered in
 *   validation.test.ts; these exercise the handler's defense-in-depth
 *   clamps via a permissive validation mock).
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../../config', () => ({
  // Spread the real config (issue #1139 made the test's module graph pull in
  // metrics.ts, whose init chain reads config fields beyond the two this
  // suite historically overrode) then keep the original overrides.
  ...jest.requireActual('../../config'),
  config: {
    ...jest.requireActual('../../config').config,
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

jest.mock('../balance_analytics', () => ({
  recordStageAttempt: jest.fn().mockResolvedValue(undefined),
  recordDrop: jest.fn().mockResolvedValue(undefined),
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
    stage_complete: {},
  },
  MAX_STAGE_SCORE: 1000000,
  createValidationErrorResponse: jest.fn((name: string, error: string) =>
    JSON.stringify({ success: false, error: `${name}: ${error}` })
  ),
}));

// Issue #1139: mock only the stage-telemetry recorders (spread requireActual
// so the rest of metrics.ts stays real for any transitive importers), the
// same factory pattern matchmaker.test.ts uses for recordSettlementOutcome.
jest.mock('../metrics', () => ({
  ...jest.requireActual('../metrics'),
  recordStageCompleteOutcome: jest.fn(),
  recordStageClaim: jest.fn(),
  observeStageClaimSeconds: jest.fn(),
}));

import {
  createMockLogger,
  createMockContext,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { Runtime } from '../../types/nakama';
import { rpcStageComplete } from '../gear_system';
import {
  recordStageClaim,
  recordStageCompleteOutcome,
  observeStageClaimSeconds,
} from '../metrics';
import { resetRateLimiting } from '../rate_limit';

describe('stage_progression — consolidated stage_complete RPC (issue #1069)', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  const basePayload = (overrides?: Record<string, unknown>): string =>
    JSON.stringify({
      stage_id: '1_1',
      boss_defeated: false,
      difficulty: 'easy',
      ...overrides,
    });

  /** Index of the first dbQuery call matching a SQL fragment. */
  const firstDbCallMatching = (fragment: string): number =>
    (mockNk.dbQuery as jest.Mock).mock.calls.findIndex(([q]) => String(q).includes(fragment));

  /** Number of dbQuery calls matching a SQL fragment. */
  const dbCallCount = (fragment: string): number =>
    (mockNk.dbQuery as jest.Mock).mock.calls.filter(([q]) => String(q).includes(fragment)).length;

  /** storageWrite calls whose objects include the given collection. */
  const writesToCollection = (collection: string): unknown[][] =>
    (mockNk.storageWrite as jest.Mock).mock.calls.filter((calls: any[]) =>
      calls[0].some((obj: any) => obj.collection === collection)
    );

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
    testStorage.clear();
    resetRateLimiting();
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // guarantees a loot drop at easy (0.225)
  });

  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
  });

  describe('claim-first atomicity', () => {
    it('writes the dedup claim BEFORE granting loot (ordering guarantee)', () => {
      const result = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
      expect(result.success).toBe(true);
      expect(result.loot.dropped).toBe(true);

      const storageWriteMock = mockNk.storageWrite as jest.Mock;
      const dbQueryMock = mockNk.dbQuery as jest.Mock;

      const claimCallIdx = storageWriteMock.mock.calls.findIndex((calls: any[]) =>
        calls[0].some((obj: any) => obj.collection === 'stage_completion_claims')
      );
      expect(claimCallIdx).toBeGreaterThanOrEqual(0);

      const insertCallIdx = firstDbCallMatching('INSERT INTO inventory_items');
      expect(insertCallIdx).toBeGreaterThanOrEqual(0);

      // Global invocation order: claim write strictly before the loot INSERT
      expect(storageWriteMock.mock.invocationCallOrder[claimCallIdx]).toBeLessThan(
        dbQueryMock.mock.invocationCallOrder[insertCallIdx]
      );
    });

    it('a retry after success grants nothing twice (idempotency)', () => {
      const first = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
      expect(first.success).toBe(true);
      expect(first.loot.dropped).toBe(true);
      expect(dbCallCount('INSERT INTO inventory_items')).toBe(1);

      // Immediate retry of the same completion
      const retry = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
      expect(retry.success).toBe(false);
      expect(retry.error_code).toBe('DUPLICATE_COMPLETION');
      expect(retry.retry_after_ms).toBeGreaterThan(0);

      // No second loot insert, no second XP-bearing response
      expect(dbCallCount('INSERT INTO inventory_items')).toBe(1);
    });
  });

  describe('mid-sequence failure safety', () => {
    it('a failure after the claim leaves no duplicate loot on retry', () => {
      // Sabotage the completion-record write (the first write AFTER the
      // claim) to simulate a mid-sequence failure.
      const healthyWrite = mockNk.storageWrite as jest.Mock;
      const sabotaged = jest.fn((objects: any[]) => {
        if (objects.some((obj: any) => obj.collection === 'stage_completion')) {
          throw new Error('simulated completion-record write failure');
        }
        return healthyWrite(objects);
      });
      mockNk.storageWrite = sabotaged as any;

      const failed = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
      expect(failed.success).toBe(false);
      expect(failed.error_code).toBe('INTERNAL_ERROR');
      // The claim marker survived the failure (claim-first)
      const claimKey = 'stage_completion_claims:test-user:1_1';
      expect(testStorage.has(claimKey)).toBe(true);
      // The aborted attempt granted no loot
      expect(dbCallCount('INSERT INTO inventory_items')).toBe(0);

      // Repair storage and retry: the retry no-ops instead of re-rolling
      mockNk.storageWrite = healthyWrite;
      const retry = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
      expect(retry.success).toBe(false);
      expect(retry.error_code).toBe('DUPLICATE_COMPLETION');
      expect(dbCallCount('INSERT INTO inventory_items')).toBe(0);
    });
  });

  describe('loot persistence through the DB layer', () => {
    it('persists loot via inventory_items INSERT, never the orphaned player_inventory storage', () => {
      const result = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
      expect(result.success).toBe(true);
      expect(result.loot.dropped).toBe(true);

      // Loot goes through the same DB layer the read path uses
      expect(dbCallCount('INSERT INTO inventory_items')).toBe(1);

      // The orphaned Nakama-storage write path is gone
      expect(writesToCollection('player_inventory')).toEqual([]);
      expect(testStorage.has('player_inventory:test-user')).toBe(false);
    });
  });

  describe('issue #1068 protections survive the consolidation', () => {
    it('clamps inflated stars and score before persisting (defense-in-depth)', () => {
      // The valibot schema rejects these outright in production; with
      // validation mocked permissively here, the handler clamps must still
      // bound what is persisted.
      const result = JSON.parse(
        rpcStageComplete(
          mockCtx,
          mockLogger,
          mockNk,
          basePayload({ stars_earned: 7, score: 99999999 })
        )
      );

      expect(result.success).toBe(true);
      expect(result.stars_earned).toBe(3); // clamped to the 0-3 bound
      expect(result.score).toBe(1000000); // clamped to MAX_STAGE_SCORE

      // Nothing persisted may carry the inflated values
      const allWrites = (mockNk.storageWrite as jest.Mock).mock.calls
        .map((calls: any[]) => calls[0].map((obj: any) => obj.value ?? '').join('\n'))
        .join('\n');
      expect(allWrites).not.toContain('"stars_earned":7');
      expect(allWrites).not.toContain('"score":99999999');
      expect(allWrites).toContain('"stars_earned":3');
      expect(allWrites).toContain('"score":1000000');
    });

    it('defaults stars/score for the legacy client shape (no stars/score sent)', () => {
      const result = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));

      expect(result.success).toBe(true);
      expect(result.stars_earned).toBe(3);
      expect(result.score).toBe(0);
      expect(result.is_new_completion).toBe(true);
      expect(result.previous_best).toBeUndefined();

      const completionWrite = writesToCollection('stage_completion')[0][0] as any[];
      const record = JSON.parse(completionWrite[0].value).completions['1_1'];
      expect(record.stars_earned).toBe(3);
      expect(record.score).toBe(0);
      expect(record.stage_prefix).toBe('1'); // derived from stage_id chapter part
    });
  });

  describe('best-of completion records (absorbed from complete_stage)', () => {
    const seedCompletion = (stars: number, score: number): void => {
      testStorage.set(
        'stage_completion:test-user',
        JSON.stringify({
          user_id: 'test-user',
          completions: {
            '1_1': {
              stage_id: '1_1',
              stage_prefix: '1',
              stars_earned: stars,
              score,
              completed_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          },
        })
      );
    };

    it('rejects unauthenticated requests (absorbed from complete_stage)', () => {
      const result = JSON.parse(
        rpcStageComplete({ userId: null } as any, mockLogger, mockNk, basePayload())
      );
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('UNAUTHORIZED');
    });

    it('returns early without re-rolling loot when the replay does not improve', () => {
      seedCompletion(3, 2000);

      const result = JSON.parse(
        rpcStageComplete(
          mockCtx,
          mockLogger,
          mockNk,
          basePayload({ stars_earned: 2, score: 1000 })
        )
      );

      expect(result.success).toBe(true);
      expect(result.is_new_completion).toBe(false);
      expect(result.message).toBe('No improvement over previous completion');
      expect(result.previous_best).toEqual({ stars_earned: 3, score: 2000 });
      // Existing best is echoed, not the worse claim
      expect(result.stars_earned).toBe(3);
      expect(result.score).toBe(2000);
      // No loot re-roll, no XP on a non-improving replay
      expect(result.loot.dropped).toBe(false);
      expect(result.xp_gained).toBe(0);
      expect(dbCallCount('INSERT INTO inventory_items')).toBe(0);
    });

    it('updates the record and grants rewards when the replay improves', () => {
      seedCompletion(1, 500);

      const result = JSON.parse(
        rpcStageComplete(
          mockCtx,
          mockLogger,
          mockNk,
          basePayload({ stars_earned: 3, score: 1500 })
        )
      );

      expect(result.success).toBe(true);
      expect(result.is_new_completion).toBe(false);
      expect(result.previous_best).toEqual({ stars_earned: 1, score: 500 });
      expect(result.stars_earned).toBe(3);
      expect(result.score).toBe(1500);
      expect(result.loot.dropped).toBe(true);
      expect(result.xp_gained).toBe(30); // easy tier, no verified boss

      const stored = JSON.parse(
        testStorage.get('stage_completion:test-user') as string
      ).completions['1_1'];
      expect(stored.stars_earned).toBe(3);
      expect(stored.score).toBe(1500);
      expect(stored.completed_at).toBe('2024-01-01T00:00:00Z'); // preserved
      expect(stored.updated_at).not.toBe('2024-01-01T00:00:00Z'); // bumped
    });

    it('allows a fresh completion after the claim cooldown expires', () => {
      const first = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
      expect(first.success).toBe(true);

      // Age the claim past the cooldown window
      const claimKey = 'stage_completion_claims:test-user:1_1';
      const claim = JSON.parse(testStorage.get(claimKey) as string);
      claim.claimed_at = Date.now() - 300001;
      testStorage.set(claimKey, JSON.stringify(claim));

      const second = JSON.parse(
        rpcStageComplete(
          mockCtx,
          mockLogger,
          mockNk,
          basePayload({ stars_earned: 2, score: 100 }) // worse: no-improvement path
        )
      );
      expect(second.success).toBe(true);
      expect(second.message).toBe('No improvement over previous completion');
    });
  });
});

describe('stage_progression — stage-completion telemetry (issue #1139)', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  const basePayload = (overrides?: Record<string, unknown>): string =>
    JSON.stringify({
      stage_id: '1_1',
      boss_defeated: false,
      difficulty: 'easy',
      ...overrides,
    });

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
    testStorage.clear();
    resetRateLimiting();
  });

  it('records success outcome, a fresh claim, and claim-segment timing on first completion', () => {
    const result = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
    expect(result.success).toBe(true);

    expect(recordStageCompleteOutcome).toHaveBeenCalledWith('success');
    expect(recordStageClaim).toHaveBeenCalledWith('fresh');
    expect(observeStageClaimSeconds).toHaveBeenCalledTimes(1);
    expect((observeStageClaimSeconds as jest.Mock).mock.calls[0][0]).toBeGreaterThanOrEqual(0);
  });

  it('records duplicate outcome and replay_rejected claim when the cooldown marker exists', () => {
    // Seed a fresh claim marker (claimed_at = now) directly in the mock storage
    testStorage.set(
      'stage_completion_claims:test-user:1_1',
      JSON.stringify({ claimed_at: Date.now(), stage_id: '1_1' })
    );

    const result = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
    expect(result.success).toBe(false);
    expect(result.error_code).toBe('DUPLICATE_COMPLETION');

    expect(recordStageClaim).toHaveBeenCalledWith('replay_rejected');
    expect(recordStageCompleteOutcome).toHaveBeenCalledWith('duplicate');
    expect(recordStageCompleteOutcome).not.toHaveBeenCalledWith('success');
  });

  it('records clamped outcome when an out-of-range claim is silently bounded', () => {
    // Validation is mocked permissively, so the handler's defense-in-depth
    // clamp is what bounds these — the clamp changing a value is the signal.
    const result = JSON.parse(
      rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload({ stars_earned: 99 }))
    );
    expect(result.success).toBe(true);
    expect(result.stars_earned).toBe(3);

    expect(recordStageCompleteOutcome).toHaveBeenCalledWith('clamped');
    expect(recordStageCompleteOutcome).not.toHaveBeenCalledWith('success');
  });

  it('records validation_failed outcome on an unparseable payload', () => {
    // The permissive validation mock still rejects non-JSON payloads.
    const result = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, 'not-json{'));
    expect(result.success).toBe(false);

    expect(recordStageCompleteOutcome).toHaveBeenCalledWith('validation_failed');
    expect(recordStageClaim).not.toHaveBeenCalled();
  });

  it('records cooldown_active when an expired prior claim is overwritten with a version', () => {
    // Claim older than the cooldown window: the check returns the existing
    // claimVersion instead of an error, so the completion proceeds through a
    // versioned overwrite — distinguishable from a fresh claim (#1139).
    testStorage.set(
      'stage_completion_claims:test-user:1_1',
      JSON.stringify({
        claimed_at: Date.now() - 10 * 60 * 1000, // 10 minutes ago > 5-minute cooldown
        stage_id: '1_1',
      })
    );

    const result = JSON.parse(rpcStageComplete(mockCtx, mockLogger, mockNk, basePayload()));
    expect(result.success).toBe(true);

    expect(recordStageClaim).toHaveBeenCalledWith('cooldown_active');
    expect(recordStageCompleteOutcome).toHaveBeenCalledWith('success');
  });
});
