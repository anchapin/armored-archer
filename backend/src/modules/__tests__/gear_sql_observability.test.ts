import {
  createMockContext,
  createMockLogger,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { logger } from '../../config/logger';
import { rpcGenerateGear } from '../gear_system';
import { getPlayerGearFromDB } from '../gear_db';

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
    const response = JSON.parse(
      rpcGenerateGear(
        createMockContext(),
        createMockLogger(),
        nk,
        JSON.stringify({ stage_id: 'stage_1', boss_defeated: false })
      )
    );
    expect(response.success).not.toBe(true);
    expect(response.error_code).toBe('DATABASE_ERROR');
    expect(JSON.stringify(response)).not.toContain('private');
    expect(logger.error).toHaveBeenCalledWith('Database query failed', {
      operation: 'gear_db.insertGearItem',
    });
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      { op: 'gear_db.insertGearItem' },
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
});
