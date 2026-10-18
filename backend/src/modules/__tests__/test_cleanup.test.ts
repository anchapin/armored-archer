import { rpcCleanupUserStorage } from '../test_cleanup';
import { logger as appLogger } from '../../config/logger';

jest.mock('../../config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const tables = [
  'storage',
  'unlocked_modifier_pools',
  'boss_defeats',
  'inventory',
  'loadout',
  'player_stats',
];
const nativeLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

beforeEach(() => jest.clearAllMocks());

it.each([false, true])(
  'observes obsolete cleanup host SQL failures without changing fallback (metric fails=%s)',
  async (metricFails) => {
    const logger = nativeLogger();
    const nk = {
      storageDelete: jest.fn(() => {
        throw new Error('private storage token');
      }),
      sqlQuery: jest.fn(() => {
        throw new Error('private SQL token');
      }),
      metricsCounterAdd: jest.fn(() => {
        if (metricFails) throw new Error('private metric token');
      }),
    } as any;
    expect(
      JSON.parse(await rpcCleanupUserStorage({} as any, logger, nk, '{"userId":"fixture-user"}'))
    ).toEqual({ success: true });
    expect(nk.storageDelete).toHaveBeenCalledTimes(2);
    expect(nk.sqlQuery).toHaveBeenCalledTimes(6);
    tables.forEach((table, i) =>
      expect(nk.sqlQuery).toHaveBeenNthCalledWith(
        i + 1,
        `DELETE FROM ${table} WHERE user_id = $1`,
        ['fixture-user']
      )
    );
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(6);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      { op: 'test_cleanup.delete', rpc: 'test.cleanup_user_storage' },
      1
    );
    expect(logger.error).toHaveBeenCalledTimes(6);
    expect(
      JSON.stringify([
        logger.error.mock.calls,
        logger.info.mock.calls,
        (appLogger.warn as jest.Mock).mock.calls,
      ])
    ).not.toContain('private');
  }
);

it('preserves successful deletes without error metrics', async () => {
  const nk = {
    storageDelete: jest.fn(),
    sqlQuery: jest.fn(() => []),
    metricsCounterAdd: jest.fn(),
  } as any;
  expect(
    JSON.parse(
      await rpcCleanupUserStorage({} as any, nativeLogger(), nk, '{"userId":"fixture-user"}')
    )
  ).toEqual({ success: true });
  expect(nk.storageDelete).toHaveBeenCalledTimes(2);
  expect(nk.sqlQuery).toHaveBeenCalledTimes(6);
  expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
});

it('preserves failing-provider fallback (sync providers, issue #1674)', async () => {
  const logger = nativeLogger();
  const nk = {
    storageDelete: jest.fn().mockImplementation(() => { throw new Error('private storage token'); }),
    sqlQuery: jest.fn().mockImplementation(() => { throw new Error('private SQL token'); }),
    metricsCounterAdd: jest.fn(),
  } as any;
  expect(
    JSON.parse(await rpcCleanupUserStorage({} as any, logger, nk, '{"userId":"fixture-user"}'))
  ).toEqual({ success: true });
  expect(nk.sqlQuery).toHaveBeenCalledTimes(6);
  // Sync throws are observed by observedSqlQuery, which records one
  // db_errors_total metric per failed table delete (issue #1674: the RPC
  // handler is now synchronous, so failures surface through the sync path).
  expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(6);
  expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
    'db_errors_total',
    { op: 'test_cleanup.delete', rpc: 'test.cleanup_user_storage' },
    1
  );
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain('private');
});

it.each(['bad json', '{}'])(
  'rejects existing invalid payload before deletes: %s',
  async (payload) => {
    const nk = { storageDelete: jest.fn(), sqlQuery: jest.fn() } as any;
    expect(
      JSON.parse(await rpcCleanupUserStorage({} as any, nativeLogger(), nk, payload)).success
    ).toBe(false);
    expect(nk.storageDelete).not.toHaveBeenCalled();
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  }
);
