import { logger } from '../../config/logger';
import { Runtime } from '../../types/nakama';
import { observedSqlQuery } from '../sql-observability';

jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));

describe('observed SQL queries', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns rows without logging or counting a failure', () => {
    const rows = [{ value: 1 }];
    const nk = {
      sqlQuery: jest.fn(() => rows),
      metricsCounterAdd: jest.fn(),
    } as unknown as Runtime.Nakama;
    expect(observedSqlQuery(nk, 'gear_db.read', 'SELECT 1', [])).toBe(rows);
    expect(nk.sqlQuery).toHaveBeenCalledWith('SELECT 1', []);
    expect(logger.error).not.toHaveBeenCalled();
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
  });

  it('logs only the operation, counts once, and throws the original failure', () => {
    const failure = new Error('secret SQL driver details');
    const nk = {
      sqlQuery: jest.fn(() => {
        throw failure;
      }),
      metricsCounterAdd: jest.fn(),
    } as unknown as Runtime.Nakama;
    expect(() => observedSqlQuery(nk, 'gear_db.write', 'private query', ['private user'])).toThrow(
      failure
    );
    expect(logger.error).toHaveBeenCalledWith('Database query failed', {
      operation: 'gear_db.write',
    });
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      { op: 'gear_db.write' },
      1
    );
    expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain('secret');
    expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain('private');
  });

  it('preserves the SQL failure when metrics fail or are absent', () => {
    const failure = new Error('database failed');
    const nk = {
      sqlQuery: () => {
        throw failure;
      },
      metricsCounterAdd: () => {
        throw new Error('metric failed');
      },
    } as unknown as Runtime.Nakama;
    expect(() => observedSqlQuery(nk, 'gear_db.read', '')).toThrow(failure);
    expect(logger.warn).toHaveBeenCalledWith('Database error metric unavailable', {
      operation: 'gear_db.read',
    });
    delete nk.metricsCounterAdd;
    expect(() => observedSqlQuery(nk, 'gear_db.read', '')).toThrow(failure);
  });
});
