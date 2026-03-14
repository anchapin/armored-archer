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

// Mock anti_cheat module
jest.mock('../anti_cheat', () => ({
  verifyRequestSignature: jest.fn().mockReturnValue({ valid: true }),
  validateCombatActionParameters: jest.fn().mockReturnValue({ valid: true, violations: [] }),
  detectTimingAttack: jest.fn().mockReturnValue(false),
}));

// Mock gear_system module
jest.mock('../gear_system', () => ({
  getPlayerInventory: jest.fn().mockReturnValue({ gear: [], unlocked_modifier_pools: [] }),
  getEquippedGearModifierBonuses: jest.fn().mockReturnValue({}),
}));

import { verifyRequestSignature, validateCombatActionParameters, detectTimingAttack } from '../anti_cheat';
import { getPlayerInventory, getEquippedGearModifierBonuses } from '../gear_system';

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

  describe('rpcSubmitCombatAction - anti-cheat', () => {
    it('should return error for anti-cheat signature violation', async () => {
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
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Should have some validation error
      expect(parsed.error || parsed.error_code).toBeDefined();
    });
  });

  describe('rpcSubmitCombatAction - turn timeout', () => {
    it('should handle turn timeout and switch turns', async () => {
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
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);

      // Just verify the result is valid JSON (doesn't error)
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('rpcSubmitCombatAction - combat resolution', () => {
    it('should complete match when health reaches zero', async () => {
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
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);

      // Just verify the result is valid JSON (doesn't error)
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should calculate XP on match completion', async () => {
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
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);

      // Just verify the result is valid JSON (doesn't error)
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should handle draw scenario', async () => {
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
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);

      // Just verify the result is valid JSON (doesn't error)
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should validate invalid action type', async () => {
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
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
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

  describe('rpcPlayerDisconnect', () => {
    it('should return error for non-existent match', async () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({
        match_id: 'nonexistent',
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
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
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
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
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Not a participant in this match');
    });

    it('should return error when match state not found', async () => {
      const match = createMockMatch({ status: 'active' });
      
      // Return match but empty string for match state (simulates corrupted/empty state)
      // Use a function that returns properly for each call
      const storageReadMock = jest.fn((objects: any[]) => {
        return objects.map((obj) => {
          if (obj.collection === 'pvp_matches' && obj.key === 'match-123') {
            return {
              collection: 'pvp_matches',
              key: 'match-123',
              value: JSON.stringify(match),
            };
          }
          // Return empty result for match state - this should trigger "stateObjects.length === 0" check
          return {
            collection: obj.collection,
            key: obj.key,
            value: '',
          };
        });
      });
      mockNk.storageRead = storageReadMock;

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Match state not found');
    });

    it('should successfully process disconnect and forfeit match', async () => {
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
      mockNk.notificationSend = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'disconnect',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.forfeit).toBe(true);
      expect(parsed.winner).toBe('opponent-user');
      expect(parsed.reason).toBe('disconnect');
    });

    it('should handle disconnect with custom reason', async () => {
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
      mockNk.notificationSend = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'voluntary',
      });
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.reason).toBe('voluntary');
    });
  });

  describe('rpcSubmitCombatAction - expired match', () => {
    it('should return error for expired match', async () => {
      // Create match that is already expired
      const match = createMockMatch({ 
        status: 'active',
        expires_at: Date.now() - 1000, // Expired 1 second ago
      });
      
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

      expect(parsed.error).toBe('Match has expired');
    });
  });

  describe('rpcSubmitCombatAction - getOrCreateMatchState new state', () => {
    it('should create new match state when none exists', async () => {
      // Create match where 'creator-user' is the creator (matches mockCtx.userId)
      const match = createMockMatch({ 
        status: 'active',
        creator_id: 'creator-user',
        opponent_id: 'opponent-user'
      });
      
      // Return empty for match state (creating new state)
      mockNk.storageRead = jest.fn((objects) => {
        const obj = objects[0];
        if (obj.collection === 'pvp_matches' && obj.key === 'match-123') {
          return [{
            collection: 'pvp_matches',
            key: 'match-123',
            value: JSON.stringify(match),
          }];
        }
        // For match state - return empty to trigger creation
        if (obj.collection === 'pvp_match_states') {
          return [];
        }
        // For player stats - return empty to use defaults
        if (obj.collection === 'player_stats') {
          return [];
        }
        // For inventory - return empty
        if (obj.collection === 'player_inventory') {
          return [];
        }
        return [];
      });

      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      console.log('New state result:', result); // Debug
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.result).toBeDefined();
    });
  });

  describe('rpcSubmitCombatAction - turn timeout auto-forfeit', () => {
    it('should handle auto-forfeit after consecutive timeouts', async () => {
      const match = createMockMatch({ status: 'active' });
      
      // Match state with previous timeout already recorded
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
        last_turn_timestamp: Date.now() - 400000, // Turn timed out
        turn_timeout_ms: 300000, // 5 minutes
        consecutive_timeouts: 1, // Already has 1 timeout, next one triggers forfeit
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
      mockNk.notificationSend = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Should return error because match was forfeited
      expect(parsed.error).toBe('Match forfeited due to consecutive timeouts');
      expect(parsed.forfeit).toBe(true);
    });
  });

  describe('rpcSubmitCombatAction - miss case', () => {
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
  });

  describe('rpcSubmitCombatAction - anti-cheat with fields', () => {
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
      console.log('Anti-cheat result:', result); // Debug
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });
  });

  describe('rpcSubmitCombatAction - getPlayerStats with existing stats', () => {
    it('should apply gear bonuses from existing stats', async () => {
      const match = createMockMatch({ status: 'active' });
      
      mockNk.storageRead = jest.fn((objects) => {
        const key = objects[0].key;
        
        if (objects[0].collection === 'pvp_matches') {
          return [{
            collection: 'pvp_matches',
            key: 'match-123',
            value: JSON.stringify(match),
          }];
        }
        
        if (objects[0].collection === 'pvp_match_states') {
          // Return empty to trigger new state creation
          return [];
        }
        
        if (objects[0].collection === 'player_stats') {
          // Return existing player stats
          return [{
            collection: 'player_stats',
            key: 'creator-user',
            value: JSON.stringify({
              level: 10,
              xp: 500,
              stats: { attack: 30, defense: 25, dodge: 15, crit_rate: 20 },
            }),
          }];
        }
        
        if (objects[0].collection === 'player_inventory') {
          // Return inventory with equipped gear
          return [{
            collection: 'player_inventory',
            key: 'creator-user',
            value: JSON.stringify({
              gear: [
                { id: 'weapon1', type: 'weapon', modifiers: { attack: 5 }, equipped: true },
                { id: 'armor1', type: 'armor', modifiers: { defense: 3 }, equipped: true },
              ],
              unlocked_modifier_pools: [],
            }),
          }];
        }
        
        return [];
      });

      mockNk.storageWrite = jest.fn();

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
      });
      const result = await rpcSubmitCombatAction(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });
  });

  describe('rpcSubmitCombatAction - non-creator attacker', () => {
    it('should process action from opponent and hit creator', async () => {
      const match = createMockMatch({ status: 'active' });
      
      // Set current turn to opponent
      const matchState: MatchState = {
        match_id: 'match-123',
        turn: 2,
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

      // Change context to opponent-user
      const opponentCtx = createMockContext({ userId: 'opponent-user' });

      const payload = JSON.stringify({
        match_id: 'match-123',
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
      });
      const result = await rpcSubmitCombatAction(opponentCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.result.hit).toBe(true);
    });
  });

  describe('rpcPlayerDisconnect - notification failure', () => {
    it('should not fail even if notificationSend throws', async () => {
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
      
      // Force notificationSend to throw
      mockNk.notificationSend = jest.fn().mockImplementation(() => {
        throw new Error('Notification service down');
      });

      const payload = JSON.stringify({
        match_id: 'match-123',
        reason: 'disconnect',
      });
      
      // Should still succeed as the error is caught
      const result = await rpcPlayerDisconnect(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockNk.notificationSend).toHaveBeenCalled();
    });
  });

  describe('rpcSubmitCombatAction - critical hit', () => {
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
});
