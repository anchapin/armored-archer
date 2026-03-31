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
        return objects.map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        }).filter(Boolean);
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
        return objects.map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        }).filter(Boolean);
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
        return objects.map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        }).filter(Boolean);
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
        return objects.map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        }).filter(Boolean);
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
        return objects.map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        }).filter(Boolean);
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
        return objects.map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        }).filter(Boolean);
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
        return [{ collection: 'pvp_match_states', key: 'match-123', value: JSON.stringify(matchState) }];
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
        return objects.map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        }).filter(Boolean);
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
        return objects.map((obj) => {
          if (obj.collection === 'pvp_matches' && obj.key === 'match-123') {
            return {
              collection: 'pvp_matches',
              key: 'match-123',
              value: JSON.stringify(match),
            };
          }
          return null;
        }).filter(Boolean);
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

  describe('combat_system helpers and edge cases', () => {
    it('should create initial match state if it does not exist', async () => {
      const match = createMockMatch({ status: 'active' });

      // Mock storageRead: first call (match) returns match, second call (match state) returns empty
      mockNk.storageRead = jest.fn()
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
            value: JSON.stringify({ level: 1, stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 } }),
          },
        ])
        .mockReturnValueOnce([
          {
            collection: 'player_stats',
            key: 'opponent-user',
            value: JSON.stringify({ level: 1, stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 } }),
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
        expires_at: Date.now() - 1000 // Expired 1 second ago
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
        return objects.map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        }).filter(Boolean);
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
        return objects.map((obj: any) => {
          const val = mockStorage.get(`${obj.collection}:${obj.key}`) || mockStorage.get(obj.key);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        }).filter(Boolean);
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
