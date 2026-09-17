import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcSubmitCombatAction,
  rpcGetMatchState,
  rpcPlayerDisconnect,
  registerRpcSubmitCombatAction,
  registerRpcGetMatchState,
  registerRpcPlayerDisconnect,
  MatchState,
  PvPMatch,
  CombatAction,
} from '../combat_system';
import { Runtime } from '../../types/nakama';

// Mock anti_cheat to avoid timing attacks and signature issues in tests
jest.mock('../anti_cheat', () => {
  const actual = jest.requireActual('../anti_cheat');
  return {
    ...actual,
    detectTimingAttack: jest.fn().mockReturnValue(false),
    verifyRequestSignature: jest.fn().mockReturnValue({ valid: true, violations: [] }),
    validateCombatActionParameters: jest.fn().mockReturnValue({ valid: true, violations: [] }),
  };
});

// Mock validation to allow per-test override of validatePayload
const mockValidatePayload = jest.fn();
jest.mock('../validation', () => {
  const actual = jest.requireActual('../validation');
  return {
    ...actual,
    validatePayload: (...args: any[]) => mockValidatePayload(...args),
  };
});

describe('combat_system', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'creator-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    // Reset validatePayload mock to use real implementation
    const realValidation = jest.requireActual('../validation');
    mockValidatePayload.mockImplementation(realValidation.validatePayload);
  });

  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
  });

  const createMockMatch = (overrides?: Partial<PvPMatch>): PvPMatch => ({
    match_id: 'match-123',
    creator_id: 'creator-user',
    opponent_id: 'opponent-user',
    creator_rank: 100,
    opponent_rank: 100,
    match_type: 'ranked',
    is_punch_up: false,
    status: 'active',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  });

  describe('rpcSubmitCombatAction', () => {
    it('should process combat action and return result', async () => {
      const match = createMockMatch({ status: 'active' });
      const mockMatchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(mockMatchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn((objects) => {
        objects.forEach((obj: any) => {
          mockStorage.set(`${obj.collection}:${obj.key}`, obj.value);
        });
      });

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.result).toBeDefined();
    });

    it('should return error for non-existent match', async () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({
        match_id: 'nonexistent',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match not found');
    });

    it('should return error for inactive match', async () => {
      const match = createMockMatch({ status: 'completed' });
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'pvp_matches',
          key: 'match-123',
          value: JSON.stringify(match),
        },
      ]);

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match is not active');
    });

    it('should return error when not participant', async () => {
      const match = createMockMatch({ creator_id: 'other-user', opponent_id: 'another-user' });
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'pvp_matches',
          key: 'match-123',
          value: JSON.stringify(match),
        },
      ]);

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Not a participant in this match');
    });

    it('should return error when not user turn', async () => {
      const match = createMockMatch();
      const matchState: MatchState = {
        ...createMockMatch(),
        turn: 1,
        current_turn_user_id: 'opponent-user',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Not your turn');
    });

    it('should validate input payload', async () => {
      const payload = JSON.stringify({
        match_id: '',
        action_type: 'invalid',
        angle: 'not a number',
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcGetMatchState', () => {
    it('should return match state', async () => {
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'pvp_match_states',
          key: 'match-123',
          value: JSON.stringify(matchState),
        },
      ]);

      const payload = JSON.stringify({ match_id: 'match-123' });
      const result = await rpcGetMatchState(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.match_id).toBe('match-123');
    });

    it('should return error when match state not found', async () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ match_id: 'nonexistent' });
      const result = await rpcGetMatchState(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match state not found');
    });
  });

  describe('registerRpcSubmitCombatAction', () => {
    it('should register the RPC handler', async () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcSubmitCombatAction(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/submit_combat_action',
        rpcSubmitCombatAction
      );
    });
  });

  describe('registerRpcGetMatchState', () => {
    it('should register the RPC handler', async () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerRpcGetMatchState(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_match_state',
        rpcGetMatchState
      );
    });
  });

  describe('registerRpcPlayerDisconnect', () => {
    it('should register the RPC handler', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as any;

      registerRpcPlayerDisconnect(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/player_disconnect',
        rpcPlayerDisconnect
      );
    });
  });

  describe('rpcSubmitCombatAction - anti-cheat', () => {
    it('should process action with anti-cheat fields', async () => {
      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      // Include anti-cheat fields with valid lengths (requestId = 32, signature = 64, nonce = 32)
      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
        requestId: 'req_1234567890123456789012345678', // 32 chars
        timestamp: Date.now(),
        signature: '0123456789012345678901234567890123456789012345678901234567890123', // 64 chars
        nonce: 'nonce_12345678901234567890123456', // 32 chars
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });
  });

  describe('rpcSubmitCombatAction - turn timeout', () => {
    it('should handle turn timeout and switch turns', async () => {
      const match = createMockMatch({ status: 'active' });

      // Match state with old timestamp (timed out)
      const timedOutMatchState: MatchState = {
        match_id: 'match-123',
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
        last_turn_timestamp: Date.now() - 31 * 60 * 1000, // 31 minutes ago
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(timedOutMatchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Your previous turn timed out, opponent now has their turn');
    });

    it('should handle auto-forfeit after consecutive timeouts', async () => {
      const match = createMockMatch({ status: 'active' });
      const timedOutMatchState: MatchState = {
        match_id: 'match-123',
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
        last_turn_timestamp: Date.now() - 31 * 60 * 1000,
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 1, // Already has one timeout
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(timedOutMatchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();
      mockNk.notificationSend = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match forfeited due to consecutive timeouts');
      expect(parsed.forfeit).toBe(true);
      expect(parsed.winner).toBe('opponent-user');
    });

    describe('turn timers as grace window (issue #868)', () => {
      const COMBAT_ACTION_PAYLOAD = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });

      const createGraceMatchState = (overrides?: Partial<MatchState>): MatchState => ({
        match_id: 'match-123',
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
        turn_timeout_ms: 5 * 60 * 1000, // Production turn timer
        consecutive_timeouts: 0,
        ...overrides,
      });

      const wireStorage = (match: PvPMatch, matchState: MatchState): void => {
        const mockStorage = new Map();
        mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
        mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

        mockNk.storageRead = jest.fn((objects) => {
          return objects
            .map((obj: any) => {
              const val =
                mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
              if (!val) return null;
              return {
                collection: obj.collection,
                key: obj.key,
                value: val,
              };
            })
            .filter(Boolean);
        });

        mockNk.storageWrite = jest.fn();
        mockNk.notificationSend = jest.fn();
      };

      const findStorageWrite = (collection: string): Record<string, any> | undefined => {
        const calls = (mockNk.storageWrite as jest.Mock).mock.calls as any[][];
        for (const call of calls) {
          const written = call[0].find((obj: any) => obj.collection === collection);
          if (written) {
            return typeof written.value === 'string'
              ? (typeof written.value === 'string' ? (typeof written.value === 'string' ? (typeof written.value === 'string' ? JSON.parse(written.value) : written.value) : written.value) : written.value)
              : written.value;
          }
        }
        return undefined;
      };

      it('should not forfeit when inactive beyond the removed 2-min inactivity window but within the turn timer', async () => {
        // Interruption scenario: player app-switched mid-duel 4 minutes ago.
        // The removed 2-min inactivity forfeit would have ended the match here;
        // with turn timers as the single authority (5 min) the match continues.
        const match = createMockMatch({ status: 'active' });
        const matchState = createGraceMatchState({
          last_turn_timestamp: Date.now() - 4 * 60 * 1000, // 4 min ago
          turn_timeout_ms: 5 * 60 * 1000,
          consecutive_timeouts: 0,
        });
        wireStorage(match, matchState);

        const result = await rpcSubmitCombatAction(
          mockCtx,
          mockLogger,
          mockNk,
          COMBAT_ACTION_PAYLOAD
        );
        const parsed = JSON.parse(result);

        // Action processes normally — no forfeit, no error
        expect(parsed.error).toBeUndefined();
        expect(parsed.forfeit).toBeUndefined();
        expect(parsed.success).toBe(true);
        expect(parsed.result.match_status).toBe('active');
      });

      it('should not forfeit when returning within grace after one prior turn timeout', async () => {
        // Player already banked one timeout (~5 min away), opponent took their
        // turn, and the turn came back with a fresh timestamp. The returning
        // player acts well within the second turn timer — total inactivity
        // spans less than 2 consecutive turn timers, so no forfeit and the
        // consecutive timeout counter resets.
        const match = createMockMatch({ status: 'active' });
        const matchState = createGraceMatchState({
          turn: 3,
          current_turn_user_id: 'creator-user',
          last_turn_timestamp: Date.now() - 30 * 1000, // opponent just acted
          turn_timeout_ms: 5 * 60 * 1000,
          consecutive_timeouts: 1,
        });
        wireStorage(match, matchState);

        const result = await rpcSubmitCombatAction(
          mockCtx,
          mockLogger,
          mockNk,
          COMBAT_ACTION_PAYLOAD
        );
        const parsed = JSON.parse(result);

        expect(parsed.error).toBeUndefined();
        expect(parsed.forfeit).toBeUndefined();
        expect(parsed.success).toBe(true);

        // Consecutive timeout counter reset on the successful action
        const savedState = findStorageWrite('pvp_match_states');
        expect(savedState).toBeDefined();
        expect(savedState?.consecutive_timeouts).toBe(0);
        expect(savedState?.status).toBe('active');
      });

      it('should still forfeit with end_reason=timeout at 2 consecutive turn timeouts', async () => {
        // Turn timers expire naturally: a second consecutive expiry (~6 min
        // into a 5-min turn) forfeits and records end_reason=timeout via the
        // turn-timer path, preserving server-declared settlement semantics (#861).
        const match = createMockMatch({ status: 'active' });
        const matchState = createGraceMatchState({
          last_turn_timestamp: Date.now() - 6 * 60 * 1000, // 6 min ago
          turn_timeout_ms: 5 * 60 * 1000,
          consecutive_timeouts: 1,
        });
        wireStorage(match, matchState);

        const result = await rpcSubmitCombatAction(
          mockCtx,
          mockLogger,
          mockNk,
          COMBAT_ACTION_PAYLOAD
        );
        const parsed = JSON.parse(result);

        expect(parsed.error).toBe('Match forfeited due to consecutive timeouts');
        expect(parsed.forfeit).toBe(true);
        expect(parsed.winner).toBe('opponent-user');

        // Server-declared settlement: the persisted match records end_reason
        const savedMatch = findStorageWrite('pvp_matches');
        expect(savedMatch).toBeDefined();
        expect(savedMatch?.status).toBe('completed');
        expect(savedMatch?.winner).toBe('opponent-user');
        expect(savedMatch?.end_reason).toBe('timeout');
      });
    });
  });

  describe('rpcSubmitCombatAction - combat resolution', () => {
    it('should complete match when health reaches zero', async () => {
      const match = createMockMatch({ status: 'active' });

      // Match state with opponent at 1 health (one hit will finish them)
      const matchState: MatchState = {
        match_id: 'match-123',
        turn: 1,
        current_turn_user_id: 'creator-user',
        creator_id: 'creator-user',
        opponent_id: 'opponent-user',
        creator_health: 100,
        opponent_health: 1,
        creator_stats: {
          level: 5,
          xp: 0,
          stats: { attack: 100, defense: 15, dodge: 10, crit_rate: 10 },
        },
        opponent_stats: {
          level: 5,
          xp: 0,
          stats: { attack: 20, defense: 1, dodge: 0, crit_rate: 10 },
        },
        status: 'active',
        log: [],
        last_turn_timestamp: Date.now(),
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 1.0,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.result.match_status).toBe('completed');
      expect(parsed.result.winner).toBe('creator-user');
    });

    it('should handle miss (hit=false)', async () => {
      const match = createMockMatch({ status: 'active' });

      // High dodge defender to ensure miss
      const matchState: MatchState = {
        match_id: 'match-123',
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
          stats: { attack: 20, defense: 15, dodge: 100, crit_rate: 10 }, // 100% dodge!
        },
        status: 'active',
        log: [],
        last_turn_timestamp: Date.now(),
        turn_timeout_ms: 300000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects.map((obj: any) => ({
          collection: obj.collection,
          key: obj.key,
          value: mockStorage.get(`${obj.collection}:${obj.key}`) ?? null,
        }));
      });

      mockNk.storageWrite = jest.fn();

      // Mock Math.random to return high value (miss)
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.result.hit).toBe(false);
      expect(parsed.result.damage).toBe(0);
    });

    it('should handle critical hit and double damage', async () => {
      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
        turn: 1,
        current_turn_user_id: 'creator-user',
        creator_id: 'creator-user',
        opponent_id: 'opponent-user',
        creator_health: 100,
        opponent_health: 100,
        creator_stats: {
          level: 5,
          xp: 0,
          stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 100 }, // 100% crit!
        },
        opponent_stats: {
          level: 5,
          xp: 0,
          stats: { attack: 20, defense: 15, dodge: 0, crit_rate: 10 },
        },
        status: 'active',
        log: [],
        last_turn_timestamp: Date.now(),
        turn_timeout_ms: 300000,
        consecutive_timeouts: 0,
      };

      mockNk.storageRead = jest.fn((objects) => {
        if (objects[0].collection === 'pvp_matches') {
          return [{ collection: 'pvp_matches', key: 'match-123', value: JSON.stringify(match) }];
        }
        return [
          { collection: 'pvp_match_states', key: 'match-123', value: JSON.stringify(matchState) },
        ];
      });

      mockNk.storageWrite = jest.fn();

      // Mock Math.random to ensure hit (0.1) and crit (0.1)
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.result.is_crit).toBe(true);
      expect(parsed.result.damage).toBe(30);
    });
  });

  describe('rpcPlayerDisconnect', () => {
    it('should forfeit match on player disconnect', async () => {
      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();
      mockNk.notificationSend = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'voluntary',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.forfeit).toBe(true);
      expect(parsed.winner).toBe('opponent-user');
    });

    it('should return error when match not found', async () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({
        match_id: 'nonexistent',
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match not found');
    });

    it('should return error when match is not active', async () => {
      const match = createMockMatch({ status: 'completed' });
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'pvp_matches',
          key: 'match-123',
          value: JSON.stringify(match),
        },
      ]);

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match is not active');
    });

    it('should return error when user is not a participant', async () => {
      const match = createMockMatch({ creator_id: 'user-1', opponent_id: 'user-2' });
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'pvp_matches',
          key: 'match-123',
          value: JSON.stringify(match),
        },
      ]);

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Not a participant in this match');
    });

    it('should return error when match state not found', async () => {
      const match = createMockMatch({ status: 'active' });

      mockNk.storageRead = jest.fn((objects: any[]) => {
        return objects
          .map((obj) => {
            if (obj.collection === 'pvp_matches' && obj.key === 'match-123') {
              return {
                collection: 'pvp_matches',
                key: 'match-123',
                value: JSON.stringify(match),
              };
            }
            return null;
          })
          .filter(Boolean);
      });

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match state not found');
    });
  });

  describe('rpcSubmitCombatAction - anti-cheat edge cases', () => {
    it('should return error when anti-cheat signature verification fails', async () => {
      const antiCheat = require('../anti_cheat');
      antiCheat.verifyRequestSignature.mockReturnValueOnce({ valid: false, violations: [] });

      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return { collection: obj.collection, key: obj.key, value: val };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
        requestId: 'req_1234567890123456789012345678',
        timestamp: Date.now(),
        signature: '0123456789012345678901234567890123456789012345678901234567890123',
        nonce: 'nonce_12345678901234567890123456',
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('ANTI_CHEAT_VIOLATION: Invalid request signature');
      expect(parsed.error_code).toBe('ANTI_CHEAT_VIOLATION');
    });

    it('should return error when combat parameters are invalid', async () => {
      const antiCheat = require('../anti_cheat');
      antiCheat.validateCombatActionParameters.mockReturnValueOnce({
        valid: false,
        violations: [{ violationType: 'invalid_angle' }],
      });

      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return { collection: obj.collection, key: obj.key, value: val };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('INVALID_PARAMETERS: Combat parameters out of valid range');
      expect(parsed.error_code).toBe('INVALID_PARAMETERS');
    });

    it('should return error when timing attack is detected', async () => {
      const antiCheat = require('../anti_cheat');
      antiCheat.detectTimingAttack.mockReturnValueOnce(true);

      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return { collection: obj.collection, key: obj.key, value: val };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('TIMING_ANOMALY: Suspicious request pattern detected');
      expect(parsed.error_code).toBe('TIMING_ANOMALY');
    });

    it('should return error when out of turn violation detected', async () => {
      const antiCheat = require('../anti_cheat');
      antiCheat.validateCombatActionParameters.mockReturnValueOnce({
        valid: false,
        violations: [{ violationType: 'out_of_turn' }],
      });

      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
        turn: 1,
        current_turn_user_id: 'opponent-user',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return { collection: obj.collection, key: obj.key, value: val };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Not your turn');
    });

    it('should handle notification send failure gracefully in forfeit', async () => {
      const match = createMockMatch({ status: 'active' });
      const timedOutMatchState: MatchState = {
        match_id: 'match-123',
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
        last_turn_timestamp: Date.now() - 31 * 60 * 1000,
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 1,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(timedOutMatchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return { collection: obj.collection, key: obj.key, value: val };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();
      // Make notificationSend throw an error
      mockNk.notificationSend = jest.fn().mockImplementation(() => {
        throw new Error('Notification service unavailable');
      });

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Should still succeed despite notification failure
      expect(parsed.error).toBe('Match forfeited due to consecutive timeouts');
      expect(parsed.forfeit).toBe(true);
    });
  });

  describe('rpcPlayerDisconnect - edge cases', () => {
    it('should handle disconnect when match state value is corrupted (empty)', async () => {
      const match = createMockMatch({ status: 'active' });

      mockNk.storageRead = jest.fn((objects: any[]) => {
        return objects
          .map((obj) => {
            if (obj.collection === 'pvp_matches' && obj.key === 'match-123') {
              return {
                collection: 'pvp_matches',
                key: 'match-123',
                value: JSON.stringify(match),
              };
            }
            if (obj.collection === 'pvp_match_states' && obj.key === 'match-123') {
              return {
                collection: 'pvp_match_states',
                key: 'match-123',
                value: '', // Empty/corrupted value
              };
            }
            return null;
          })
          .filter(Boolean);
      });

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match state not found');
    });

    it('should handle disconnect with default reason when none provided', async () => {
      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return { collection: obj.collection, key: obj.key, value: val };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();
      mockNk.notificationSend = jest.fn();

      // No reason provided - should default to 'disconnect'
      const payload = JSON.stringify({
        match_id: 'match-123',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.reason).toBe('disconnect');
    });

    it('should validate disconnect payload', async () => {
      const payload = JSON.stringify({
        match_id: '',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('combat_system helpers and edge cases', () => {
    it('should create initial match state if it does not exist', async () => {
      const match = createMockMatch({ status: 'active' });

      // Mock storageRead: first call (match) returns match, second call (match state) returns empty
      mockNk.storageRead = jest
        .fn()
        .mockReturnValueOnce([
          {
            collection: 'pvp_matches',
            key: 'match-123',
            value: JSON.stringify(match),
          },
        ])
        .mockReturnValueOnce([]); // No match state found

      // Mock stats for both players
      mockNk.storageRead
        .mockReturnValueOnce([
          {
            collection: 'player_stats',
            key: 'creator-user',
            value: JSON.stringify({
              level: 1,
              stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
            }),
          },
        ])
        .mockReturnValueOnce([
          {
            collection: 'player_stats',
            key: 'opponent-user',
            value: JSON.stringify({
              level: 1,
              stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
            }),
          },
        ]);

      // Mock inventory read (empty)
      mockNk.storageRead.mockReturnValue([]);

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should return error when match has expired', async () => {
      // Create match with expired timestamp
      const expiredMatch = createMockMatch({
        status: 'active',
        expires_at: Date.now() - 1000, // Expired 1 second ago
      });

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'pvp_matches',
          key: 'match-123',
          value: JSON.stringify(expiredMatch),
        },
      ]);

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match has expired');
    });

    it('should handle opponent disconnect and declare winner', async () => {
      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();
      mockNk.notificationSend = jest.fn();

      // User is opponent, so winner should be creator
      const opponentCtx = createMockContext({ userId: 'opponent-user' });

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(opponentCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.forfeit).toBe(true);
      expect(parsed.winner).toBe('creator-user');
    });

    it('should process non-shoot action type without hit/damage calculations', async () => {
      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      // Override validatePayload to accept 'block' action type
      mockValidatePayload.mockReturnValue({
        success: true,
        data: {
          match_id: 'match-123',
          action_type: 'block',
          angle: 1.5,
        },
      });

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'block',
        angle: 1.5,
      });

      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Non-shoot action should still succeed but with no hit/damage
      expect(parsed.success).toBe(true);
      expect(parsed.result.hit).toBe(false);
      expect(parsed.result.damage).toBe(0);
      expect(parsed.result.is_crit).toBe(false);
      // Turn should still advance
      expect(parsed.result.match_status).toBe('active');
    });

    it('should declare creator as winner when opponent health reaches zero', async () => {
      const match = createMockMatch({ status: 'active' });

      // Opponent at very low health, creator has high attack
      const matchState: MatchState = {
        match_id: 'match-123',
        turn: 1,
        current_turn_user_id: 'creator-user',
        creator_id: 'creator-user',
        opponent_id: 'opponent-user',
        creator_health: 100,
        opponent_health: 1, // One hit will kill
        creator_stats: {
          level: 5,
          xp: 0,
          stats: { attack: 100, defense: 15, dodge: 10, crit_rate: 10 },
        },
        opponent_stats: {
          level: 5,
          xp: 0,
          stats: { attack: 20, defense: 1, dodge: 0, crit_rate: 10 },
        },
        status: 'active',
        log: [],
        last_turn_timestamp: Date.now(),
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      // Force hit (Math.random low) so damage is dealt
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 1.0,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.result.hit).toBe(true);
      expect(parsed.result.damage).toBeGreaterThan(0);
      expect(parsed.result.match_status).toBe('completed');
      expect(parsed.result.winner).toBe('creator-user');
    });

    it('should handle forfeit timeout with match read and notification', async () => {
      const match = createMockMatch({ status: 'active' });

      // Match state with consecutive_timeouts at MAX - 1 (1), so next timeout triggers forfeit
      const timedOutMatchState: MatchState = {
        match_id: 'match-123',
        turn: 2,
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
        last_turn_timestamp: Date.now() - 31 * 60 * 1000, // 31 minutes ago
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 1, // One more timeout triggers forfeit (MAX_CONSECUTIVE_TIMEOUTS = 2)
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(timedOutMatchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();
      mockNk.notificationSend = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Should return forfeit error with winner info
      expect(parsed.error).toBe('Match forfeited due to consecutive timeouts');
      expect(parsed.forfeit).toBe(true);
      expect(parsed.winner).toBe('opponent-user');

      // Verify notification was sent to opponent
      expect(mockNk.notificationSend).toHaveBeenCalled();

      // Verify storage was written (match state saved)
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should create match state when none exists in storage', async () => {
      const match = createMockMatch({ status: 'active' });

      // Use sequential mock to handle multiple storageRead calls
      let readCallCount = 0;
      mockNk.storageRead = jest.fn(() => {
        readCallCount++;
        if (readCallCount === 1) {
          // First call: match lookup
          return [
            {
              collection: 'pvp_matches',
              key: 'match-123',
              value: JSON.stringify(match),
            },
          ];
        }
        if (readCallCount === 2) {
          // Second call: match state lookup (empty - no state exists)
          return [];
        }
        if (readCallCount === 3) {
          // Third call: creator player stats
          return [
            {
              collection: 'player_stats',
              key: 'creator-user',
              value: JSON.stringify({
                level: 1,
                xp: 0,
                stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
              }),
            },
          ];
        }
        if (readCallCount === 4) {
          // Fourth call: opponent player stats
          return [
            {
              collection: 'player_stats',
              key: 'opponent-user',
              value: JSON.stringify({
                level: 1,
                xp: 0,
                stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
              }),
            },
          ];
        }
        // Subsequent calls: inventory (empty)
        return [];
      });

      mockNk.storageWrite = jest.fn();

      // Force hit
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Should succeed - match state was created on the fly
      expect(parsed.success).toBe(true);
      expect(parsed.result).toBeDefined();
    });

    it('should declare opponent as winner when creator health reaches zero', async () => {
      const match = createMockMatch({ status: 'active' });

      // Creator at very low health, opponent has high attack
      const matchState: MatchState = {
        match_id: 'match-123',
        turn: 1,
        current_turn_user_id: 'opponent-user',
        creator_id: 'creator-user',
        opponent_id: 'opponent-user',
        creator_health: 1, // One hit will kill
        opponent_health: 100,
        creator_stats: {
          level: 5,
          xp: 0,
          stats: { attack: 20, defense: 1, dodge: 0, crit_rate: 10 },
        },
        opponent_stats: {
          level: 5,
          xp: 0,
          stats: { attack: 100, defense: 15, dodge: 10, crit_rate: 10 },
        },
        status: 'active',
        log: [],
        last_turn_timestamp: Date.now(),
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      // Force hit (Math.random low) so damage is dealt
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      // Use opponent context
      const opponentCtx = createMockContext({ userId: 'opponent-user' });

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 1.0,
      });
      const result = await rpcSubmitCombatAction(opponentCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.result.hit).toBe(true);
      expect(parsed.result.damage).toBeGreaterThan(0);
      expect(parsed.result.match_status).toBe('completed');
      expect(parsed.result.winner).toBe('opponent-user');
    });

    it('should create match state when stored value is empty (corrupted data)', async () => {
      const match = createMockMatch({ status: 'active' });

      let readCallCount = 0;
      mockNk.storageRead = jest.fn(() => {
        readCallCount++;
        if (readCallCount === 1) {
          // First call: match lookup
          return [
            {
              collection: 'pvp_matches',
              key: 'match-123',
              value: JSON.stringify(match),
            },
          ];
        }
        if (readCallCount === 2) {
          // Second call: match state lookup with empty value (corrupted)
          return [
            {
              collection: 'pvp_match_states',
              key: 'match-123',
              value: '', // Empty/corrupted value
            },
          ];
        }
        if (readCallCount === 3) {
          // Creator player stats
          return [
            {
              collection: 'player_stats',
              key: 'creator-user',
              value: JSON.stringify({
                level: 1,
                xp: 0,
                stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
              }),
            },
          ];
        }
        if (readCallCount === 4) {
          // Opponent player stats
          return [
            {
              collection: 'player_stats',
              key: 'opponent-user',
              value: JSON.stringify({
                level: 1,
                xp: 0,
                stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
              }),
            },
          ];
        }
        // Inventory calls
        return [];
      });

      mockNk.storageWrite = jest.fn();

      // Force hit
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Should succeed - new match state was created despite corrupted data
      expect(parsed.success).toBe(true);
      expect(parsed.result).toBeDefined();
    });

    it('should handle forfeit when opponent has consecutive timeouts', async () => {
      const match = createMockMatch({ status: 'active' });

      // Opponent is the one who timed out (current_turn_user_id = opponent)
      const timedOutMatchState: MatchState = {
        match_id: 'match-123',
        turn: 3,
        current_turn_user_id: 'opponent-user',
        creator_id: 'creator-user',
        opponent_id: 'opponent-user',
        creator_health: 80,
        opponent_health: 90,
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
        last_turn_timestamp: Date.now() - 31 * 60 * 1000,
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 1, // One more timeout triggers forfeit
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(timedOutMatchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();
      mockNk.notificationSend = jest.fn();

      // Creator submits action, but opponent's turn timed out
      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Creator wins because opponent had consecutive timeouts
      expect(parsed.error).toBe('Match forfeited due to consecutive timeouts');
      expect(parsed.forfeit).toBe(true);
      expect(parsed.winner).toBe('creator-user');
    });

    it('should return error for missing action type', async () => {
      const match = createMockMatch({ status: 'active' });
      const matchState: MatchState = {
        match_id: 'match-123',
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
        turn_timeout_ms: 30 * 60 * 1000,
        consecutive_timeouts: 0,
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(matchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects
          .map((obj: any) => {
            const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
            if (!val) return null;
            return {
              collection: obj.collection,
              key: obj.key,
              value: val,
            };
          })
          .filter(Boolean);
      });

      mockNk.storageWrite = jest.fn();

      // Missing action_type
      const payload = JSON.stringify({
        match_id: 'match-123',
        angle: 1.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });
});
