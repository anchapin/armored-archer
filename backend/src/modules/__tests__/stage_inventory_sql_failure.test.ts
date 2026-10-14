import {
  createMockContext,
  createMockLogger,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { getPlayerInventory, rpcStageComplete } from '../gear_system';
import { resetRateLimiting } from '../rate_limit';
const RPC = 'armored_archer/stage_complete';
const payload = '{"stage_id":"stage_1","boss_defeated":false,"difficulty":"easy"}';

describe('stage completion inventory SQL failure contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testStorage.clear();
    resetRateLimiting();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['inventory_items', 'gear_db.getPlayerGearFromDB'],
    ['loadout', 'gear_db.getPlayerLoadoutFromDB'],
    ['unlocked_modifier_pools', 'gear_db.getUnlockedModifierPoolsFromDB'],
  ])('fails safely when %s inventory read fails', (table, op) => {
    const nk = createMockNakama();
    const ctx = createMockContext();
    const logger = createMockLogger();
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes(`FROM ${table}`)) throw new Error('private SQL user driver token');
      return [];
    });
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload));
    expect(result).toEqual({
      success: false,
      error: 'Failed to process stage completion',
      error_code: 'INTERNAL_ERROR',
    });
    expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, op);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op, rpc: RPC }, 1);
    const writes = (nk.storageWrite as jest.Mock).mock.calls.flat(2);
    expect(writes.some((r: any) => r.collection === 'player_stats')).toBe(false);
    expect(writes.some((r: any) => r.collection === 'stage_completion_claims')).toBe(true);
    expect(writes.some((r: any) => r.collection === 'stage_completion')).toBe(true);
    expect(
      writes.some(
        (r: any) =>
          r.collection === 'audit_logs' &&
          r.value?.action === 'stage_complete' &&
          r.value?.result === 'failure' &&
          r.value?.error === 'Failed to process stage completion'
      )
    ).toBe(true);
    expect(
      (nk.sqlQuery as jest.Mock).mock.calls.every(
        ([sql, params]) => !sql.includes('INSERT INTO inventory_items') && params[0] === ctx.userId
      )
    ).toBe(true);
    expect(
      writes.some((r: any) => r.value?.action === 'stage_complete' && r.value?.result === 'success')
    ).toBe(false);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls, writes])).not.toContain(
      'private'
    );
    const queriesBeforeRetry = (nk.sqlQuery as jest.Mock).mock.calls.length;
    expect(JSON.parse(rpcStageComplete(ctx, logger, nk, payload)).error_code).toBe(
      'DUPLICATE_COMPLETION'
    );
    expect(nk.sqlQuery).toHaveBeenCalledTimes(queriesBeforeRetry);
  });

  it('keeps genuinely empty inventory and no-drop completion successful', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockReturnValue([]);
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(
      rpcStageComplete(createMockContext(), createMockLogger(), nk, payload)
    );
    expect(result.success).toBe(true);
    expect(result.loot).toEqual({ dropped: false, gear: null });
    expect(result.xp_gained).toBe(30);
    expect(result.unlocked_modifier_pools).toEqual([]);
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
  });

  it('preserves inventory fallback for callers without context', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('legacy SQL');
    });
    expect(getPlayerInventory(nk, 'user', createMockLogger())).toMatchObject({
      gear: [],
      unlocked_modifier_pools: [],
    });
  });

  it('keeps SQL failure safe when metric recording fails', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('private SQL');
    });
    nk.metricsCounterAdd = jest.fn(() => {
      throw new Error('metric down');
    });
    expect(
      JSON.parse(rpcStageComplete(createMockContext(), createMockLogger(), nk, payload)).error_code
    ).toBe('INTERNAL_ERROR');
  });
});
