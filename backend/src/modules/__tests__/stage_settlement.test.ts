/** Settlement journal (issue #1558, Stage 1) — record-only, best-effort. */
import { createMockLogger, createMockNakama, testStorage } from '../../__mocks__/nakama';
import {
  buildStageSettlement,
  computeSettlementState,
  markSettlementEffect,
  readStageSettlement,
  recordIntendedLoot,
  settlementKey,
  writeClaimAndSettlement,
  STAGE_SETTLEMENT_COLLECTION,
} from '../stage_settlement';
import { STAGE_COMPLETION_CLAIM_COLLECTION } from '../stage_progression';

const logger = createMockLogger();
const USER = 'test-user';
const STAGE = 'stage_1_3';

beforeEach(() => {
  testStorage.clear();
  jest.clearAllMocks();
});

describe('settlementKey / buildStageSettlement', () => {
  it('keys like the claim: userId:stageId', () => {
    expect(settlementKey('u1', 's2')).toBe('u1:s2');
  });

  it('builds a pending settlement with all effects pending', () => {
    const s = buildStageSettlement(STAGE, 'att-1', {
      difficulty: 'hard',
      stars_earned: 3,
      score: 1200,
      boss_defeated: true,
    });
    expect(s.stage_id).toBe(STAGE);
    expect(s.attempt_id).toBe('att-1');
    expect(s.state).toBe('pending');
    expect(Object.values(s.effects)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
    expect(s.request.difficulty).toBe('hard');
    expect(s.intended_loot).toBeUndefined();
  });
});

describe('computeSettlementState', () => {
  const base = buildStageSettlement(STAGE, undefined, { stars_earned: 3, score: 0 }).effects;

  it('is pending while any effect is pending and none failed', () => {
    expect(computeSettlementState({ ...base, best_of: 'settled' })).toBe('pending');
  });

  it('is settled only when every effect settled', () => {
    const all = Object.fromEntries(Object.keys(base).map((k) => [k, 'settled'])) as typeof base;
    expect(computeSettlementState(all)).toBe('settled');
  });

  it('is failed when any effect failed, even with others pending', () => {
    expect(computeSettlementState({ ...base, loot: 'failed' })).toBe('failed');
  });
});

describe('writeClaimAndSettlement', () => {
  it('writes claim and settlement atomically in one batch', () => {
    const nk = createMockNakama();
    const settlement = buildStageSettlement(STAGE, 'att-9', { stars_earned: 2, score: 50 });
    writeClaimAndSettlement(nk, USER, STAGE, undefined, 'att-9', settlement);

    expect(nk.storageWrite).toHaveBeenCalledTimes(1);
    const batch = (nk.storageWrite as jest.Mock).mock.calls[0][0];
    expect(batch).toHaveLength(2);
    expect(batch[0].collection).toBe(STAGE_COMPLETION_CLAIM_COLLECTION);
    expect(batch[0].key).toBe(`${USER}:${STAGE}`);
    expect(batch[0].version).toBe('*');
    expect(batch[1].collection).toBe(STAGE_SETTLEMENT_COLLECTION);
    expect(batch[1].key).toBe(`${USER}:${STAGE}`);

    // Both rows are actually readable afterwards.
    const stored = readStageSettlement(nk, USER, STAGE);
    expect(stored?.attempt_id).toBe('att-9');
    expect(stored?.state).toBe('pending');
    const claimRaw = testStorage.get(`${STAGE_COMPLETION_CLAIM_COLLECTION}:${USER}:${STAGE}`);
    expect(claimRaw).toBeDefined();
    expect(JSON.parse(claimRaw!)).toMatchObject({ stage_id: STAGE, attempt_id: 'att-9' });
  });

  it('passes the claim OCC version through', () => {
    const nk = createMockNakama();
    writeClaimAndSettlement(nk, USER, STAGE, '7', undefined, buildStageSettlement(STAGE, undefined, { stars_earned: 3, score: 0 }));
    const batch = (nk.storageWrite as jest.Mock).mock.calls[0][0];
    expect(batch[0].version).toBe('7');
  });
});

describe('readStageSettlement', () => {
  it('returns undefined when no settlement exists', () => {
    expect(readStageSettlement(createMockNakama(), USER, STAGE)).toBeUndefined();
  });

  it('returns undefined on corrupt stored data', () => {
    testStorage.set(`${STAGE_SETTLEMENT_COLLECTION}:${USER}:${STAGE}`, '{not json');
    expect(readStageSettlement(createMockNakama(), USER, STAGE)).toBeUndefined();
  });

  it('returns undefined on a structurally invalid row', () => {
    testStorage.set(`${STAGE_SETTLEMENT_COLLECTION}:${USER}:${STAGE}`, JSON.stringify({ hello: 1 }));
    expect(readStageSettlement(createMockNakama(), USER, STAGE)).toBeUndefined();
  });
});

describe('markSettlementEffect / recordIntendedLoot', () => {
  function seed(nk: ReturnType<typeof createMockNakama>): void {
    writeClaimAndSettlement(nk, USER, STAGE, undefined, 'att-1', buildStageSettlement(STAGE, 'att-1', { stars_earned: 3, score: 10 }));
  }

  it('marks an effect settled and flips state to settled when all are done', () => {
    const nk = createMockNakama();
    seed(nk);
    for (const effect of ['best_of', 'boss_defeat', 'modifier_pool', 'loot'] as const) {
      markSettlementEffect(nk, USER, STAGE, effect, 'settled', logger);
    }
    expect(readStageSettlement(nk, USER, STAGE)?.state).toBe('pending');
    markSettlementEffect(nk, USER, STAGE, 'xp', 'settled', logger);
    const s = readStageSettlement(nk, USER, STAGE);
    expect(s?.state).toBe('settled');
    expect(s?.effects.xp).toBe('settled');
  });

  it('marks a failure and flips state to failed', () => {
    const nk = createMockNakama();
    seed(nk);
    markSettlementEffect(nk, USER, STAGE, 'loot', 'failed', logger);
    markSettlementEffect(nk, USER, STAGE, 'xp', 'failed', logger);
    const s = readStageSettlement(nk, USER, STAGE);
    expect(s?.state).toBe('failed');
    expect(s?.effects.loot).toBe('failed');
  });

  it('records intended loot without rerolling fields', () => {
    const nk = createMockNakama();
    seed(nk);
    recordIntendedLoot(nk, USER, STAGE, { gear: { name: 'Oak Bow' }, grant_id: 'g-1', drop_rate: 0.4, roll: 0.12 }, logger);
    expect(readStageSettlement(nk, USER, STAGE)?.intended_loot).toEqual({
      gear: { name: 'Oak Bow' },
      grant_id: 'g-1',
      drop_rate: 0.4,
      roll: 0.12,
    });
  });

  it('is a silent no-op when no settlement exists', () => {
    const nk = createMockNakama();
    markSettlementEffect(nk, USER, STAGE, 'loot', 'settled', logger);
    recordIntendedLoot(nk, USER, STAGE, { gear: null, drop_rate: 0, roll: 0 }, logger);
    expect(readStageSettlement(nk, USER, STAGE)).toBeUndefined();
  });

  it('swallows storage failures (journaling never breaks completion)', () => {
    const nk = createMockNakama();
    seed(nk);
    (nk.storageWrite as jest.Mock).mockImplementationOnce(() => {
      throw new Error('storage down');
    });
    expect(() => markSettlementEffect(nk, USER, STAGE, 'loot', 'settled', logger)).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });
});
