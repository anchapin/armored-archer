import { createMockContext, createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import { unlockModifierPoolInDB } from '../gear_db';
import { rpcUnlockModifierPool } from '../gear_system';

const RPC = 'armored_archer/unlock_modifier_pool';
const payload = '{"modifier_id":"piercing_arrow"}';
function setup(existing = false) {
  const nk = createMockNakama();
  const state = { unlocked: existing, inserts: 0 };
  const query = (sql: string) => {
    if (sql.includes('INSERT INTO unlocked_modifier_pools')) {
      state.inserts++;
      state.unlocked = true;
      return [];
    }
    return state.unlocked ? [{ modifier_id: 'piercing_arrow' }] : [];
  };
  (nk.sqlQuery as jest.Mock).mockImplementation(query);
  nk.metricsCounterAdd = jest.fn();
  return { nk, state, query };
}

describe('manual modifier unlock uses real strict SQL helpers', () => {
  it.each(['check', 'insert', 'readback'])(
    'fails %s without empty success or private details',
    (failure) => {
      const { nk, state, query } = setup();
      const logger = createMockLogger();
      const ctx = createMockContext();
      (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
        const fail =
          failure === 'check'
            ? sql.includes('AND modifier_id')
            : failure === 'insert'
              ? sql.includes('INSERT INTO')
              : sql.includes('ORDER BY');
        if (fail) throw new Error('private driver SQL user');
        return query(sql);
      });
      const result = JSON.parse(rpcUnlockModifierPool(ctx, logger, nk, payload));
      expect(result.error_code).toBe('INTERNAL_ERROR');
      expect(result.success).not.toBe(true);
      expect(result.unlocked_modifier_pools).toBeUndefined();
      const op =
        failure === 'readback'
          ? 'gear_db.getUnlockedModifierPoolsFromDB'
          : 'gear_db.unlockModifierPoolInDB';
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, op);
      expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
      expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op, rpc: RPC }, 1);
      expect(state.inserts).toBe(failure === 'readback' ? 1 : 0);
      expect(state.unlocked).toBe(failure === 'readback');
      const records = (nk.storageWrite as jest.Mock).mock.calls.flat(2);
      expect(
        records.some(
          (r: any) => r.value?.action === 'unlock_modifier_pool' && r.value?.result === 'success'
        )
      ).toBe(false);
      expect(
        JSON.stringify([result, (logger.error as jest.Mock).mock.calls, records])
      ).not.toContain('private');
    }
  );

  it.each([false, true])(
    'preserves newly unlocked and already unlocked results: %s',
    (existing) => {
      const { nk, state } = setup(existing);
      const ctx = createMockContext();
      expect(JSON.parse(rpcUnlockModifierPool(ctx, createMockLogger(), nk, payload))).toEqual({
        success: true,
        unlocked_modifier_pools: ['piercing_arrow'],
      });
      expect(state.inserts).toBe(existing ? 0 : 1);
      expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
      for (const args of (nk.sqlQuery as jest.Mock).mock.calls) expect(args[1][0]).toBe(ctx.userId);
      const insert = (nk.sqlQuery as jest.Mock).mock.calls.find((args) =>
        args[0].includes('INSERT INTO')
      );
      if (insert) expect(insert[1]).toEqual([ctx.userId, 'piercing_arrow', 'manual', null]);
    }
  );

  it('still fails if metrics are unavailable', () => {
    const { nk } = setup();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('private driver');
    });
    nk.metricsCounterAdd = jest.fn(() => {
      throw new Error('metric down');
    });
    expect(
      JSON.parse(rpcUnlockModifierPool(createMockContext(), createMockLogger(), nk, payload))
        .error_code
    ).toBe('INTERNAL_ERROR');
  });

  it('preserves context-free helper failure results', () => {
    const { nk } = setup();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('legacy');
    });
    expect(unlockModifierPoolInDB(nk, 'user', 'modifier').success).toBe(false);
  });

  it('validates payload before SQL', () => {
    const { nk } = setup();
    expect(
      JSON.parse(rpcUnlockModifierPool(createMockContext(), createMockLogger(), nk, '{}'))
        .error_code
    ).toBe('VALIDATION_ERROR');
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });
});
