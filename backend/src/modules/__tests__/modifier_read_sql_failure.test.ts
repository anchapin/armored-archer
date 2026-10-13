import { createMockContext, createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import { getBossDefeatCount } from '../gear_db';
import { rpcGetUnlockedModifiers } from '../gear_system';

const RPC = 'armored_archer/get_unlocked_modifiers';

describe('unlocked modifier reads fail honestly through real SQL helpers', () => {
  it.each([
    ['modifier_id', 'gear_db.getUnlockedModifierPoolsFromDB'],
    ['boss_id', 'gear_db.getDefeatedBossesFromDB'],
    ['defeat_count', 'gear_db.getBossDefeatCount'],
  ])('fails safely for the %s read', (column, op) => {
    const nk = createMockNakama();
    const logger = createMockLogger();
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes(`SELECT ${column} FROM`)) throw new Error('private driver user SQL');
      if (sql.includes('SELECT boss_id FROM')) return [{ boss_id: 'boss_dragon' }];
      return [];
    });
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(rpcGetUnlockedModifiers(createMockContext(), logger, nk, '{}'));
    expect(result.error_code).toBe('DATABASE_ERROR');
    expect(result.success).not.toBe(true);
    expect(result.unlocked_modifier_pools).toBeUndefined();
    expect(result.boss_defeats).toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, op);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op, rpc: RPC }, 1);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls])).not.toContain(
      'private'
    );
  });

  it.each([false, true])('keeps actual empty/nonempty results successful: %s', (nonempty) => {
    const nk = createMockNakama();
    const ctx = createMockContext();
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
      if (!nonempty) return [];
      if (sql.includes('SELECT modifier_id FROM')) return [{ modifier_id: 'piercing_arrow' }];
      if (sql.includes('SELECT boss_id FROM')) return [{ boss_id: 'boss_dragon' }];
      return [{ defeat_count: 3 }];
    });
    nk.metricsCounterAdd = jest.fn();
    expect(JSON.parse(rpcGetUnlockedModifiers(ctx, createMockLogger(), nk, '{}'))).toEqual({
      success: true,
      unlocked_modifier_pools: nonempty ? ['piercing_arrow'] : [],
      boss_defeats: nonempty ? { boss_dragon: 3 } : {},
    });
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
    for (const args of (nk.sqlQuery as jest.Mock).mock.calls) expect(args[1][0]).toBe(ctx.userId);
  });

  it('still fails when the metric API is unavailable', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('private driver');
    });
    nk.metricsCounterAdd = jest.fn(() => {
      throw new Error('metric unavailable');
    });
    expect(
      JSON.parse(rpcGetUnlockedModifiers(createMockContext(), createMockLogger(), nk, '{}'))
        .error_code
    ).toBe('DATABASE_ERROR');
  });

  it('preserves zero-count fallback for context-free callers', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('legacy error');
    });
    expect(getBossDefeatCount(nk, 'user', 'boss')).toBe(0);
  });
});
