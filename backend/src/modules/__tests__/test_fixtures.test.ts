/**
 * Test-fixture RPC tests (#1456 leaderboard fixture, #1423 diag_http_probe).
 * Uses the shared nakama mock; no live server needed.
 */

import {
  registerTestFixtureRpcs,
  rpcTestLeaderboardFixture,
  resolveDiagHangMs,
  rpcDiagHangProbe,
  rpcDiagHttpProbe,
  testFixtureRpcsEnabled,
} from '../test_fixtures';
import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import type { Runtime } from '../../types/nakama';

describe('resolveDiagHangMs (#1348)', () => {
  it('uses the 10s default when the payload is empty or invalid', () => {
    expect(resolveDiagHangMs('')).toBe(10000);
    expect(resolveDiagHangMs('not-json{')).toBe(10000);
    expect(resolveDiagHangMs('{}')).toBe(10000);
    expect(resolveDiagHangMs('{"hang_ms":"5"}')).toBe(10000);
  });

  it('clamps the hang to [0, 30000]', () => {
    expect(resolveDiagHangMs('{"hang_ms":5000}')).toBe(5000);
    expect(resolveDiagHangMs('{"hang_ms":-3}')).toBe(0);
    expect(resolveDiagHangMs('{"hang_ms":999999}')).toBe(30000);
    expect(resolveDiagHangMs('{"hang_ms":1500.9}')).toBe(1500);
  });
});

describe('rpcDiagHangProbe (#1348)', () => {
  it('hangs for the requested duration and reports it', () => {
    const nk = createMockNakama();
    const logger = createMockLogger();
    const start = Date.now();
    const res = JSON.parse(rpcDiagHangProbe(createMockContext(), logger, nk, '{"hang_ms":5}'));
    const elapsed = Date.now() - start;
    expect(res).toEqual({ success: true, hung_ms: 5 });
    expect(elapsed).toBeGreaterThanOrEqual(4);
  });
});

