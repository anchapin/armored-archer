/**
 * Reward integration contract: per-effect grant IDs make a retried stage
 * completion resumable (no double-grant, no lost effects).
 */
import {
  createMockLogger,
  createMockContext,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { Runtime } from '../../types/nakama';
import { resetRateLimiting } from '../rate_limit';
import {
  checkStageCompletionClaim,
  writeStageCompletionClaim,
  STAGE_COMPLETION_CLAIM_COLLECTION,
} from '../stage_progression';
import { makeStageGrantId, readStageOutcome, STAGE_OUTCOME_COLLECTION } from '../stage_grants';
import { grantStageXP } from '../stage_xp';

jest.mock('../audit', () => ({ logAudit: jest.fn() }));
jest.mock('../balance_analytics', () => ({
  recordStageAttempt: jest.fn().mockResolvedValue(undefined),
  recordDrop: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../utils/db_optimizer', () => ({ invalidatePlayerStatsCache: jest.fn() }));

const insertGearItemMock = jest.fn();
const getGearItemByGrantIdMock = jest.fn();
const getDefeatedBossesFromDBMock = jest.fn().mockReturnValue([]);
jest.mock('../gear_db', () => ({
  insertGearItem: (...args: any[]) => insertGearItemMock(...args),
  getGearItemByGrantId: (...args: any[]) => getGearItemByGrantIdMock(...args),
  getPlayerGearFromDB: jest.fn().mockReturnValue([]),
  getPlayerLoadoutFromDB: jest.fn().mockReturnValue({}),
  getFullInventoryFromDB: jest
    .fn()
    .mockReturnValue({ gear: [], loadout: {}, unlocked_modifier_pools: [] }),
  recordBossDefeatInDB: jest.fn(),
  getDefeatedBossesFromDB: (...args: any[]) => getDefeatedBossesFromDBMock(...args),
  getBossDefeatCount: jest.fn().mockReturnValue(0),
  unlockModifierPoolInDB: jest.fn(),
  getUnlockedModifierPoolsFromDB: jest.fn().mockReturnValue([]),
  equipItemInDB: jest.fn(),
  unequipItemInDB: jest.fn(),
}));

import { rpcStageComplete } from '../gear_system';

describe('stage grant idempotency', () => {
  let nk: Runtime.Nakama;
  let ctx: Runtime.Context;
  let logger: Runtime.Logger;

  const payload = (attemptId?: string) =>
    JSON.stringify({
      stage_id: 'stage_1',
      boss_defeated: false,
      difficulty: 'easy',
      ...(attemptId ? { attempt_id: attemptId } : {}),
    });

  beforeEach(() => {
    nk = createMockNakama();
    ctx = createMockContext({ userId: 'test-user' });
    logger = createMockLogger();
    testStorage.clear();
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    resetRateLimiting();
    getDefeatedBossesFromDBMock.mockReturnValue([]);
    getGearItemByGrantIdMock.mockReturnValue(null);
    insertGearItemMock.mockReturnValue({ success: true, item_id: 'g1' });
  });

  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('derives deterministic grant IDs', () => {
    const a = makeStageGrantId('u', 's', 'att', 'xp');
    expect(a).toBe('u:s:att:xp');
    expect(makeStageGrantId('u', 's', 'att', 'xp')).toBe(a);
    expect(makeStageGrantId('u', 's', 'att', 'gear:0')).not.toBe(a);
  });

  it('resumes a matching attempt claim and rejects mismatched or absent attempt IDs', () => {
    writeStageCompletionClaim(nk, 'test-user', 'stage_1', undefined, 'att-1');
    expect(checkStageCompletionClaim(nk, 'test-user', 'stage_1', logger, 'att-1').resume).toBe(
      true
    );
    const mismatch = checkStageCompletionClaim(nk, 'test-user', 'stage_1', logger, 'att-2');
    expect(mismatch.error).toContain('DUPLICATE_COMPLETION');
    const legacy = checkStageCompletionClaim(nk, 'test-user', 'stage_1', logger);
    expect(legacy.error).toContain('DUPLICATE_COMPLETION');
  });

  it('grantStageXP applies a grant ID once and skips it on replay', () => {
    const first = grantStageXP(nk, ctx, logger, 100, 'test-user:stage_1:att:xp');
    expect(first.alreadyApplied).toBe(false);
    const second = grantStageXP(nk, ctx, logger, 100, 'test-user:stage_1:att:xp');
    expect(second.alreadyApplied).toBe(true);
    const raw = testStorage.get('player_stats:test-user');
    const stats = JSON.parse(raw as string);
    expect(stats.xp).toBe(100);
    expect(stats.applied_stage_grants).toContain('test-user:stage_1:att:xp');
  });

  it('completes a fresh attempt, records the outcome, and replays the record on retry', () => {
    const first = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-1')));
    expect(first.success).toBe(true);
    expect(first.loot.dropped).toBe(true);
    expect(first.gear_dropped.id).toBe('g1');
    const xp = first.xp_gained;
    expect(xp).toBeGreaterThan(0);
    expect(insertGearItemMock).toHaveBeenCalledTimes(1);
    const { outcome } = readStageOutcome(nk, 'test-user', 'stage_1', 'att-1');
    expect(outcome?.response.success).toBe(true);

    const second = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-1')));
    expect(second.success).toBe(true);
    expect(second.resumed).toBe(true);
    expect(second.xp_gained).toBe(xp);
    expect(second.gear_dropped.id).toBe('g1');
    // No effect re-applied: one insert total, XP unchanged.
    expect(insertGearItemMock).toHaveBeenCalledTimes(1);
    const stats = JSON.parse(testStorage.get('player_stats:test-user') as string);
    expect(stats.xp).toBe(xp);
  });

  it('rejects a different attempt for the same stage inside the cooldown', () => {
    const first = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-1')));
    expect(first.success).toBe(true);
    const second = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-2')));
    expect(second.success).toBe(false);
    expect(second.error_code).toBe('DUPLICATE_COMPLETION');
  });

  it('resumes a crashed attempt from grant evidence without re-rolling or double-granting XP', () => {
    // Simulate the crash: claim written, outcome absent, gear row already
    // granted (recoverable by grant ID), XP write never happened.
    writeStageCompletionClaim(nk, 'test-user', 'stage_1', undefined, 'att-9');
    const priorGear = {
      id: 'prior-1',
      type: 'bow',
      name: 'Prior Bow',
      rarity: 'rare',
      level: 1,
      stats: [],
      modifiers: [],
      timestamp: 1,
    };
    getGearItemByGrantIdMock.mockReturnValue(priorGear);

    const resumed = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-9')));
    expect(resumed.success).toBe(true);
    expect(resumed.resumed).toBe(true);
    // No re-roll: the granted row is recovered by grant ID, insert never runs.
    expect(getGearItemByGrantIdMock).toHaveBeenCalledWith(
      expect.anything(),
      'test-user',
      'test-user:stage_1:att-9:gear:0',
      expect.anything()
    );
    expect(insertGearItemMock).not.toHaveBeenCalled();
    expect(resumed.gear_dropped.id).toBe('prior-1');
    const stats = JSON.parse(testStorage.get('player_stats:test-user') as string);
    expect(stats.xp).toBe(resumed.xp_gained);

    // A further retry now replays the recorded outcome.
    const replay = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-9')));
    expect(replay.resumed).toBe(true);
    expect(replay.gear_dropped.id).toBe('prior-1');
    expect(insertGearItemMock).not.toHaveBeenCalled();
    const statsAfter = JSON.parse(testStorage.get('player_stats:test-user') as string);
    expect(statsAfter.xp).toBe(resumed.xp_gained);
  });

  it('skips an XP grant already applied by the crashed attempt', () => {
    const grantId = 'test-user:stage_1:att-7:xp';
    writeStageCompletionClaim(nk, 'test-user', 'stage_1', undefined, 'att-7');
    testStorage.set(
      'player_stats:test-user',
      JSON.stringify({
        user_id: 'test-user',
        level: 2,
        xp: 100,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        applied_stage_grants: [grantId],
      })
    );
    const resumed = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-7')));
    expect(resumed.success).toBe(true);
    const stats = JSON.parse(testStorage.get('player_stats:test-user') as string);
    expect(stats.xp).toBe(100);
    expect(stats.applied_stage_grants).toHaveLength(1);
  });

  it('keeps legacy duplicate rejection when no attempt_id is supplied', () => {
    writeStageCompletionClaim(nk, 'test-user', 'stage_1', undefined);
    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload()));
    expect(result.success).toBe(false);
    expect(result.error_code).toBe('DUPLICATE_COMPLETION');
  });

  it('writes claims with the attempt ID', () => {
    writeStageCompletionClaim(nk, 'test-user', 'stage_2', undefined, 'att-x');
    const raw = JSON.parse(
      testStorage.get(`${STAGE_COMPLETION_CLAIM_COLLECTION}:test-user:stage_2`) as string
    );
    expect(raw.attempt_id).toBe('att-x');
    expect(testStorage.get(`${STAGE_OUTCOME_COLLECTION}:stage_2:att-x`)).toBeUndefined();
  });
});
