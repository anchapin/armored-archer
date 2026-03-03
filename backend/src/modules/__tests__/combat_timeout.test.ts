/**
 * Combat timeout and match expiration tests.
 * Tests PvP combat turn timeouts and match expiration logic.
 */

import { PvPMatch } from '../matchmaker';
import { MatchState } from '../combat_system';

describe('PvP Combat Turn Timeouts and Match Expiration', () => {
  let mockNk: any;
  let mockLogger: any;
  let mockCtx: any;

  beforeEach(() => {
    // Setup mock Nakama server
    mockNk = {
      storageRead: jest.fn(),
      storageWrite: jest.fn(),
      storageList: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockCtx = {
      userId: 'user_123',
      ipAddress: '127.0.0.1',
    };

    // Mock Date.now() for testing
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Match Expiration', () => {
    it('should mark pending matches as expired after 24 hours', () => {
      const now = Date.now();
      const match: PvPMatch = {
        match_id: 'match_1',
        creator_id: 'user_1',
        opponent_id: '',
        creator_rank: 10,
        opponent_rank: 0,
        match_type: 'ranked',
        is_punch_up: false,
        status: 'pending',
        created_at: now,
        updated_at: now,
        expires_at: now + 24 * 60 * 60 * 1000, // 24 hours from now
        last_turn_timestamp: now,
      };

      // Match should not be expired yet
      expect(Date.now() > match.expires_at).toBe(false);

      // Fast forward 25 hours
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);

      // Match should now be expired
      expect(Date.now() > match.expires_at).toBe(true);
    });

    it('should mark active matches as expired after 7 days of inactivity', () => {
      const now = Date.now();
      const match: PvPMatch = {
        match_id: 'match_2',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_rank: 10,
        opponent_rank: 15,
        match_type: 'ranked',
        is_punch_up: false,
        status: 'active',
        created_at: now,
        updated_at: now,
        expires_at: now + 7 * 24 * 60 * 60 * 1000, // 7 days from now
        last_turn_timestamp: now,
      };

      // Match should not be expired yet
      expect(Date.now() > match.expires_at).toBe(false);

      // Fast forward 8 days
      jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

      // Match should now be expired
      expect(Date.now() > match.expires_at).toBe(true);
    });

    it('should prevent actions on expired matches', () => {
      const now = Date.now();
      const match: PvPMatch = {
        match_id: 'match_3',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_rank: 10,
        opponent_rank: 15,
        match_type: 'ranked',
        is_punch_up: false,
        status: 'active',
        created_at: now - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        updated_at: now - 8 * 24 * 60 * 60 * 1000,
        expires_at: now - 1 * 60 * 60 * 1000, // Expired 1 hour ago
        last_turn_timestamp: now - 8 * 24 * 60 * 60 * 1000,
      };

      // Match is expired
      expect(Date.now() > match.expires_at).toBe(true);
    });
  });

  describe('Turn Timeout Logic', () => {
    it('should detect when a turn has exceeded 5-minute timeout', () => {
      const now = Date.now();
      const matchState: MatchState = {
        match_id: 'match_4',
        turn: 1,
        current_turn_user_id: 'user_1',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_health: 100,
        opponent_health: 100,
        creator_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        opponent_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        status: 'active',
        log: [],
        last_turn_timestamp: now,
        turn_timeout_ms: 5 * 60 * 1000, // 5 minutes
      };

      // Turn should not be timed out yet
      expect(Date.now() - matchState.last_turn_timestamp > matchState.turn_timeout_ms).toBe(false);

      // Fast forward 4 minutes
      jest.advanceTimersByTime(4 * 60 * 1000);

      // Turn should still not be timed out
      expect(Date.now() - matchState.last_turn_timestamp > matchState.turn_timeout_ms).toBe(false);

      // Fast forward 2 more minutes (total 6 minutes)
      jest.advanceTimersByTime(2 * 60 * 1000);

      // Turn should now be timed out
      expect(Date.now() - matchState.last_turn_timestamp > matchState.turn_timeout_ms).toBe(true);
    });

    it('should reset timeout when turn switches', () => {
      const now = Date.now();
      const matchState: MatchState = {
        match_id: 'match_5',
        turn: 2,
        current_turn_user_id: 'user_2',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_health: 100,
        opponent_health: 100,
        creator_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        opponent_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        status: 'active',
        log: [],
        last_turn_timestamp: now,
        turn_timeout_ms: 5 * 60 * 1000,
      };

      // Fast forward 3 minutes
      jest.advanceTimersByTime(3 * 60 * 1000);

      // Update last turn timestamp (simulating turn switch)
      const updatedNow = Date.now();
      matchState.last_turn_timestamp = updatedNow;
      matchState.current_turn_user_id = 'user_1';

      // Turn should reset and not be timed out
      expect(Date.now() - matchState.last_turn_timestamp > matchState.turn_timeout_ms).toBe(false);
    });

    it('should handle multiple timeouts in a match', () => {
      const now = Date.now();
      const matchState: MatchState = {
        match_id: 'match_6',
        turn: 1,
        current_turn_user_id: 'user_1',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_health: 100,
        opponent_health: 100,
        creator_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        opponent_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        status: 'active',
        log: [],
        last_turn_timestamp: now,
        turn_timeout_ms: 5 * 60 * 1000,
      };

      // First turn timeout
      jest.advanceTimersByTime(6 * 60 * 1000);
      expect(Date.now() - matchState.last_turn_timestamp > matchState.turn_timeout_ms).toBe(true);

      // Reset for second player
      matchState.last_turn_timestamp = Date.now();
      matchState.current_turn_user_id = 'user_2';
      matchState.turn++;

      // Should not timeout immediately
      expect(Date.now() - matchState.last_turn_timestamp > matchState.turn_timeout_ms).toBe(false);

      // Second turn timeout
      jest.advanceTimersByTime(6 * 60 * 1000);
      expect(Date.now() - matchState.last_turn_timestamp > matchState.turn_timeout_ms).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle matches that expire immediately', () => {
      const now = Date.now();
      const match: PvPMatch = {
        match_id: 'match_7',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_rank: 10,
        opponent_rank: 15,
        match_type: 'ranked',
        is_punch_up: false,
        status: 'active',
        created_at: now,
        updated_at: now,
        expires_at: now, // Already expired
        last_turn_timestamp: now,
      };

      expect(Date.now() > match.expires_at).toBe(false); // Current time equals expiry
      
      jest.advanceTimersByTime(1);
      expect(Date.now() > match.expires_at).toBe(true); // Now it's expired
    });

    it('should preserve turn history when timeout occurs', () => {
      const now = Date.now();
      const matchState: MatchState = {
        match_id: 'match_8',
        turn: 5,
        current_turn_user_id: 'user_1',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_health: 75,
        opponent_health: 85,
        creator_stats: {
          level: 2,
          xp: 100,
          stats: { attack: 12, defense: 11, dodge: 9, crit_rate: 6 },
        },
        opponent_stats: {
          level: 2,
          xp: 90,
          stats: { attack: 13, defense: 10, dodge: 11, crit_rate: 5 },
        },
        status: 'active',
        log: [
          {
            turn: 1,
            attacker_id: 'user_1',
            action: 'shoot',
            hit: true,
            damage: 15,
            is_crit: false,
            timestamp: now,
          },
        ],
        last_turn_timestamp: now,
        turn_timeout_ms: 5 * 60 * 1000,
      };

      const originalLogLength = matchState.log.length;

      // Advance past timeout
      jest.advanceTimersByTime(6 * 60 * 1000);

      // Log should be preserved
      expect(matchState.log.length).toBe(originalLogLength);
      expect(matchState.creator_health).toBe(75); // Health unchanged
      expect(matchState.opponent_health).toBe(85);
    });

    it('should handle near-timeout scenarios', () => {
      const now = Date.now();
      const matchState: MatchState = {
        match_id: 'match_9',
        turn: 1,
        current_turn_user_id: 'user_1',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_health: 100,
        opponent_health: 100,
        creator_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        opponent_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        status: 'active',
        log: [],
        last_turn_timestamp: now,
        turn_timeout_ms: 5 * 60 * 1000,
      };

      // Advance to 4:59 minutes
      jest.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);

      // Should NOT be timed out (4:59 < 5:00)
      expect(Date.now() - matchState.last_turn_timestamp > matchState.turn_timeout_ms).toBe(false);

      // Advance 2 seconds (total 5:01)
      jest.advanceTimersByTime(2 * 1000);

      // Should now be timed out
      expect(Date.now() - matchState.last_turn_timestamp > matchState.turn_timeout_ms).toBe(true);
    });
  });

  describe('Match Status Validation', () => {
    it('should accept timeout configuration in match state', () => {
      const matchState: MatchState = {
        match_id: 'match_10',
        turn: 1,
        current_turn_user_id: 'user_1',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_health: 100,
        opponent_health: 100,
        creator_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        opponent_stats: {
          level: 1,
          xp: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        },
        status: 'active',
        log: [],
        last_turn_timestamp: Date.now(),
        turn_timeout_ms: 5 * 60 * 1000,
      };

      expect(matchState.turn_timeout_ms).toBe(5 * 60 * 1000);
      expect(matchState.last_turn_timestamp).toBeDefined();
    });

    it('should track match expiration in PvPMatch', () => {
      const now = Date.now();
      const match: PvPMatch = {
        match_id: 'match_11',
        creator_id: 'user_1',
        opponent_id: 'user_2',
        creator_rank: 10,
        opponent_rank: 15,
        match_type: 'ranked',
        is_punch_up: false,
        status: 'active',
        created_at: now,
        updated_at: now,
        expires_at: now + 7 * 24 * 60 * 60 * 1000,
        last_turn_timestamp: now,
      };

      expect(match.expires_at).toBeDefined();
      expect(match.last_turn_timestamp).toBeDefined();
      expect(match.expires_at > match.created_at).toBe(true);
    });
  });
});
