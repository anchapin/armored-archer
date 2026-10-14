import {
  createMockContext,
  createMockLogger,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { rpcStageComplete, recordBossDefeat } from '../gear_system';
import { resetRateLimiting } from '../rate_limit';
const RPC = 'armored_archer/stage_complete';
const UNLOCK = 'gear_db.unlockModifierPoolInDB';
const READ = 'gear_db.getUnlockedModifierPoolsFromDB';
function request(boss: boolean): string {
  return JSON.stringify({
    stage_id: 'stage_pool',
    boss_defeated: boss,
    boss_id: boss ? 'boss_fire' : undefined,
    enemy_type: boss ? undefined : 'goblin',
    difficulty: 'easy',
  });
}

describe('stage modifier pool SQL failure through real helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testStorage.clear();
    resetRateLimiting();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [true, 'check', UNLOCK],
    [true, 'insert', UNLOCK],
    [true, 'audit read', READ],
    [false, 'check', UNLOCK],
    [false, 'insert', UNLOCK],
  ])('fails safely boss=%s phase=%s', (boss, phase, operation) => {
    const nk = createMockNakama();
    const logger = createMockLogger();
    const ctx = createMockContext();
    const original = (nk.sqlQuery as jest.Mock).getMockImplementation()!;
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string, params: unknown[]) => {
      const isPool = sql.includes('unlocked_modifier_pools');
      const target =
        phase === 'check'
          ? sql.includes('AND modifier_id')
          : phase === 'insert'
            ? sql.includes('INSERT INTO')
            : sql.includes('ORDER BY unlocked_at');
      if (isPool && target) throw new Error('private SQL driver token');
      return original(sql, params);
    });
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, request(boss)));
    expect(result).toEqual({
      success: false,
      error: 'Failed to process stage completion',
      error_code: 'INTERNAL_ERROR',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Database query failed: rpc=%s op=%s',
      RPC,
      operation
    );
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      { op: operation, rpc: RPC },
      1
    );
    const queries = (nk.sqlQuery as jest.Mock).mock.calls;
    const count = queries.length;
    expect(queries.some(([sql]) => sql.includes('inventory_items'))).toBe(false);
    expect(queries.every(([, params]) => params[0] === ctx.userId)).toBe(true);
    const writes = (nk.storageWrite as jest.Mock).mock.calls.flat(2);
    expect(writes.some((r: any) => r.collection === 'stage_completion_claims')).toBe(true);
    expect(writes.some((r: any) => r.collection === 'stage_completion')).toBe(true);
    expect(writes.some((r: any) => r.collection === 'player_stats')).toBe(false);
    expect(writes.some((r: any) => r.value?.action === 'boss_defeat')).toBe(false);
    expect(
      writes.some((r: any) => r.value?.action === 'stage_complete' && r.value?.result === 'failure')
    ).toBe(true);
    expect(testStorage.has(`boss_defeats:${ctx.userId}`)).toBe(boss);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls, writes])).not.toContain(
      'private'
    );
    expect(JSON.parse(rpcStageComplete(ctx, logger, nk, request(boss))).error_code).toBe(
      'DUPLICATE_COMPLETION'
    );
    expect(nk.sqlQuery).toHaveBeenCalledTimes(count);
  });

  it.each([true, false])('keeps successful pool unlock boss=%s', (boss) => {
    const nk = createMockNakama();
    const ctx = createMockContext();
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(rpcStageComplete(ctx, createMockLogger(), nk, request(boss)));
    expect(result.success).toBe(true);
    expect(result.newly_unlocked_modifiers).toContain(boss ? 'fire_arrow' : 'vitality_boost');
    expect(result.xp_gained).toBe(boss ? 63 : 30);
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
  });

  it('keeps SQL failure safe when native metrics throw', () => {
    const nk = createMockNakama();
    const original = (nk.sqlQuery as jest.Mock).getMockImplementation()!;
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('unlocked_modifier_pools')) throw new Error('private driver SQL');
      return original(sql, params);
    });
    nk.metricsCounterAdd = jest.fn(() => {
      throw new Error('metrics down');
    });
    const logger = createMockLogger();
    const result = JSON.parse(rpcStageComplete(createMockContext(), logger, nk, request(false)));
    expect(result.error_code).toBe('INTERNAL_ERROR');
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls])).not.toContain(
      'private'
    );
  });

  it('keeps legacy recordBossDefeat pool failure fallback without context', () => {
    const nk = createMockNakama();
    const original = (nk.sqlQuery as jest.Mock).getMockImplementation()!;
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('unlocked_modifier_pools')) throw new Error('legacy SQL');
      return original(sql, params);
    });
    expect(recordBossDefeat(nk, createMockContext(), createMockLogger(), 'boss_fire')).toEqual({
      defeat_count: 1,
      newly_unlocked_modifiers: [],
    });
  });
});
