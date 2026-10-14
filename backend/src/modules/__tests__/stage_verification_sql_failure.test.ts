import {
  createMockContext,
  createMockLogger,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { rpcStageComplete } from '../gear_system';
import { resetRateLimiting } from '../rate_limit';
const RPC = 'armored_archer/stage_complete';
const OP = 'gear_db.getDefeatedBossesFromDB';
const payload =
  '{"stage_id":"stage_verify","boss_defeated":true,"boss_id":"boss_fire","difficulty":"easy"}';

describe('stage boss verification SQL failure through real helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testStorage.clear();
    resetRateLimiting();
  });
  afterEach(() => jest.restoreAllMocks());
  it.each([
    { roll: 0.99, metricFails: false },
    { roll: 0.01, metricFails: false },
    { roll: 0.99, metricFails: true },
  ])('fails safely after earlier writes %j', ({ roll, metricFails }) => {
    jest.spyOn(Math, 'random').mockReturnValue(roll);
    const nk = createMockNakama();
    const logger = createMockLogger();
    const ctx = createMockContext();
    const original = (nk.sqlQuery as jest.Mock).getMockImplementation()!;
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('FROM boss_defeats') && sql.includes('ORDER BY first_defeated_at'))
        throw new Error('private SQL driver token');
      return original(sql, params);
    });
    nk.metricsCounterAdd = jest.fn(() => {
      if (metricFails) throw new Error('metric unavailable');
    });
    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload));
    expect(result).toEqual({
      success: false,
      error: 'Failed to process stage completion',
      error_code: 'INTERNAL_ERROR',
    });
    expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, OP);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op: OP, rpc: RPC }, 1);
    expect(nk.sqlQuery).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY first_defeated_at'),
      [ctx.userId]
    );
    const calls = (nk.sqlQuery as jest.Mock).mock.calls;
    const count = calls.length;
    expect(calls.some(([sql]) => sql.includes('INSERT INTO inventory_items'))).toBe(roll < 0.1);
    expect(testStorage.has(`boss_defeats:${ctx.userId}`)).toBe(true);
    expect(JSON.parse(testStorage.get(`unlocked_modifier_pools:${ctx.userId}`)!)).toContain(
      'fire_arrow'
    );
    const writes = (nk.storageWrite as jest.Mock).mock.calls.flat(2);
    expect(writes.some((r: any) => r.collection === 'stage_completion_claims')).toBe(true);
    expect(writes.some((r: any) => r.collection === 'stage_completion')).toBe(true);
    expect(writes.some((r: any) => r.collection === 'player_stats')).toBe(false);
    expect(
      writes.some((r: any) => r.value?.action === 'stage_complete' && r.value?.result === 'failure')
    ).toBe(true);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls, writes])).not.toContain(
      'private'
    );
    expect(JSON.parse(rpcStageComplete(ctx, logger, nk, payload)).error_code).toBe(
      'DUPLICATE_COMPLETION'
    );
    expect(nk.sqlQuery).toHaveBeenCalledTimes(count);
  });
  it.each([{ rows: [] }, { rows: [{ boss_id: 'boss_fire' }] }])(
    'preserves successful verification rows %j',
    ({ rows }) => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      const nk = createMockNakama();
      const original = (nk.sqlQuery as jest.Mock).getMockImplementation()!;
      (nk.sqlQuery as jest.Mock).mockImplementation((sql: string, params: unknown[]) =>
        sql.includes('FROM boss_defeats') && sql.includes('ORDER BY first_defeated_at')
          ? rows
          : original(sql, params)
      );
      nk.metricsCounterAdd = jest.fn();
      const result = JSON.parse(
        rpcStageComplete(createMockContext(), createMockLogger(), nk, payload)
      );
      expect(result.success).toBe(true);
      expect(result.xp_gained).toBe(63);
      expect(result.boss_defeat_count).toBe(1);
      expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
    }
  );
});
