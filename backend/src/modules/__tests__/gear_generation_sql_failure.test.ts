import { createMockContext, createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import { insertGearItem } from '../gear_db';
import { rpcGenerateGear } from '../gear_system';

const RPC = 'armored_archer/generate_gear';
const payload = '{"stage_id":"stage_1","boss_defeated":false}';
function setup() {
  const nk = createMockNakama();
  const state = { inserts: 0, poolReads: 0 };
  const query = (sql: string) => {
    if (sql.includes('INSERT INTO inventory_items')) {
      state.inserts++;
      return [{ item_id: 'persisted-gear' }];
    }
    if (sql.includes('FROM unlocked_modifier_pools')) state.poolReads++;
    return [];
  };
  (nk.sqlQuery as jest.Mock).mockImplementation(query);
  nk.metricsCounterAdd = jest.fn();
  return { nk, state, query };
}

describe('generate gear strict SQL failure contract through real helpers', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([
    ['initial pools', 'gear_db.getUnlockedModifierPoolsFromDB'],
    ['insert', 'gear_db.insertGearItem'],
    ['gear readback', 'gear_db.getPlayerGearFromDB'],
    ['loadout readback', 'gear_db.getPlayerLoadoutFromDB'],
    ['pool readback', 'gear_db.getUnlockedModifierPoolsFromDB'],
  ])('fails %s safely without fabricated success', (failure, op) => {
    const { nk, state, query } = setup();
    const logger = createMockLogger();
    const ctx = createMockContext();
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
      const fail =
        failure === 'initial pools'
          ? sql.includes('FROM unlocked_modifier_pools')
          : failure === 'insert'
            ? sql.includes('INSERT INTO inventory_items')
            : failure === 'gear readback'
              ? sql.includes('FROM inventory_items')
              : failure === 'loadout readback'
                ? sql.includes('FROM loadout')
                : sql.includes('FROM unlocked_modifier_pools') && state.inserts === 1;
      if (fail) throw new Error('private driver SQL user token');
      return query(sql);
    });
    const result = JSON.parse(rpcGenerateGear(ctx, logger, nk, payload));
    expect(result.error_code).toBe('DATABASE_ERROR');
    expect(result.success).not.toBe(true);
    expect(result.gear).toBeUndefined();
    expect(result.inventory).toBeUndefined();
    expect(
      (logger.error as jest.Mock).mock.calls.filter(
        (args) => args[0] === 'Database query failed: rpc=%s op=%s'
      )
    ).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, op);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op, rpc: RPC }, 1);
    expect(state.inserts).toBe(failure.includes('readback') ? 1 : 0);
    const records = (nk.storageWrite as jest.Mock).mock.calls.flat(2);
    expect(
      records.some((r: any) => r.value?.action === 'generate_gear' && r.value?.result === 'success')
    ).toBe(false);
    expect(
      records.some((r: any) => r.value?.action === 'generate_gear' && r.value?.result === 'failure')
    ).toBe(true);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls, records])).not.toContain(
      'private'
    );
    for (const args of (nk.sqlQuery as jest.Mock).mock.calls) expect(args[1][0]).toBe(ctx.userId);
  });

  it('preserves genuine empty readback and the inserted item id', () => {
    const { nk, state } = setup();
    const result = JSON.parse(
      rpcGenerateGear(createMockContext(), createMockLogger(), nk, payload)
    );
    expect(result.success).toBe(true);
    expect(result.gear.id).toBe('persisted-gear');
    expect(result.inventory).toEqual({ gear: [], equipped_gear: {} });
    expect(state).toEqual({ inserts: 1, poolReads: 2 });
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
  });

  it('fails with the existing safe response if insert returns no row', () => {
    const { nk } = setup();
    (nk.sqlQuery as jest.Mock).mockReturnValue([]);
    const result = JSON.parse(
      rpcGenerateGear(createMockContext(), createMockLogger(), nk, payload)
    );
    expect(result.error_code).toBe('DATABASE_ERROR');
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
  });

  it('does not replace SQL failure with metric failure', () => {
    const { nk } = setup();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('private SQL');
    });
    nk.metricsCounterAdd = jest.fn(() => {
      throw new Error('metric down');
    });
    expect(
      JSON.parse(rpcGenerateGear(createMockContext(), createMockLogger(), nk, payload)).error_code
    ).toBe('DATABASE_ERROR');
  });

  it('preserves context-free insert helper failure results', () => {
    const { nk } = setup();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('legacy driver');
    });
    expect(
      insertGearItem(nk, 'user', {
        id: '',
        name: 'gear',
        rarity: 'common',
        type: 'helm',
        stats: [],
        modifiers: [],
        level: 1,
        timestamp: 0,
      }).success
    ).toBe(false);
  });
});
