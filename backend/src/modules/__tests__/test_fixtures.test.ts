import {
  rpcTestLeaderboardFixture,
  registerTestFixtureRpcs,
  testFixtureRpcsEnabled,
  TEST_FIXTURE_RPC_ID,
} from '../test_fixtures';

function makeNk(overrides: Record<string, jest.Mock> = {}): any {
  return {
    leaderboardCreate: jest.fn(),
    leaderboardRecordWrite: jest.fn(),
    leaderboardRecordDelete: jest.fn(),
    leaderboardRecordList: jest.fn().mockReturnValue([{ ownerId: 'u1', score: 10 }]),
    ...overrides,
  };
}
const logger: any = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const ctx: any = { userId: 'caller' };
const call = (nk: any, body: any, c: any = ctx) =>
  JSON.parse(
    rpcTestLeaderboardFixture(c, logger, nk, typeof body === 'string' ? body : JSON.stringify(body))
  );

describe('test_fixtures', () => {
  test('flag gate only accepts the literal "true"', () => {
    expect(testFixtureRpcsEnabled({ TEST_FIXTURE_RPCS_ENABLED: 'true' })).toBe(true);
    expect(testFixtureRpcsEnabled({ TEST_FIXTURE_RPCS_ENABLED: '1' })).toBe(false);
    expect(testFixtureRpcsEnabled({})).toBe(false);
  });

  test('registers only when enabled', () => {
    const initializer: any = { registerRpc: jest.fn() };
    expect(registerTestFixtureRpcs(initializer, logger, {})).toBe(false);
    expect(initializer.registerRpc).not.toHaveBeenCalled();
    expect(
      registerTestFixtureRpcs(initializer, logger, { TEST_FIXTURE_RPCS_ENABLED: 'true' })
    ).toBe(true);
    expect(initializer.registerRpc).toHaveBeenCalledWith(
      TEST_FIXTURE_RPC_ID,
      rpcTestLeaderboardFixture
    );
    expect(logger.warn).toHaveBeenCalled();
  });

  test('rejects unauthenticated, bad JSON, missing ids and unknown ops', () => {
    const nk = makeNk();
    expect(call(nk, { op: 'list', leaderboard_id: 's' }, {}).error).toMatch(/Authentication/);
    expect(call(nk, '{not json').error).toMatch(/Invalid JSON/);
    expect(call(nk, { op: 'list' }).error).toMatch(/leaderboard_id/);
    expect(call(nk, { op: 'write', leaderboard_id: 's' }).error).toMatch(/owner_id/);
    expect(call(nk, { op: 'nope', leaderboard_id: 's' }).error).toMatch(/Unknown op/);
  });

  test('write creates the board then writes the record', () => {
    const nk = makeNk();
    const res = call(nk, {
      op: 'write',
      leaderboard_id: 'season_1',
      owner_id: 'u1',
      username: 'alice',
      score: 1500,
      subscore: 2,
      metadata: { wins: '10' },
    });
    expect(res.success).toBe(true);
    expect(nk.leaderboardCreate).toHaveBeenCalledWith('season_1', true, 'desc', 'best', '', {});
    expect(nk.leaderboardRecordWrite).toHaveBeenCalledWith('season_1', 'u1', 'alice', 1500, 2, {
      wins: '10',
    });
  });

  test('write defaults username, scores and metadata', () => {
    const nk = makeNk();
    call(nk, { op: 'write', leaderboard_id: 's', owner_id: 'u1' });
    expect(nk.leaderboardRecordWrite).toHaveBeenCalledWith('s', 'u1', '', 0, 0, {});
  });

  test('delete tolerates missing records', () => {
    const nk = makeNk({
      leaderboardRecordDelete: jest.fn().mockImplementationOnce(() => {
        throw new Error('not found');
      }),
    });
    const res = call(nk, { op: 'delete', leaderboard_id: 's', owner_ids: ['a', 'b'] });
    expect(res.success).toBe(true);
    expect(nk.leaderboardRecordDelete).toHaveBeenCalledTimes(2);
    expect(call(makeNk(), { op: 'delete', leaderboard_id: 's' }).success).toBe(true);
  });

  test('list returns records and defaults', () => {
    const nk = makeNk();
    expect(
      call(nk, { op: 'list', leaderboard_id: 's', owner_ids: ['u1'], limit: 5 }).records
    ).toHaveLength(1);
    expect(nk.leaderboardRecordList).toHaveBeenCalledWith('s', ['u1'], 5, '', 0);
    const empty = makeNk({ leaderboardRecordList: jest.fn().mockReturnValue(null) });
    expect(call(empty, { op: 'list', leaderboard_id: 's' }).records).toEqual([]);
    expect(empty.leaderboardRecordList).toHaveBeenCalledWith('s', [], 100, '', 0);
  });

  test('surfaces runtime errors as a failed payload', () => {
    const nk = makeNk({
      leaderboardRecordWrite: jest.fn(() => {
        throw new Error('boom');
      }),
    });
    const res = call(nk, { op: 'write', leaderboard_id: 's', owner_id: 'u1' });
    expect(res).toEqual({ success: false, error: 'boom' });
  });
});
