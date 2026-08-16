import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import { rpcSubmitCombatAction, MatchState } from '../combat_system';
import { PvPMatch } from '../matchmaker';
import { Runtime } from '../../types/nakama';

jest.mock('../anti_cheat', () => {
  const actual = jest.requireActual('../anti_cheat');
  return {
    ...actual,
    detectTimingAttack: jest.fn().mockReturnValue(false),
    verifyRequestSignature: jest.fn().mockReturnValue({ valid: true, violations: [] }),
    validateCombatActionParameters: jest.fn().mockReturnValue({ valid: true, violations: [] }),
  };
});

jest.mock('../validation', () => {
  const actual = jest.requireActual('../validation');
  return {
    ...actual,
    validatePayload: (...args: any[]) => actual.validatePayload(...args),
  };
});

describe('PvP anti-cheat edge cases', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;
  let mockStorage: Map<string, string>;

  const createActiveMatch = (overrides?: Partial<PvPMatch>): PvPMatch => ({
    match_id: 'match-ac-1',
    creator_id: 'creator-user',
    opponent_id: 'opponent-user',
    creator_rank: 100,
    opponent_rank: 100,
    match_type: 'ranked',
    is_punch_up: false,
    status: 'active',
    created_at: Date.now(),
    updated_at: Date.now(),
    expires_at: Date.now() + 86400000,
    last_turn_timestamp: Date.now(),
    current_turn: 1,
    current_player: 'creator-user',
    turn_time_limit_ms: 30000,
    creator_health: 100,
    opponent_health: 100,
    max_turns: 20,
    creator_consecutive_timeouts: 0,
    opponent_consecutive_timeouts: 0,
    ...overrides,
  });

  const createMatchState = (overrides?: Partial<MatchState>): MatchState => ({
    match_id: 'match-ac-1',
    turn: 1,
    current_turn_user_id: 'creator-user',
    creator_id: 'creator-user',
    opponent_id: 'opponent-user',
    creator_health: 100,
    opponent_health: 100,
    creator_stats: {
      level: 5,
      xp: 0,
      stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 10 },
    },
    opponent_stats: {
      level: 5,
      xp: 0,
      stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 10 },
    },
    status: 'active',
    log: [],
    last_turn_timestamp: Date.now(),
    turn_timeout_ms: 30000,
    consecutive_timeouts: 0,
    ...overrides,
  });

  const setupStorage = () => {
    mockNk.storageRead = jest.fn((objects: any[]) => {
      return objects
        .map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`);
          if (!val) return null;
          return { collection: obj.collection, key: obj.key, value: val };
        })
        .filter(Boolean);
    });

    mockNk.storageWrite = jest.fn((objects: any[]) => {
      objects.forEach((obj: any) => {
        mockStorage.set(`${obj.collection}:${obj.key}`, obj.value);
      });
    });
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'creator-user' });
    mockNk = createMockNakama();
    mockStorage = new Map();
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('should reject out-of-range angle via validation', async () => {
    const result = await rpcSubmitCombatAction(
      mockCtx,
      mockLogger,
      mockNk,
      JSON.stringify({
        match_id: 'match-ac-1',
        action_type: 'shoot',
        angle: 99.0, // Out of valid range (0-2π)
        power: 0.5,
      })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error_code).toBe('VALIDATION_ERROR');
  });

  it('should reject out-of-range power via validation', async () => {
    const result = await rpcSubmitCombatAction(
      mockCtx,
      mockLogger,
      mockNk,
      JSON.stringify({
        match_id: 'match-ac-1',
        action_type: 'shoot',
        angle: 1.5,
        power: 5.0, // Out of valid range (0-1)
      })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error_code).toBe('VALIDATION_ERROR');
  });

  it('should handle rapid turn submissions correctly', async () => {
    const match = createActiveMatch();
    const state = createMatchState();
    mockStorage.set('pvp_matches:match-ac-1', JSON.stringify(match));
    mockStorage.set('pvp_match_states:match-ac-1', JSON.stringify(state));
    setupStorage();

    // First action should succeed
    const result1 = await rpcSubmitCombatAction(
      mockCtx,
      mockLogger,
      mockNk,
      JSON.stringify({ match_id: 'match-ac-1', action_type: 'shoot', angle: 1.0, power: 0.5 })
    );
    const parsed1 = JSON.parse(result1);
    expect(parsed1.success).toBe(true);

    // Second rapid action should fail - turn has switched to opponent
    const result2 = await rpcSubmitCombatAction(
      mockCtx,
      mockLogger,
      mockNk,
      JSON.stringify({ match_id: 'match-ac-1', action_type: 'shoot', angle: 1.0, power: 0.5 })
    );
    const parsed2 = JSON.parse(result2);
    expect(parsed2.error).toBe('Not your turn');
  });
});
