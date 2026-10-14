import {
  createMockContext,
  createMockLogger,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { rpcStageComplete } from '../gear_system';
import { resetRateLimiting } from '../rate_limit';
const payload =
  '{"stage_id":"stage_loot_failure","boss_defeated":true,"boss_id":"boss_fire","difficulty":"easy"}';
const RPC = 'armored_archer/stage_complete';
const OP = 'gear_db.insertGearItem';
describe('exhausted stage loot insertion fails completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testStorage.clear();
    resetRateLimiting();
    jest.spyOn(Math, 'random').mockReturnValue(0.01);
  });
  afterEach(() => jest.restoreAllMocks());
  it.each([
    { throws: true, metricFails: false },
    { throws: true, metricFails: true },
    { throws: false, metricFails: false },
  ])('fails safely with retained claim %j', ({ throws, metricFails }) => {
    const nk = createMockNakama();
    const ctx = createMockContext();
    const logger = createMockLogger();
    const original = (nk.sqlQuery as jest.Mock).getMockImplementation()!;
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO inventory_items')) {
        if (throws) throw new Error('private SQL driver token');
        return [];
      }
      return original(sql, params);
    });
    nk.metricsCounterAdd = jest.fn(() => {
      if (metricFails) throw new Error('metrics down');
    });
    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload));
    expect(result).toEqual({
      success: false,
      error: 'Failed to process stage completion',
      error_code: 'INTERNAL_ERROR',
    });
    const calls = (nk.sqlQuery as jest.Mock).mock.calls;
    const count = calls.length;
    expect(calls.filter(([sql]) => sql.includes('INSERT INTO inventory_items'))).toHaveLength(3);
    expect(
      calls
        .filter(([sql]) => sql.includes('INSERT INTO inventory_items'))
        .every(([, params]) => params[0] === ctx.userId)
    ).toBe(true);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(throws ? 3 : 0);
    if (throws) {
      expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op: OP, rpc: RPC }, 1);
      expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, OP);
    }
    const writes = (nk.storageWrite as jest.Mock).mock.calls.flat(2);
    expect(writes.some((r: any) => r.collection === 'stage_completion_claims')).toBe(true);
    expect(writes.some((r: any) => r.collection === 'stage_completion')).toBe(true);
    expect(writes.some((r: any) => r.collection === 'player_stats')).toBe(false);
    expect(
      writes.some(
        (r: any) =>
          r.value?.resource === 'loot_persistence' &&
          r.value?.result === 'failure' &&
          r.value?.error === 'PERSISTENCE_FAILED: Failed to persist stage loot'
      )
    ).toBe(true);
    expect(
      writes.some((r: any) => r.value?.action === 'stage_complete' && r.value?.result === 'success')
    ).toBe(false);
    expect(testStorage.has(`boss_defeats:${ctx.userId}`)).toBe(true);
    expect(JSON.parse(testStorage.get(`unlocked_modifier_pools:${ctx.userId}`)!)).toContain(
      'fire_arrow'
    );
    expect(
      JSON.stringify([
        result,
        (logger.error as jest.Mock).mock.calls,
        (logger.warn as jest.Mock).mock.calls,
        writes,
      ])
    ).not.toContain('private');
    expect(JSON.parse(rpcStageComplete(ctx, logger, nk, payload)).error_code).toBe(
      'DUPLICATE_COMPLETION'
    );
    expect(nk.sqlQuery).toHaveBeenCalledTimes(count);
    // A later retry is not recovery: retained best-of suppresses the reward.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60 * 1000 + 1);
    const later = JSON.parse(rpcStageComplete(ctx, logger, nk, payload));
    expect(later.success).toBe(true);
    expect(later.xp_gained).toBe(0);
    expect(later.loot.dropped).toBe(false);
    expect(
      (nk.sqlQuery as jest.Mock).mock.calls.filter(([sql]) =>
        sql.includes('INSERT INTO inventory_items')
      )
    ).toHaveLength(3);
  });
  it('keeps successful second insert and XP success', () => {
    const nk = createMockNakama();
    const original = (nk.sqlQuery as jest.Mock).getMockImplementation()!;
    let attempts = 0;
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO inventory_items') && ++attempts === 1)
        throw new Error('private SQL');
      return original(sql, params);
    });
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(
      rpcStageComplete(createMockContext(), createMockLogger(), nk, payload)
    );
    expect(result.success).toBe(true);
    expect(result.loot.dropped).toBe(true);
    expect(result.xp_gained).toBe(63);
    expect(attempts).toBe(2);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
  });
});
