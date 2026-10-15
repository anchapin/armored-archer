/** Server-issued stage challenge (reward integration contract, option B). */
import {
  createMockLogger,
  createMockContext,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { resetRateLimiting } from '../rate_limit';
import {
  rpcStageStart,
  consumeStageChallenge,
  resolveStageTier,
  STAGE_CHALLENGE_COLLECTION,
} from '../stage_challenge';

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

describe('stage challenge', () => {
  let nk: any, ctx: any, logger: any;

  const startStage = (stageId: string) =>
    JSON.parse(rpcStageStart(ctx, logger, nk, JSON.stringify({ stage_id: stageId })));

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

  it('maps campaign tiers server-side', () => {
    expect(resolveStageTier('1_1')).toBe('easy');
    expect(resolveStageTier('2_1')).toBe('medium');
    expect(resolveStageTier('3_1')).toBe('hard');
    expect(resolveStageTier('nope')).toBeUndefined();
  });

  it('issues a challenge with the server-snapshotted tier', () => {
    const res = startStage('3_1');
    expect(res.success).toBe(true);
    expect(res.tier).toBe('hard');
    expect(res.challenge_id).toMatch(/^[0-9a-f]{32}$/);
    expect(res.expires_at).toBeGreaterThan(Date.now());
    const stored = testStorage.get(`${STAGE_CHALLENGE_COLLECTION}:${res.challenge_id}`);
    expect(stored).toBeDefined();
  });

  it('rejects stage_start for an unknown stage', () => {
    const res = startStage('forged_stage');
    expect(res.success).toBe(false);
    expect(res.error_code).toBe('UNKNOWN_STAGE');
  });

  it('overrides the client difficulty claim with the server snapshot', () => {
    const start = startStage('3_1'); // server tier hard
    const done = JSON.parse(
      rpcStageComplete(
        ctx,
        logger,
        nk,
        JSON.stringify({
          stage_id: '3_1',
          boss_defeated: false,
          difficulty: 'easy', // client lies low; server snapshot wins
          challenge_id: start.challenge_id,
        })
      )
    );
    expect(done.success).toBe(true);
    expect(done.drop_rate).toBeCloseTo(0.675, 3); // hard tier, not easy
  });

  it('rejects completion with a consumed, mismatched, or unknown challenge', () => {
    const start = startStage('1_1');
    const complete = (challengeId?: string, stageId = '1_1') =>
      JSON.parse(
        rpcStageComplete(
          ctx,
          logger,
          nk,
          JSON.stringify({
            stage_id: stageId,
            boss_defeated: false,
            difficulty: 'easy',
            challenge_id: challengeId,
          })
        )
      );
    expect(complete('forged').error_code).toBe('INVALID_CHALLENGE');
    expect(complete(start.challenge_id, '1_2').error_code).toBe('CHALLENGE_MISMATCH');
    expect(complete(start.challenge_id).success).toBe(true);
  });

  it('rejects direct consumption of an already-consumed challenge', () => {
    const start = startStage('1_1');
    const first = consumeStageChallenge(nk, 'test-user', start.challenge_id, '1_1');
    expect('tier' in first && first.tier).toBe('easy');
    const again = consumeStageChallenge(nk, 'test-user', start.challenge_id, '1_1');
    expect('error' in again && again.error).toContain('CHALLENGE_CONSUMED');
  });

  it('uses the challenge ID as the attempt key so a retry resumes after consumption', () => {
    const start = startStage('1_1');
    const payload = JSON.stringify({
      stage_id: '1_1',
      boss_defeated: false,
      difficulty: 'easy',
      challenge_id: start.challenge_id,
    });
    const first = JSON.parse(rpcStageComplete(ctx, logger, nk, payload));
    expect(first.success).toBe(true);
    // Retry of the same attempt: challenge is consumed but the resume path
    // answers from the outcome record.
    const second = JSON.parse(rpcStageComplete(ctx, logger, nk, payload));
    expect(second.success).toBe(true);
    expect(second.resumed).toBe(true);
  });

  it('consumeStageChallenge fails closed on expiry', () => {
    const start = startStage('1_1');
    const key = `${STAGE_CHALLENGE_COLLECTION}:${start.challenge_id}`;
    const record = JSON.parse(testStorage.get(key) as string);
    record.expires_at = Date.now() - 1000;
    testStorage.set(key, JSON.stringify(record));
    const res = consumeStageChallenge(nk, 'test-user', start.challenge_id, '1_1');
    expect('error' in res && res.error).toContain('CHALLENGE_EXPIRED');
  });
});
