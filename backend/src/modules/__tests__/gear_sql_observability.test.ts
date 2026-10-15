import {
  createMockContext,
  createMockLogger,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { logger } from '../../config/logger';
import { rpcGenerateGear } from '../gear_system';
import {
  getPlayerGearFromDB,
  getPlayerLoadoutFromDB,
  getDefeatedBossesFromDB,
  getBossDefeatCount,
  getUnlockedModifierPoolsFromDB,
  isModifierPoolUnlocked,
} from '../gear_db';

jest.mock('../../config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe('gear SQL error observability through real database helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testStorage.clear();
  });

  it('turns a broken insert into a failed RPC, an error log and one native metric', () => {
    const nk = createMockNakama();
    const query = nk.sqlQuery as jest.Mock;
    query.mockImplementation((sql: string) => {
      if (/INSERT INTO inventory_items/.test(sql)) throw new Error('private query details');
      return [];
    });
    nk.metricsCounterAdd = jest.fn();
    const runtimeLogger = createMockLogger();
    const response = JSON.parse(
      rpcGenerateGear(
        createMockContext(),
        runtimeLogger,
        nk,
        JSON.stringify({ stage_id: 'stage_1', boss_defeated: false })
      )
    );
    expect(response.success).not.toBe(true);
    expect(response.error_code).toBe('DATABASE_ERROR');
    expect(JSON.stringify(response)).not.toContain('private');
    expect(runtimeLogger.error).toHaveBeenCalledWith(
      'Database query failed: rpc=%s op=%s',
      'armored_archer/generate_gear',
      'gear_db.insertGearItem'
    );
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      { op: 'gear_db.insertGearItem', rpc: 'armored_archer/generate_gear' },
      1
    );
  });

  it('records a failed read even while the existing empty-read fallback is preserved', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('query failed');
    });
    nk.metricsCounterAdd = jest.fn();
    expect(getPlayerGearFromDB(nk, 'user')).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith('Database query failed', {
      operation: 'gear_db.getPlayerGearFromDB',
    });
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      { op: 'gear_db.getPlayerGearFromDB' },
      1
    );
  });
  it.each([false, true])(
    'keeps all legacy read fallbacks and logs safe (metric fails=%s)',
    (metricFails) => {
      const nk = createMockNakama();
      (nk.sqlQuery as jest.Mock).mockImplementation(() => {
        throw new Error('private SQL caller secret');
      });
      nk.metricsCounterAdd = jest.fn(() => {
        if (metricFails) throw new Error('private metric secret');
      });
      expect(getPlayerGearFromDB(nk, 'private-user')).toEqual([]);
      expect(getPlayerLoadoutFromDB(nk, 'private-user')).toEqual({
        helm_item_id: null,
        armor_item_id: null,
        bow_item_id: null,
        arrow_item_id: null,
        amulet_item_id: null,
      });
      expect(getDefeatedBossesFromDB(nk, 'private-user')).toEqual([]);
      expect(getBossDefeatCount(nk, 'private-user', 'private-boss')).toBe(0);
      expect(getUnlockedModifierPoolsFromDB(nk, 'private-user')).toEqual([]);
      expect(isModifierPoolUnlocked(nk, 'private-user', 'private-modifier')).toBe(false);
      expect(nk.sqlQuery).toHaveBeenCalledTimes(6);
      expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(6);
      for (const helper of [
        'getPlayerGearFromDB',
        'getPlayerLoadoutFromDB',
        'getDefeatedBossesFromDB',
        'getBossDefeatCount',
        'getUnlockedModifierPoolsFromDB',
        'isModifierPoolUnlocked',
      ]) {
        expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
          'db_errors_total',
          { op: `gear_db.${helper}` },
          1
        );
        expect(logger.error).toHaveBeenCalledWith('Database query failed', {
          operation: `gear_db.${helper}`,
        });
      }
      expect(
        JSON.stringify([
          (logger.error as jest.Mock).mock.calls,
          (logger.warn as jest.Mock).mock.calls,
        ])
      ).not.toContain('private');
    }
  );
});