describe('rpcDiagHttpProbe (#1423)', () => {
  it('returns the healthcheck status code when nk.httpRequest succeeds', () => {
    const nk = createMockNakama();
    (nk.httpRequest as jest.Mock).mockReturnValue({ code: 200, body: '{}', headers: {} });
    const logger = createMockLogger();
    const res = JSON.parse(rpcDiagHttpProbe(createMockContext(), logger, nk, ''));
    expect(res).toEqual({ success: true, code: 200 });
    expect(nk.httpRequest).toHaveBeenCalledWith(
      'http://127.0.0.1:7350/healthcheck',
      'get',
      {},
      '',
      2000
    );
  });

  it('fails closed with the error string when nk.httpRequest throws', () => {
    const nk = createMockNakama();
    (nk.httpRequest as jest.Mock).mockImplementation(() => {
      throw new Error('dial refused');
    });
    const logger = createMockLogger();
    const res = JSON.parse(rpcDiagHttpProbe(createMockContext(), logger, nk, ''));
    expect(res.success).toBe(false);
    expect(res.error).toContain('dial refused');
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('testFixtureRpcsEnabled', () => {
  it('is true only for the exact string "true"', () => {
    expect(testFixtureRpcsEnabled({ TEST_FIXTURE_RPCS_ENABLED: 'true' })).toBe(true);
    expect(testFixtureRpcsEnabled({ TEST_FIXTURE_RPCS_ENABLED: '1' })).toBe(false);
    expect(testFixtureRpcsEnabled({})).toBe(false);
  });
});

describe('registerTestFixtureRpcs', () => {
  const initializer = (): Runtime.Initializer =>
    ({ registerRpc: jest.fn() }) as unknown as Runtime.Initializer;

  it('registers nothing when the env flag is absent', () => {
    const init = initializer();
    expect(registerTestFixtureRpcs(init, createMockLogger(), {})).toBe(false);
    expect(init.registerRpc).not.toHaveBeenCalled();
  });

  it('registers the leaderboard fixture and diag probe RPCs when enabled', () => {
    const init = initializer();
    const logger = createMockLogger();
    expect(registerTestFixtureRpcs(init, logger, { TEST_FIXTURE_RPCS_ENABLED: 'true' })).toBe(true);
    const ids = (init.registerRpc as jest.Mock).mock.calls.map((c) => c[0]);
    expect(ids).toEqual([
      'armored_archer/test_leaderboard_fixture',
      'armored_archer/diag_http_probe',
      'armored_archer/diag_hang_probe',
    ]);
    expect(logger.warn).toHaveBeenCalled();
  });
});


describe('rpcTestLeaderboardFixture (#1661 branch coverage)', () => {
  const authedCtx = () => createMockContext();
  const anonCtx = () =>
    ({ ...createMockContext(), userId: '' }) as unknown as Runtime.Context;
  const withDelete = (nk: Runtime.Nakama): jest.Mock => {
    const del = jest.fn();
    (nk as unknown as Record<string, unknown>).leaderboardRecordDelete = del;
    return del;
  };

  it('rejects unauthenticated calls', () => {
    const res = JSON.parse(
      rpcTestLeaderboardFixture(anonCtx(), createMockLogger(), createMockNakama(), '{}')
    );
    expect(res).toEqual({ success: false, error: 'Authentication required' });
  });

  it('rejects invalid JSON payloads', () => {
    const res = JSON.parse(
      rpcTestLeaderboardFixture(authedCtx(), createMockLogger(), createMockNakama(), 'not-json{')
    );
    expect(res).toEqual({ success: false, error: 'Invalid JSON payload' });
  });

  it('requires leaderboard_id', () => {
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), createMockLogger(), createMockNakama(), '{"op":"write"}'
      )
    );
    expect(res).toEqual({ success: false, error: 'leaderboard_id is required' });
  });

  it('rejects unknown ops', () => {
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), createMockLogger(), createMockNakama(),
        '{"op":"nuke","leaderboard_id":"lb"}'
      )
    );
    expect(res).toEqual({ success: false, error: 'Unknown op: nuke' });
  });

  it('write requires owner_id', () => {
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), createMockLogger(), createMockNakama(),
        '{"op":"write","leaderboard_id":"lb"}'
      )
    );
    expect(res).toEqual({ success: false, error: 'owner_id is required' });
  });

  it('write creates the board and writes the record with defaults', () => {
    const nk = createMockNakama();
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), createMockLogger(), nk,
        '{"op":"write","leaderboard_id":"lb","owner_id":"u1","score":42}'
      )
    );
    expect(res).toEqual({ success: true });
    expect(nk.leaderboardCreate).toHaveBeenCalledWith('lb', true, 'desc', 'best', '', {});
    expect(nk.leaderboardRecordWrite).toHaveBeenCalledWith('lb', 'u1', '', 42, 0, {});
  });

  it('delete removes each owner and swallows per-record errors', () => {
    const nk = createMockNakama();
    const del = withDelete(nk);
    del.mockImplementation((_lb: string, owner: string) => {
      if (owner === 'bad') throw new Error('no board');
    });
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), createMockLogger(), nk,
        '{"op":"delete","leaderboard_id":"lb","owner_ids":["a","bad","c"]}'
      )
    );
    expect(res).toEqual({ success: true });
    expect(del.mock.calls.map((c) => c[1])).toEqual(['a', 'bad', 'c']);
  });

  it('delete with no owner_ids is a no-op success', () => {
    const nk = createMockNakama();
    const del = withDelete(nk);
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), createMockLogger(), nk, '{"op":"delete","leaderboard_id":"lb"}'
      )
    );
    expect(res).toEqual({ success: true });
    expect(del).not.toHaveBeenCalled();
  });

  it('list returns the records array', () => {
    const nk = createMockNakama();
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), createMockLogger(), nk,
        '{"op":"list","leaderboard_id":"lb","owner_ids":["u1"],"limit":5}'
      )
    );
    expect(res.success).toBe(true);
    expect(res.records).toEqual([]);
    expect(nk.leaderboardRecordsList).toHaveBeenCalled();
  });

  it('handler errors are logged and returned as failures', () => {
    const nk = createMockNakama();
    const logger = createMockLogger();
    (nk.leaderboardCreate as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), logger, nk,
        '{"op":"write","leaderboard_id":"lb","owner_id":"u1"}'
      )
    );
    expect(res).toEqual({ success: false, error: 'boom' });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('write passes through explicit username, subscore, and metadata', () => {
    const nk = createMockNakama();
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), createMockLogger(), nk,
        JSON.stringify({
          op: 'write', leaderboard_id: 'lb', owner_id: 'u1',
          username: 'Ace', score: 7, subscore: 3, metadata: { stage: '1_1' },
        })
      )
    );
    expect(res).toEqual({ success: true });
    expect(nk.leaderboardRecordWrite).toHaveBeenCalledWith('lb', 'u1', 'Ace', 7, 3, { stage: '1_1' });
  });

  it('list defaults owner_ids and limit when omitted', () => {
    const nk = createMockNakama();
    const res = JSON.parse(
      rpcTestLeaderboardFixture(
        authedCtx(), createMockLogger(), nk, '{"op":"list","leaderboard_id":"lb"}'
      )
    );
    expect(res.success).toBe(true);
    expect(nk.leaderboardRecordsList).toHaveBeenCalledWith('lb', [], 100, '', 0);
  });
});

