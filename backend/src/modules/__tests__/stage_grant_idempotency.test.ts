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
import {
  buildStageSettlement,
  readStageSettlement,
  recordIntendedLoot,
  recordIntendedXp,
  tryTransitionEffect,
  writeClaimAndSettlement,
  STAGE_SETTLEMENT_COLLECTION,
} from '../stage_settlement';
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

import {
  registerRpcGetStageSettlements,
  rpcGetStageSettlements,
  rpcStageComplete,
} from '../gear_system';
import * as stageXpModule from '../stage_xp';

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

  it('grants XP exactly once across a resume when the settlement already settled it', () => {
    // Crashed attempt: claim + settlement written, XP effect already settled
    // (the grant landed), outcome absent. The resume must not pay XP again.
    writeClaimAndSettlement(
      nk,
      'test-user',
      'stage_1',
      undefined,
      'att-xp1',
      buildStageSettlement('stage_1', 'att-xp1', { stars_earned: 3, score: 0 })
    );
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'xp', 'settled', logger)).toBe(true);
    testStorage.set(
      'player_stats:test-user',
      JSON.stringify({
        user_id: 'test-user',
        level: 2,
        xp: 100,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      })
    );

    const resumed = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-xp1')));
    expect(resumed.success).toBe(true);
    expect(resumed.resumed).toBe(true);
    expect(resumed.xp_gained).toBe(0);
    const stats = JSON.parse(testStorage.get('player_stats:test-user') as string);
    expect(stats.xp).toBe(100);
  });

  it('re-drives the recorded intended loot on resume without rerolling', () => {
    // Crashed attempt rolled (journal recorded it) but never committed the
    // insert: no grant row. Recovery inserts the SAME gear under the SAME
    // grant ID instead of rolling again.
    writeClaimAndSettlement(
      nk,
      'test-user',
      'stage_1',
      undefined,
      'att-loot1',
      buildStageSettlement('stage_1', 'att-loot1', { stars_earned: 3, score: 0 })
    );
    const intendedGear = {
      id: '',
      type: 'bow',
      name: 'Intended Bow',
      rarity: 'epic',
      level: 1,
      stats: [],
      modifiers: [],
      timestamp: 1,
    };
    recordIntendedLoot(
      nk,
      'test-user',
      'stage_1',
      { gear: intendedGear, grant_id: 'test-user:stage_1:att-loot1:gear:0', drop_rate: 1, roll: 0 },
      logger
    );
    getGearItemByGrantIdMock.mockReturnValue(null);

    const resumed = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-loot1')));
    expect(resumed.success).toBe(true);
    expect(insertGearItemMock).toHaveBeenCalledTimes(1);
    const insertedGear = insertGearItemMock.mock.calls[0][2];
    expect(insertedGear.name).toBe('Intended Bow');
    expect(insertedGear.rarity).toBe('epic');
    expect(insertGearItemMock.mock.calls[0][4]).toBe('test-user:stage_1:att-loot1:gear:0');
    expect(resumed.gear_dropped.name).toBe('Intended Bow');
    expect(readStageSettlement(nk, 'test-user', 'stage_1')?.effects.loot).toBe('settled');
  });

  it('marks loot and xp failed in the settlement when the insert exhausts', () => {
    insertGearItemMock.mockReturnValue({ success: false });
    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload('att-fail1')));
    expect(result.success).toBe(false);
    const settlement = readStageSettlement(nk, 'test-user', 'stage_1');
    expect(settlement?.effects.loot).toBe('failed');
    expect(settlement?.effects.xp).toBe('failed');
    expect(settlement?.state).toBe('failed');
  });

  it('settles a prior failed settlement before processing the re-completion (#1558 Stage 3)', () => {
    // Earlier attempt crashed with the loot insert exhausted: claim expired,
    // settlement failed, intended loot + XP recorded.
    writeClaimAndSettlement(
      nk,
      'test-user',
      'stage_1',
      undefined,
      'att-old',
      buildStageSettlement('stage_1', 'att-old', { stars_earned: 3, score: 0 })
    );
    const failedGear = {
      id: '',
      type: 'bow',
      name: 'Recovered Bow',
      rarity: 'rare',
      level: 1,
      stats: [],
      modifiers: [],
      timestamp: 1,
    };
    recordIntendedLoot(
      nk,
      'test-user',
      'stage_1',
      { gear: failedGear, grant_id: 'test-user:stage_1:att-old:gear:0', drop_rate: 1, roll: 0 },
      logger
    );
    recordIntendedXp(nk, 'test-user', 'stage_1', 77, logger);
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'loot', 'failed', logger)).toBe(true);
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'xp', 'failed', logger)).toBe(true);
    // Expire the claim so the re-completion proceeds.
    testStorage.set(
      `${STAGE_COMPLETION_CLAIM_COLLECTION}:test-user:stage_1`,
      JSON.stringify({ claimed_at: Date.now() - 400000, stage_id: 'stage_1', attempt_id: 'att-old' })
    );
    testStorage.set(
      'player_stats:test-user',
      JSON.stringify({
        user_id: 'test-user',
        level: 1,
        xp: 10,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      })
    );

    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload()));
    expect(result.success).toBe(true);
    // The old settlement settled first: original gear, original grant ID.
    expect(result.recovered_rewards).toEqual({ loot_recovered: true, xp_recovered: 77 });
    const recoveredInsert = insertGearItemMock.mock.calls.find(
      (call) => call[4] === 'test-user:stage_1:att-old:gear:0'
    );
    expect(recoveredInsert).toBeDefined();
    expect(recoveredInsert![2].name).toBe('Recovered Bow');
    // XP: 10 initial + 77 recovered + 30 for the new (easy) completion.
    const stats = JSON.parse(testStorage.get('player_stats:test-user') as string);
    expect(stats.xp).toBe(117);
    // The new completion proceeded under normal rules with its own journal.
    const settlement = readStageSettlement(nk, 'test-user', 'stage_1');
    expect(settlement?.attempt_id).not.toBe('att-old');
    expect(settlement?.state).toBe('settled');
  });

  it('leaves a fresh completion untouched when no failed settlement exists (#1558 Stage 3)', () => {
    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload()));
    expect(result.success).toBe(true);
    expect(result.recovered_rewards).toBeUndefined();
  });

  it('get_stage_settlements returns sanitized journal entries (#1558 Stage 3)', () => {
    writeClaimAndSettlement(
      nk,
      'test-user',
      'stage_9',
      undefined,
      'att-s',
      buildStageSettlement('stage_9', 'att-s', { stars_earned: 3, score: 0 })
    );
    recordIntendedXp(nk, 'test-user', 'stage_9', 42, logger);
    (nk.storageList as jest.Mock).mockReturnValue([
      {
        collection: STAGE_SETTLEMENT_COLLECTION,
        key: 'test-user:stage_9',
        userId: 'test-user',
        value: testStorage.get(`${STAGE_SETTLEMENT_COLLECTION}:test-user:stage_9`),
        version: '1',
      },
    ]);
    const res = JSON.parse(rpcGetStageSettlements(ctx, logger, nk, '{}'));
    expect(res.success).toBe(true);
    const row = res.settlements.find((s: { stage_id: string }) => s.stage_id === 'stage_9');
    expect(row).toMatchObject({
      stage_id: 'stage_9',
      attempt_id: 'att-s',
      state: 'pending',
      intended_xp: 42,
    });
    expect(row.effects.xp).toBe('pending');
    expect(row.request).toBeUndefined();
  });

  it('registers the get_stage_settlements RPC endpoint (#1558 Stage 3)', () => {
    const registerRpc = jest.fn();
    registerRpcGetStageSettlements({ registerRpc } as never);
    expect(registerRpc).toHaveBeenCalledWith(
      'armored_archer/get_stage_settlements',
      expect.any(Function)
    );
  });

  it('get_stage_settlements rejects a non-object payload', () => {
    const res = JSON.parse(rpcGetStageSettlements(ctx, logger, nk, 'not-json'));
    expect(res.success).toBe(false);
    expect(res.error_code).toBe('VALIDATION_ERROR');
  });

  it('get_stage_settlements reports a storage failure', () => {
    (nk.storageList as jest.Mock).mockImplementation(() => {
      throw new Error('db down');
    });
    const res = JSON.parse(rpcGetStageSettlements(ctx, logger, nk, '{}'));
    expect(res.success).not.toBe(true);
    expect(res.error_code).toBe('DATABASE_ERROR');
  });

  it('skips malformed journal rows in the sanitized list (#1558 Stage 3)', () => {
    writeClaimAndSettlement(
      nk,
      'test-user',
      'stage_9',
      undefined,
      'att-s',
      buildStageSettlement('stage_9', 'att-s', { stars_earned: 3, score: 0 })
    );
    (nk.storageList as jest.Mock).mockReturnValue([
      {
        collection: STAGE_SETTLEMENT_COLLECTION,
        key: 'test-user:stage_9',
        userId: 'test-user',
        value: 'not-json{{{',
        version: '1',
      },
      {
        collection: STAGE_SETTLEMENT_COLLECTION,
        key: 'test-user:stage_9',
        userId: 'test-user',
        value: testStorage.get(`${STAGE_SETTLEMENT_COLLECTION}:test-user:stage_9`),
        version: '1',
      },
    ]);
    const res = JSON.parse(rpcGetStageSettlements(ctx, logger, nk, '{}'));
    expect(res.success).toBe(true);
    expect(res.settlements).toHaveLength(1);
    expect(res.settlements[0].stage_id).toBe('stage_9');
  });

  it('recovers only the failed xp leg when loot already settled (#1558 Stage 3)', () => {
    writeClaimAndSettlement(
      nk,
      'test-user',
      'stage_1',
      undefined,
      'att-old',
      buildStageSettlement('stage_1', 'att-old', { stars_earned: 3, score: 0 })
    );
    recordIntendedXp(nk, 'test-user', 'stage_1', 77, logger);
    // Loot landed before the crash; only the XP leg failed.
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'loot', 'settled', logger)).toBe(true);
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'xp', 'failed', logger)).toBe(true);
    testStorage.set(
      `${STAGE_COMPLETION_CLAIM_COLLECTION}:test-user:stage_1`,
      JSON.stringify({ claimed_at: Date.now() - 400000, stage_id: 'stage_1', attempt_id: 'att-old' })
    );
    testStorage.set(
      'player_stats:test-user',
      JSON.stringify({
        user_id: 'test-user',
        level: 1,
        xp: 10,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      })
    );

    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload()));
    expect(result.success).toBe(true);
    expect(result.recovered_rewards).toEqual({ loot_recovered: false, xp_recovered: 77 });
    const stats = JSON.parse(testStorage.get('player_stats:test-user') as string);
    expect(stats.xp).toBe(117);
  });

  it('recovers only the failed loot leg when xp already settled (#1558 Stage 3)', () => {
    writeClaimAndSettlement(
      nk,
      'test-user',
      'stage_1',
      undefined,
      'att-old',
      buildStageSettlement('stage_1', 'att-old', { stars_earned: 3, score: 0 })
    );
    const failedGear = {
      id: '',
      type: 'bow',
      name: 'Recovered Bow',
      rarity: 'rare',
      level: 1,
      stats: [],
      modifiers: [],
      timestamp: 1,
    };
    recordIntendedLoot(
      nk,
      'test-user',
      'stage_1',
      { gear: failedGear, grant_id: 'test-user:stage_1:att-old:gear:0', drop_rate: 1, roll: 0 },
      logger
    );
    // XP landed before the crash; only the loot leg failed.
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'xp', 'settled', logger)).toBe(true);
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'loot', 'failed', logger)).toBe(true);
    testStorage.set(
      `${STAGE_COMPLETION_CLAIM_COLLECTION}:test-user:stage_1`,
      JSON.stringify({ claimed_at: Date.now() - 400000, stage_id: 'stage_1', attempt_id: 'att-old' })
    );

    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload()));
    expect(result.success).toBe(true);
    expect(result.recovered_rewards).toEqual({ loot_recovered: true, xp_recovered: 0 });
    const recoveredInsert = insertGearItemMock.mock.calls.find(
      (call) => call[4] === 'test-user:stage_1:att-old:gear:0'
    );
    expect(recoveredInsert).toBeDefined();
  });

  it('fails visibly when the recovery loot insert exhausts (#1558 Stage 3)', () => {
    writeClaimAndSettlement(
      nk,
      'test-user',
      'stage_1',
      undefined,
      'att-old',
      buildStageSettlement('stage_1', 'att-old', { stars_earned: 3, score: 0 })
    );
    const failedGear = {
      id: '',
      type: 'bow',
      name: 'Recovered Bow',
      rarity: 'rare',
      level: 1,
      stats: [],
      modifiers: [],
      timestamp: 1,
    };
    recordIntendedLoot(
      nk,
      'test-user',
      'stage_1',
      { gear: failedGear, grant_id: 'test-user:stage_1:att-old:gear:0', drop_rate: 1, roll: 0 },
      logger
    );
    recordIntendedXp(nk, 'test-user', 'stage_1', 77, logger);
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'loot', 'failed', logger)).toBe(true);
    testStorage.set(
      `${STAGE_COMPLETION_CLAIM_COLLECTION}:test-user:stage_1`,
      JSON.stringify({ claimed_at: Date.now() - 400000, stage_id: 'stage_1', attempt_id: 'att-old' })
    );
    insertGearItemMock.mockReturnValue({ success: false });

    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload()));
    expect(result.success).toBe(false);
    // The recovery rolled the loot marker back to failed; retry stays safe.
    const settlement = readStageSettlement(nk, 'test-user', 'stage_1');
    expect(settlement?.state).toBe('failed');
    expect(settlement?.effects.loot).toBe('failed');
  });

  it('fails visibly when the recovery XP grant throws (#1558 Stage 3)', () => {
    writeClaimAndSettlement(
      nk,
      'test-user',
      'stage_1',
      undefined,
      'att-old',
      buildStageSettlement('stage_1', 'att-old', { stars_earned: 3, score: 0 })
    );
    const failedGear = {
      id: '',
      type: 'bow',
      name: 'Recovered Bow',
      rarity: 'rare',
      level: 1,
      stats: [],
      modifiers: [],
      timestamp: 1,
    };
    recordIntendedLoot(
      nk,
      'test-user',
      'stage_1',
      { gear: failedGear, grant_id: 'test-user:stage_1:att-old:gear:0', drop_rate: 1, roll: 0 },
      logger
    );
    recordIntendedXp(nk, 'test-user', 'stage_1', 77, logger);
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'loot', 'failed', logger)).toBe(true);
    expect(tryTransitionEffect(nk, 'test-user', 'stage_1', 'xp', 'failed', logger)).toBe(true);
    testStorage.set(
      `${STAGE_COMPLETION_CLAIM_COLLECTION}:test-user:stage_1`,
      JSON.stringify({ claimed_at: Date.now() - 400000, stage_id: 'stage_1', attempt_id: 'att-old' })
    );
    const xpSpy = jest
      .spyOn(stageXpModule, 'grantStageXP')
      .mockImplementationOnce(() => {
        throw new Error('xp boom');
      });

    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload()));
    expect(result.success).toBe(false);
    const settlement = readStageSettlement(nk, 'test-user', 'stage_1');
    expect(settlement?.state).toBe('failed');
    expect(settlement?.effects.xp).toBe('failed');
    xpSpy.mockRestore();
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
