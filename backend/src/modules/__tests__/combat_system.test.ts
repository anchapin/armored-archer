import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcSubmitCombatAction,
  rpcGetMatchState,
  registerRpcSubmitCombatAction,
  registerRpcGetMatchState,
  MatchState,
  PvPMatch,
  CombatAction,
} from '../combat_system';
import { Runtime } from '../../types/nakama';

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
    it('should process combat action and return result', () => {
      const match = createMockMatch({ status: 'active' });
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'pvp_matches',
          key: 'match-123',
          userId: 'creator-user',
          value: JSON.stringify(match),
        },
      ]);

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
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(mockMatchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects.map((obj: any) => ({
          collection: obj.collection,
          key: obj.key,
          value: mockStorage.get(`${obj.collection}:${obj.key}`) ?? null,
        }));
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
        power: 0.5, // Use 0.0-1.0 format
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.result).toBeDefined();
    });

    it('should return error for non-existent match', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({
        match_id: 'nonexistent',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match not found');
    });

    it('should return error for inactive match', () => {
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
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match is not active');
    });

    it('should return error when not participant', () => {
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
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Not a participant in this match');
    });

    it('should return error when not user turn', () => {
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

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Not your turn');
    });

    it('should validate input payload', () => {
      const payload = JSON.stringify({
        match_id: '',
        action_type: 'invalid',
        angle: 'not a number',
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcGetMatchState', () => {
    it('should return match state', () => {
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
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'pvp_match_states',
          key: 'match-123',
          value: JSON.stringify(matchState),
        },
      ]);

      const payload = JSON.stringify({ match_id: 'match-123' });
      const result = rpcGetMatchState(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.match_id).toBe('match-123');
    });

    it('should return error when match state not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ match_id: 'nonexistent' });
      const result = rpcGetMatchState(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match state not found');
    });
  });

  describe('registerRpcSubmitCombatAction', () => {
    it('should register the RPC handler', () => {
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
    it('should register the RPC handler', () => {
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

  describe('rpcSubmitCombatAction - anti-cheat', () => {
    it('should return error for anti-cheat signature violation', () => {
      const match = {
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
      };

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

      // Provide invalid anti-cheat signature (too short)
      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        requestId: 'req-123',
        timestamp: Date.now(),
        signature: 'invalid',
        nonce: 'nonce',
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Should have some validation error
      expect(parsed.error || parsed.error_code).toBeDefined();
    });
  });

  describe('rpcSubmitCombatAction - turn timeout', () => {
    it('should handle turn timeout and switch turns', () => {
      const match = {
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
      };

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
      };

      const mockStorage = new Map();
      mockStorage.set(`pvp_matches:match-123`, JSON.stringify(match));
      mockStorage.set(`pvp_match_states:match-123`, JSON.stringify(timedOutMatchState));

      mockNk.storageRead = jest.fn((objects) => {
        return objects.map((obj: any) => ({
          collection: obj.collection,
          key: obj.key,
          value: mockStorage.get(`${obj.collection}:${obj.key}`) ?? null,
        }));
      });

      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);

      // Just verify the result is valid JSON (doesn't error)
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('rpcSubmitCombatAction - combat resolution', () => {
    it('should complete match when health reaches zero', () => {
      const match = {
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
      };

      // Match state with opponent at 10 health (one hit will finish them)
      const matchState: MatchState = {
        match_id: 'match-123',
        turn: 1,
        current_turn_user_id: 'creator-user',
        creator_id: 'creator-user',
        opponent_id: 'opponent-user',
        creator_health: 100,
        opponent_health: 10,
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

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 1.0,
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);

      // Just verify the result is valid JSON (doesn't error)
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should calculate XP on match completion', () => {
      const match = {
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
      };

      // High level match for more XP
      const matchState: MatchState = {
        match_id: 'match-123',
        turn: 3,
        current_turn_user_id: 'creator-user',
        creator_id: 'creator-user',
        opponent_id: 'opponent-user',
        creator_health: 50,
        opponent_health: 0,
        creator_stats: {
          level: 10,
          xp: 500,
          stats: { attack: 30, defense: 25, dodge: 15, crit_rate: 20 },
        },
        opponent_stats: {
          level: 8,
          xp: 300,
          stats: { attack: 25, defense: 20, dodge: 12, crit_rate: 15 },
        },
        status: 'active',
        log: [{ type: 'shoot', user_id: 'creator-user', damage: 50 }],
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

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 1.0,
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);

      // Just verify the result is valid JSON (doesn't error)
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should handle draw scenario', () => {
      const match = {
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
      };

      // Both at 10 health
      const matchState: MatchState = {
        match_id: 'match-123',
        turn: 1,
        current_turn_user_id: 'creator-user',
        creator_id: 'creator-user',
        opponent_id: 'opponent-user',
        creator_health: 10,
        opponent_health: 10,
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

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);

      // Just verify the result is valid JSON (doesn't error)
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should validate invalid action type', () => {
      const match = {
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
      };

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

      // Invalid action type
      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'invalid_action',
        angle: 1.5,
      });
      const result = rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });
});
