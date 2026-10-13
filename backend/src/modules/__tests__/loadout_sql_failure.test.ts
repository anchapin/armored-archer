import { createMockContext, createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import { equipItemInDB, unequipItemInDB } from '../gear_db';
import { rpcEquipGear, rpcUnequipGear } from '../gear_system';

function setup() {
  const nk = createMockNakama();
  const state = { equipped: true, reads: 0, writes: 0 };
  const query = (sql: string) => {
    if (sql.includes('SELECT gear_type')) return [{ gear_type: 'bow' }];
    if (sql.includes('FROM inventory_items'))
      return [
        {
          item_id: 'gear-123',
          gear_type: 'bow',
          name: 'Bow',
          rarity: 'common',
          level: 1,
          stats: '[]',
          modifiers: '[]',
          created_at: '2026-01-01',
        },
      ];
    if (sql.includes('FROM loadout')) {
      state.reads++;
      return [{ bow_item_id: state.equipped ? 'gear-123' : null }];
    }
    if (sql.includes('INSERT INTO loadout') || sql.includes('UPDATE loadout')) {
      state.writes++;
      state.equipped = sql.includes('INSERT INTO');
    }
    return [];
  };
  (nk.sqlQuery as jest.Mock).mockImplementation(query);
  nk.metricsCounterAdd = jest.fn();
  return { nk, state, query };
}

describe('equip and unequip fail honestly through real SQL helpers', () => {
  it.each([
    ['equip', 'inventory', 'gear_db.getPlayerGearFromDB', 0],
    ['equip', 'verify', 'gear_db.equipItemInDB', 0],
    ['equip', 'write', 'gear_db.equipItemInDB', 0],
    ['equip', 'readback', 'gear_db.getPlayerLoadoutFromDB', 1],
    ['unequip', 'initial', 'gear_db.getPlayerLoadoutFromDB', 0],
    ['unequip', 'write', 'gear_db.unequipItemInDB', 0],
    ['unequip', 'readback', 'gear_db.getPlayerLoadoutFromDB', 1],
  ])('fails %s/%s safely', (action, failure, op, writes) => {
    const { nk, state, query } = setup();
    const logger = createMockLogger();
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
      const fail =
        failure === 'inventory'
          ? sql.includes('FROM inventory_items')
          : failure === 'verify'
            ? sql.includes('SELECT gear_type')
            : failure === 'write'
              ? sql.includes('INSERT INTO loadout') || sql.includes('UPDATE loadout')
              : failure === 'initial'
                ? sql.includes('FROM loadout')
                : sql.includes('FROM loadout') && (action === 'equip' || state.reads === 1);
      if (fail) throw new Error('private driver SQL user');
      return query(sql);
    });
    const rpc = `armored_archer/${action}_gear`;
    const handler = action === 'equip' ? rpcEquipGear : rpcUnequipGear;
    const result = JSON.parse(
      handler(createMockContext(), logger, nk, JSON.stringify({ gear_id: 'gear-123', slot: 'bow' }))
    );
    expect(result.error_code).toBe('DATABASE_ERROR');
    expect(result.success).not.toBe(true);
    expect(result.equipped_gear).toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', rpc, op);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op, rpc }, 1);
    expect(state.writes).toBe(writes);
    expect(
      JSON.stringify([
        result,
        (logger.error as jest.Mock).mock.calls,
        (nk.storageWrite as jest.Mock).mock.calls,
      ])
    ).not.toContain('private');
  });

  it.each(['equip', 'unequip'])('preserves %s success and authenticated SQL scope', (action) => {
    const { nk } = setup();
    const ctx = createMockContext();
    const handler = action === 'equip' ? rpcEquipGear : rpcUnequipGear;
    const result = JSON.parse(
      handler(ctx, createMockLogger(), nk, JSON.stringify({ gear_id: 'gear-123', slot: 'bow' }))
    );
    expect(result.success).toBe(true);
    expect(result.equipped_gear.bow).toBe(action === 'equip' ? 'gear-123' : null);
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
    for (const args of (nk.sqlQuery as jest.Mock).mock.calls) expect(args[1]).toContain(ctx.userId);
  });

  it('retains existing empty-slot and item-not-found responses', () => {
    const { nk } = setup();
    (nk.sqlQuery as jest.Mock).mockReturnValue([]);
    const ctx = createMockContext();
    const logger = createMockLogger();
    expect(
      JSON.parse(rpcEquipGear(ctx, logger, nk, '{"gear_id":"gear-123","slot":"bow"}')).error
    ).toBe('Gear not found in inventory');
    expect(JSON.parse(rpcUnequipGear(ctx, logger, nk, '{"slot":"bow"}')).error).toBe(
      'No gear equipped in this slot'
    );
  });

  it('keeps SQL failure when the metric API is unavailable', () => {
    const { nk } = setup();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('private driver');
    });
    nk.metricsCounterAdd = jest.fn(() => {
      throw new Error('metric down');
    });
    expect(
      JSON.parse(
        rpcEquipGear(
          createMockContext(),
          createMockLogger(),
          nk,
          '{"gear_id":"gear-123","slot":"bow"}'
        )
      ).error_code
    ).toBe('DATABASE_ERROR');
  });

  it('preserves context-free helper failure results', () => {
    const { nk } = setup();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('legacy');
    });
    expect(equipItemInDB(nk, 'user', 'gear', 'bow').success).toBe(false);
    expect(unequipItemInDB(nk, 'user', 'bow').success).toBe(false);
  });
});
