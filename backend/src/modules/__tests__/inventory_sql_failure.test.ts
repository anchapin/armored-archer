import { createMockContext, createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import { rpcGetInventory } from '../gear_system';

const RPC = 'armored_archer/get_inventory';

describe('inventory SQL failure contract through real database helpers', () => {
  it.each([
    ['inventory_items', 'gear_db.getPlayerGearFromDB'],
    ['loadout', 'gear_db.getPlayerLoadoutFromDB'],
    ['unlocked_modifier_pools', 'gear_db.getUnlockedModifierPoolsFromDB'],
  ])('does not return an empty success when %s fails', (table, op) => {
    const nk = createMockNakama();
    const logger = createMockLogger();
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes(`FROM ${table}`)) throw new Error('private query user token details');
      return [];
    });
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(rpcGetInventory(createMockContext(), logger, nk, '{}'));
    expect(result.success).not.toBe(true);
    expect(result.error_code).toBe('DATABASE_ERROR');
    expect(result.gear).toBeUndefined();
    expect(result.error).toBe('Failed to retrieve inventory');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, op);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op, rpc: RPC }, 1);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls])).not.toContain(
      'private'
    );
  });

  it('keeps a genuinely empty inventory successful, with no duplicate modifier read', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockReturnValue([]);
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(rpcGetInventory(createMockContext(), createMockLogger(), nk, '{}'));
    expect(result).toEqual({
      success: true,
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: [],
    });
    expect(nk.sqlQuery).toHaveBeenCalledTimes(3);
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
  });

  it('keeps the failed response when recording the metric also fails', () => {
    const nk = createMockNakama();
    const logger = createMockLogger();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('private driver');
    });
    nk.metricsCounterAdd = jest.fn(() => {
      throw new Error('metric unavailable');
    });
    expect(JSON.parse(rpcGetInventory(createMockContext(), logger, nk, '{}')).error_code).toBe(
      'DATABASE_ERROR'
    );
  });
});
