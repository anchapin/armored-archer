/** Bonus wiring activation (reward integration contract, option A). */
import {
  createMockLogger,
  createMockContext,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { resetRateLimiting } from '../rate_limit';
import {
  deriveChallengeRoll,
  rpcStageStart,
  STAGE_CHALLENGE_COLLECTION,
} from '../stage_challenge';
import { makeStageGrantId } from '../stage_grants';
import { PLAYER_CURRENCY_COLLECTION } from '../currency';

jest.mock('../audit', () => ({ logAudit: jest.fn() }));
jest.mock('../balance_analytics', () => ({
  recordStageAttempt: jest.fn().mockResolvedValue(undefined),
  recordDrop: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../utils/db_optimizer', () => ({ invalidatePlayerStatsCache: jest.fn() }));

const insertGearItemMock = jest.fn().mockReturnValue({ success: true, item_id: 'g1' });
jest.mock('../gear_db', () => ({
  insertGearItem: (...args: any[]) => insertGearItemMock(...args),
  getGearItemByGrantId: jest.fn().mockReturnValue(null),
  getPlayerGearFromDB: jest.fn().mockReturnValue([]),
  getPlayerLoadoutFromDB: jest.fn().mockReturnValue({}),
  getFullInventoryFromDB: jest
    .fn()
    .mockReturnValue({ gear: [], loadout: {}, unlocked_modifier_pools: [] }),
  recordBossDefeatInDB: jest.fn(),
  getDefeatedBossesFromDB: jest.fn().mockReturnValue([]),
  getBossDefeatCount: jest.fn().mockReturnValue(0),
  unlockModifierPoolInDB: jest.fn(),
  getUnlockedModifierPoolsFromDB: jest.fn().mockReturnValue([]),
  equipItemInDB: jest.fn(),
  unequipItemInDB: jest.fn(),
}));

import { rpcStageComplete } from '../gear_system';

describe('stage bonus wiring (contract A)', () => {
  let nk: any, ctx: any, logger: any;

  const startStage = (stageId: string) =>
    JSON.parse(rpcStageStart(ctx, logger, nk, JSON.stringify({ stage_id: stageId })));

  const rollFor = (challengeId: string) => {
    const raw = testStorage.get(`${STAGE_CHALLENGE_COLLECTION}:${challengeId}`);
    const record = JSON.parse(raw as string);
    return deriveChallengeRoll(record.seed, challengeId);
  };

  // Issue challenges until the seed-derived extra-item roll matches the
  // predicate (the draw is deterministic per challenge, so we pick one
  // that exercises the desired branch instead of mocking Math.random).
  const startStageWithRoll = (predicate: (roll: number) => boolean) => {
    for (let i = 0; i < 50; i++) {
      const start = startStage('3_1');
      if (predicate(rollFor(start.challenge_id))) return start;
    }
    throw new Error('no challenge with the desired roll in 50 tries');
  };

  const complete = (challengeId?: string, difficulty = 'hard') =>
    JSON.parse(
      rpcStageComplete(
        ctx,
        logger,
        nk,
        JSON.stringify({
          stage_id: '3_1',
          boss_defeated: false,
          difficulty,
          ...(challengeId ? { challenge_id: challengeId } : {}),
        })
      )
    );

  const readCurrency = () => {
    const raw = testStorage.get(`${PLAYER_CURRENCY_COLLECTION}:test-user`);
    return raw ? JSON.parse(raw as string) : undefined;
  };

  const readStats = () => {
    const raw = testStorage.get('player_stats:test-user');
    return raw ? JSON.parse(raw as string) : undefined;
  };

  beforeEach(() => {
    nk = createMockNakama();
    ctx = createMockContext({ userId: 'test-user' });
    logger = createMockLogger();
    testStorage.clear();
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    resetRateLimiting();
  });

  afterEach(() => jest.spyOn(Math, 'random').mockRestore());

  it('applies the tier multiplier, coins, and grant IDs when a verified challenge is present', () => {
    const start = startStage('3_1'); // server tier hard
    const res = complete(start.challenge_id);

    expect(res.success).toBe(true);
    // hard: base XP 60 * 1.5 = 90; plan 1.2x -> 108; coins 10 * 1.2 = 12
    expect(res.xp_gained).toBe(108);
    expect(res.coins_gained).toBe(12);
    expect(res.bonus).toEqual({
      tier: 'hard',
      multiplier: 1.2,
      xp: { base: 90, bonus: 18, total: 108 },
      coins: { base: 10, bonus: 2, total: 12 },
    });
    expect(Array.isArray(res.gear_dropped_v2)).toBe(true);
    // base roll 0.5 < 0.675 -> one item; second item only if the
    // seed-derived extra roll for this challenge is < 0.2 (hard 1.2 - 1)
    const expectCount = rollFor(start.challenge_id) < 0.2 ? 2 : 1;
    expect(res.gear_dropped_v2).toHaveLength(expectCount);

    const attemptId = start.challenge_id; // gate maps challenge_id to attempt key
    const stats = readStats();
    expect(stats.applied_stage_grants).toContain(
      makeStageGrantId('test-user', '3_1', attemptId, 'xp')
    );
    const currency = readCurrency();
    expect(currency.coins).toBe(12);
    expect(currency.applied_stage_grants).toContain(
      makeStageGrantId('test-user', '3_1', attemptId, 'coins')
    );
  });

  it('pays base rewards only (no multiplier, no coins) without a challenge', () => {
    const res = complete(undefined, 'hard');
    expect(res.success).toBe(true);
    expect(res.xp_gained).toBe(90); // base only
    expect(res.coins_gained).toBe(0);
    expect(res.bonus).toBeNull();
    expect(readCurrency()).toBeUndefined();
  });

  it('answers a same-attempt replay from the outcome record without double-paying', () => {
    const start = startStage('3_1');
    const first = complete(start.challenge_id);
    expect(first.success).toBe(true);

    const replay = complete(start.challenge_id);
    expect(replay.success).toBe(true);
    expect(replay.xp_gained).toBe(108);

    const currency = readCurrency();
    expect(currency.coins).toBe(12); // not 24
    const stats = readStats();
    expect(stats.xp).toBe(108); // not 216
  });

  it('grants two gear items with distinct grant IDs when the plan yields gearCount 2', () => {
    // hard multiplier 1.2: gearCount 2 requires the seed-derived extra roll < 0.2
    const start = startStageWithRoll((roll) => roll < 0.2);
    const res = complete(start.challenge_id);

    expect(res.success).toBe(true);
    expect(res.gear_dropped_v2).toHaveLength(2);
    expect(res.gear_dropped).toEqual(res.gear_dropped_v2[0]); // singular stays first item

    const grantIds = insertGearItemMock.mock.calls.map((c) => c[c.length - 1]);
    expect(grantIds).toContain(makeStageGrantId('test-user', '3_1', start.challenge_id, 'gear:0'));
    expect(grantIds).toContain(makeStageGrantId('test-user', '3_1', start.challenge_id, 'gear:1'));
  });
});
