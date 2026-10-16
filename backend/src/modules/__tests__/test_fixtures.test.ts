/**
 * Test-fixture RPC tests (#1456 leaderboard fixture, #1423 diag_http_probe).
 * Uses the shared nakama mock; no live server needed.
 */

import {
  rpcDiagHttpProbe,
  testFixtureRpcsEnabled,
  registerTestFixtureRpcs,
} from '../test_fixtures';
import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import type { Runtime } from '../../types/nakama';

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
    ]);
    expect(logger.warn).toHaveBeenCalled();
  });
});
