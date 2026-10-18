import { createMockContext, createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import { resetAdminAllowlistCache } from '../admin_auth';
import { rpcCleanupTestUser, registerRpcCleanupTestUser } from '../cleanup_test_user';

const OWNER = '00000000-0000-4000-8000-000000000001';
const ADMIN = '00000000-0000-4000-8000-000000000002';
const TARGET = '00000000-0000-4000-8000-000000000003';
const originalFlag = process.env.TEST_FIXTURE_RPCS_ENABLED;
const originalFixtureGate = process.env.CI_RECEIPT_FIXTURE;
const originalAdmins = process.env.ADMIN_USER_IDS;

function probe(userId = OWNER, payload = JSON.stringify({ user_id: OWNER })) {
  const nk = createMockNakama();
  nk.storageDelete = jest.fn();
  const logger = createMockLogger();
  nk.metricsCounterAdd = jest.fn();
  const call = () =>
    JSON.parse(rpcCleanupTestUser(createMockContext({ userId }), logger, nk, payload));
  return { nk, logger, call };
}

describe('test cleanup access and synchronous error contract', () => {
  beforeEach(() => {
    process.env.TEST_FIXTURE_RPCS_ENABLED = 'true';
    process.env.CI_RECEIPT_FIXTURE = 'true';
    process.env.ADMIN_USER_IDS = ADMIN;
    resetAdminAllowlistCache();
  });
  afterAll(() => {
    if (originalFlag === undefined) delete process.env.TEST_FIXTURE_RPCS_ENABLED;
    else process.env.TEST_FIXTURE_RPCS_ENABLED = originalFlag;
    if (originalFixtureGate === undefined) delete process.env.CI_RECEIPT_FIXTURE;
    else process.env.CI_RECEIPT_FIXTURE = originalFixtureGate;
    if (originalAdmins === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = originalAdmins;
    resetAdminAllowlistCache();
  });

  it.each([undefined, '', 'false', '1', 'TRUE'])(
    'does not register or delete when opt-in is %s',
    (flag) => {
      if (flag === undefined) delete process.env.TEST_FIXTURE_RPCS_ENABLED;
      else process.env.TEST_FIXTURE_RPCS_ENABLED = flag;
      const initializer = { registerRpc: jest.fn() };
      registerRpcCleanupTestUser(initializer);
      expect(initializer.registerRpc).not.toHaveBeenCalled();
      const { nk, call } = probe(ADMIN, JSON.stringify({ user_id: TARGET }));
      expect(call().error).toBe('cleanup_disabled');
      expect(nk.storageDelete).not.toHaveBeenCalled();
      expect(nk.sqlQuery).not.toHaveBeenCalled();
    }
  );

  it('registers the guarded handler only with exact opt-in', () => {
    const initializer = { registerRpc: jest.fn() };
    registerRpcCleanupTestUser(initializer);
    expect(initializer.registerRpc).toHaveBeenCalledWith(
      'armored_archer/cleanup_test_user',
      rpcCleanupTestUser
    );
  });

  it.each(['', OWNER])('rejects missing caller or a non-admin foreign target: %s', (caller) => {
    const { nk, call } = probe(caller, JSON.stringify({ user_id: TARGET }));
    expect(call().error).toBe('not_authorized');
    expect(nk.storageDelete).not.toHaveBeenCalled();
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });

  it.each(['', 'malformed'])('fails closed for cross-user requests with allowlist %s', (admins) => {
    process.env.ADMIN_USER_IDS = admins;
    const { nk, call } = probe(ADMIN, JSON.stringify({ user_id: TARGET }));
    expect(call().error).toBe('not_authorized');
    expect(nk.storageDelete).not.toHaveBeenCalled();
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });

  it.each([
    [OWNER, 'user_id'],
    [ADMIN, 'userId'],
  ])('completes synchronously for permitted %s using %s', (caller, key) => {
    const target = caller === OWNER ? OWNER : TARGET;
    const { nk, call } = probe(caller, JSON.stringify({ [key]: target }));
    expect(call()).toEqual({ success: true, user_id: target, async: false });
    expect(nk.storageDelete).toHaveBeenCalledTimes(11);
    expect(nk.sqlQuery).toHaveBeenCalledTimes(8);
    for (const args of (nk.sqlQuery as jest.Mock).mock.calls) expect(args[1]).toEqual([target]);
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
  });

  it.each(['{', 'null', '{}', '{"user_id":7}'])(
    'rejects bad payload without deletes: %s',
    (payload) => {
      const { nk, call } = probe(OWNER, payload);
      expect(call().success).toBe(false);
      expect(nk.storageDelete).not.toHaveBeenCalled();
      expect(nk.sqlQuery).not.toHaveBeenCalled();
    }
  );

  it.each([false, true])(
    'reports failed SQL cleanup safely when metrics fail=%s',
    (metricFails) => {
      const { nk, logger, call } = probe();
      (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('DELETE FROM inventory_items '))
          throw new Error('private driver user sql');
        return [];
      });
      nk.metricsCounterAdd = jest.fn(() => {
        if (metricFails) throw new Error('metric unavailable');
      });
      expect(call()).toEqual({ success: false, error: 'cleanup_failed' });
      expect(nk.sqlQuery).toHaveBeenCalledTimes(8);
      expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
        'db_errors_total',
        {
          rpc: 'armored_archer/cleanup_test_user',
          op: 'cleanup_test_user.delete.inventory_items',
        },
        1
      );
      expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain('private');
    }
  );

  it.each([
    'storage',
    'unlocked_modifier_pools',
    'boss_defeats',
    'inventory',
    'inventory_items',
    'loadout',
    'player_stats',
    'stage_completion',
  ])('fails rather than acknowledges a broken %s delete', (table) => {
    const { nk, call } = probe();
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes(`DELETE FROM ${table} WHERE`)) throw new Error('broken query');
      return [];
    });
    expect(call()).toEqual({ success: false, error: 'cleanup_failed' });
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      {
        rpc: 'armored_archer/cleanup_test_user',
        op: 'cleanup_test_user.delete.' + table,
      },
      1
    );
  });

  it('reports partial storage failure without skipping remaining cleanup or leaking driver text', () => {
    const { nk, logger, call } = probe();
    (nk.storageDelete as jest.Mock).mockImplementationOnce(() => {
      throw new Error('private storage user');
    });
    expect(call()).toEqual({ success: false, error: 'cleanup_failed' });
    expect(nk.storageDelete).toHaveBeenCalledTimes(11);
    expect(nk.sqlQuery).toHaveBeenCalledTimes(8);
    expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain('private');
  });
});
