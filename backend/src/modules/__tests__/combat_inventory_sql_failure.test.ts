import {
  createMockContext,
  createMockLogger,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { rpcGetMatchState, rpcSubmitCombatAction, PvPMatch } from '../combat_system';
const match: PvPMatch = {
  match_id: 'match-inventory',
  creator_id: 'creator-user',
  opponent_id: 'opponent-user',
  creator_rank: 100,
  opponent_rank: 100,
  match_type: 'ranked',
  is_punch_up: false,
  status: 'active',
  created_at: 1,
  updated_at: 1,
};
const cases = [
  {
    rpc: 'armored_archer/get_match_state',
    handler: rpcGetMatchState,
    payload: JSON.stringify({ match_id: match.match_id }),
  },
  {
    rpc: 'armored_archer/submit_combat_action',
    handler: rpcSubmitCombatAction,
    payload: JSON.stringify({
      match_id: match.match_id,
      action_type: 'shoot',
      angle: 1.5,
      power: 0.5,
    }),
  },
];
function setup() {
  const nk = createMockNakama();
  (nk.storageRead as jest.Mock).mockImplementation((objs: any[]) =>
    objs[0]?.collection === 'pvp_matches'
      ? [{ collection: 'pvp_matches', key: match.match_id, value: match }]
      : []
  );
  return nk;
}

describe('combat initialization inventory SQL failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testStorage.clear();
  });
  it.each(cases)('fails before combat writes for $rpc', ({ rpc, handler, payload }) => {
    const nk = setup();
    const logger = createMockLogger();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('private SQL driver token');
    });
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(
      handler(createMockContext({ userId: match.creator_id }), logger, nk, payload)
    );
    expect(result).toEqual({
      success: false,
      error: 'Failed to load combat inventory',
      error_code: 'DATABASE_ERROR',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Database query failed: rpc=%s op=%s',
      rpc,
      'gear_db.getPlayerGearFromDB'
    );
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      { op: 'gear_db.getPlayerGearFromDB', rpc },
      1
    );
    expect(nk.sqlQuery).toHaveBeenCalledWith(expect.stringContaining('FROM inventory_items'), [
      match.creator_id,
    ]);
    expect(nk.storageWrite).not.toHaveBeenCalled();
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls])).not.toContain(
      'private'
    );
  });
  it.each(['creator-user', 'opponent-user'])(
    'fails on loadout SQL for %s without using missing gear stats',
    (user) => {
      const nk = setup();
      const logger = createMockLogger();
      (nk.sqlQuery as jest.Mock).mockImplementation((sql: string, params: string[]) => {
        if (sql.includes('FROM loadout') && params[0] === user) throw new Error('private driver');
        return [];
      });
      nk.metricsCounterAdd = jest.fn();
      const result = JSON.parse(
        rpcGetMatchState(
          createMockContext({ userId: match.creator_id }),
          logger,
          nk,
          cases[0].payload
        )
      );
      expect(result.error_code).toBe('DATABASE_ERROR');
      expect(logger.error).toHaveBeenCalledWith(
        'Database query failed: rpc=%s op=%s',
        cases[0].rpc,
        'gear_db.getPlayerLoadoutFromDB'
      );
      expect(nk.storageWrite).not.toHaveBeenCalled();
    }
  );
  it('fails safely on pool SQL with unavailable metric API', () => {
    const nk = setup();
    const logger = createMockLogger();
    (nk.sqlQuery as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM unlocked_modifier_pools')) throw new Error('private SQL');
      return [];
    });
    nk.metricsCounterAdd = jest.fn(() => {
      throw new Error('metric down');
    });
    expect(
      JSON.parse(
        rpcGetMatchState(
          createMockContext({ userId: match.creator_id }),
          logger,
          nk,
          cases[0].payload
        )
      ).error_code
    ).toBe('DATABASE_ERROR');
    expect(nk.storageWrite).not.toHaveBeenCalled();
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
  });
  it('returns an existing state without querying fresh inventory', () => {
    const nk = setup();
    const saved = { match_id: match.match_id, status: 'active', turn: 2 };
    (nk.storageRead as jest.Mock).mockImplementation((objects: any[]) => {
      return objects[0].collection === 'pvp_matches'
        ? [{ collection: 'pvp_matches', key: match.match_id, value: match }]
        : [{ collection: 'pvp_match_states', key: match.match_id, value: saved }];
    });
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('unexpected query');
    });
    const result = JSON.parse(
      rpcGetMatchState(
        createMockContext({ userId: match.creator_id }),
        createMockLogger(),
        nk,
        cases[0].payload
      )
    );
    expect(result).toEqual(saved);
    expect(nk.sqlQuery).not.toHaveBeenCalled();
    expect(nk.storageWrite).not.toHaveBeenCalled();
  });

  it('keeps genuinely empty inventory initial state successful and read-only', () => {
    const nk = setup();
    (nk.sqlQuery as jest.Mock).mockReturnValue([]);
    nk.metricsCounterAdd = jest.fn();
    const result = JSON.parse(
      rpcGetMatchState(
        createMockContext({ userId: match.creator_id }),
        createMockLogger(),
        nk,
        cases[0].payload
      )
    );
    expect(result.status).toBe('active');
    expect(result.creator_stats.stats.attack).toBe(10);
    expect(result.opponent_stats.stats.attack).toBe(10);
    expect(nk.storageWrite).not.toHaveBeenCalled();
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
  });
});
