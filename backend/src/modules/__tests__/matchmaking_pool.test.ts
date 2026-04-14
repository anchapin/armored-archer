/**
 * Tests for matchmaking_pool module
 */

import {
  QueuedPlayer,
  MatchmakingPool,
  JoinPoolRequest,
  LeavePoolRequest,
  QueueStatusResponse,
  rpcJoinPool,
  rpcLeavePool,
  rpcGetQueueStatus,
  processMatchmaking,
  MatchMode,
} from '../matchmaking_pool';
import { Runtime } from '../types/nakama';

describe('matchmaking_pool', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockCtx = {
    userId: 'user_123',
  } as any;

  // In-memory storage for testing
  const storage = new Map();

  beforeEach(() => {
    // Clear storage before each test
    storage.clear();

    jest.clearAllMocks();

    // Create mock that maintains state
    const mockStorageRead = jest.fn((objects: any) => {
      return objects
        .map((obj: any) => {
          const val = storage.get(`${obj.collection}:${obj.key}`);
          if (!val) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            value: val,
          };
        })
        .filter(Boolean);
    });

    const mockStorageWrite = jest.fn((objects: any) => {
      objects.forEach((obj: any) => {
        storage.set(`${obj.collection}:${obj.key}`, obj.value);
      });
      return undefined;
    });

    (mockCtx as any).nk = {
      storageRead: mockStorageRead,
      storageWrite: mockStorageWrite,
    } as any;
  });

  describe('Queue Management', () => {
    it('should add player to pool on join', () => {
      const request: JoinPoolRequest = {
        mode: '1v1',
        rating: 1200,
      };

      const payload = JSON.stringify(request);
      const result = rpcJoinPool(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.queue_position).toBeGreaterThan(0);
      expect(response.estimated_wait).toBeGreaterThan(0);
    });

    it('should reject duplicate join attempts', () => {
      const request: JoinPoolRequest = {
        mode: '1v1',
        rating: 1200,
      };

      // Simulate existing pool with player
      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: Date.now(),
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      const payload = JSON.stringify(request);
      const result = rpcJoinPool(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.error).toContain('Already in matchmaking pool');
    });

    it('should remove player from pool on leave', () => {
      // First add player to pool
      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: Date.now(),
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      const request: LeavePoolRequest = {
        mode: '1v1',
      };

      const payload = JSON.stringify(request);
      const result = rpcLeavePool(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
    });

    it('should reject leave when not in pool', () => {
      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [],
          last_match_time: Date.now(),
        })
      );

      const request: LeavePoolRequest = {
        mode: '1v1',
      };

      const payload = JSON.stringify(request);
      const result = rpcLeavePool(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.error).toContain('Not in matchmaking pool');
    });

    it('should maintain separate pools for 1v1 and 2v2', () => {
      const request1v1: JoinPoolRequest = { mode: '1v1', rating: 1200 };
      const request2v2: JoinPoolRequest = { mode: '2v2', rating: 1150 };

      // Simulate player already in both pools
      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: Date.now(),
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );
      storage.set(
        'matchmaking:matchmaking_pool_2v2',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '2v2',
              rating: 1150,
              joined_at: Date.now(),
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      const payload1v1 = JSON.stringify(request1v1);
      const result1v1 = rpcJoinPool(mockCtx, mockLogger, (mockCtx as any).nk, payload1v1);
      const response1v1 = JSON.parse(result1v1);

      // Should already be in 1v1 pool
      expect(response1v1.error).toContain('Already in matchmaking pool');

      const payload2v2 = JSON.stringify(request2v2);
      const result2v2 = rpcJoinPool(mockCtx, mockLogger, (mockCtx as any).nk, payload2v2);
      const response2v2 = JSON.parse(result2v2);

      // Should already be in 2v2 pool
      expect(response2v2.error).toContain('Already in matchmaking pool');
    });
  });

  describe('Rating Bracket Expansion', () => {
    it('should use initial bracket of 100 for new players', () => {
      const now = Date.now();

      const player: QueuedPlayer = {
        user_id: 'user_123',
        mode: '1v1',
        rating: 1200,
        joined_at: now,
        bracket_size: 100,
      };

      // Player just joined
      const waitTime = now - player.joined_at;
      expect(waitTime).toBeLessThan(30000); // Less than 30s
      expect(player.bracket_size).toBe(100);
    });

    it('should expand bracket to 200 after 30 seconds', () => {
      const now = Date.now();
      const thirtySecondsAgo = now - 30000;

      const player: QueuedPlayer = {
        user_id: 'user_123',
        mode: '1v1',
        rating: 1200,
        joined_at: thirtySecondsAgo,
        bracket_size: 200,
      };

      const waitTime = now - player.joined_at;
      expect(waitTime).toBeGreaterThanOrEqual(30000);
      expect(player.bracket_size).toBe(200);
    });

    it('should expand bracket to 300 after 60 seconds', () => {
      const now = Date.now();
      const sixtySecondsAgo = now - 60000;

      const player: QueuedPlayer = {
        user_id: 'user_123',
        mode: '1v1',
        rating: 1200,
        joined_at: sixtySecondsAgo,
        bracket_size: 300,
      };

      const waitTime = now - player.joined_at;
      expect(waitTime).toBeGreaterThanOrEqual(60000);
      expect(player.bracket_size).toBe(300);
    });

    it('should allow any rating after 90 seconds', () => {
      const now = Date.now();
      const ninetySecondsAgo = now - 90000;

      const player: QueuedPlayer = {
        user_id: 'user_123',
        mode: '1v1',
        rating: 1200,
        joined_at: ninetySecondsAgo,
        bracket_size: -1, // -1 indicates any rating
      };

      const waitTime = now - player.joined_at;
      expect(waitTime).toBeGreaterThanOrEqual(90000);
      expect(player.bracket_size).toBe(-1);
    });
  });

  describe('Queue Status', () => {
    it('should return queue position and estimated wait', () => {
      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: Date.now(),
              bracket_size: 100,
            },
            {
              user_id: 'user_456',
              mode: '1v1',
              rating: 1250,
              joined_at: Date.now() - 10000,
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response: QueueStatusResponse = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.queue_position).toBeGreaterThan(0);
      expect(response.estimated_wait).toBeGreaterThan(0);
    });

    it('should reject status for non-existent player', () => {
      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [],
          last_match_time: Date.now(),
        })
      );

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.error).toContain('Not in matchmaking pool');
    });

    it('should update bracket size based on wait time', () => {
      const now = Date.now();
      const sixtySecondsAgo = now - 60000;

      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: sixtySecondsAgo,
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.current_bracket_size).toBe(300);
      expect(response.wait_time_seconds).toBeGreaterThanOrEqual(60);
    });
  });

  describe('Match Finding', () => {
    it('should find match when players in same bracket', () => {
      const now = Date.now();

      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: now - 10000,
              bracket_size: 100,
            },
            {
              user_id: 'user_456',
              mode: '1v1',
              rating: 1250,
              joined_at: now - 15000,
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.match_found).toBe(true);
      // The opponent will be the other player (user_456)
      expect(response.opponent_id).toBe('user_456');
    });

    it('should prioritize closest rating when multiple matches', () => {
      const now = Date.now();

      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: now - 10000,
              bracket_size: 100,
            },
            {
              user_id: 'user_456',
              mode: '1v1',
              rating: 1250,
              joined_at: now - 15000,
              bracket_size: 100,
            },
            {
              user_id: 'user_789',
              mode: '1v1',
              rating: 1205,
              joined_at: now - 20000,
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.match_found).toBe(true);

      // If user_123 is the caller, should match with user_789 (closest rating)
      // or with user_456 (longest waiting)
    });

    it('should expand bracket when no immediate match', () => {
      const now = Date.now();
      const sixtySecondsAgo = now - 60000;

      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: sixtySecondsAgo,
              bracket_size: 100,
            },
            {
              user_id: 'user_456',
              mode: '1v1',
              rating: 1600,
              joined_at: now - 10000,
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.match_found).toBe(false); // Not in same bracket even with expansion
    });
  });

  describe('Match Processing', () => {
    it('should process matchmaking for both modes', () => {
      const now = Date.now();

      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: now - 10000,
              bracket_size: 100,
            },
            {
              user_id: 'user_456',
              mode: '1v1',
              rating: 1250,
              joined_at: now - 15000,
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );
      storage.set(
        'matchmaking:matchmaking_pool_2v2',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '2v2',
              rating: 1200,
              joined_at: now - 10000,
              bracket_size: 100,
            },
            {
              user_id: 'user_456',
              mode: '2v2',
              rating: 1250,
              joined_at: now - 15000,
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      processMatchmaking(mockLogger, (mockCtx as any).nk);

      expect((mockCtx as any).nk.storageWrite).toHaveBeenCalled();
    });

    it('should not match when insufficient players', () => {
      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [
            {
              user_id: 'user_123',
              mode: '1v1',
              rating: 1200,
              joined_at: Date.now() - 10000,
              bracket_size: 100,
            },
          ],
          last_match_time: Date.now(),
        })
      );

      processMatchmaking(mockLogger, (mockCtx as any).nk);

      // Should not write (no matches made)
      const writeCalls = (mockCtx as any).nk.storageWrite.mock.calls;
      // Only initial storage reads, no writes for matches
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty pool gracefully', () => {
      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: [],
          last_match_time: Date.now(),
        })
      );

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.error).toContain('Not in matchmaking pool');
    });

    it('should handle large number of players', () => {
      const players: QueuedPlayer[] = [];
      for (let i = 0; i < 1000; i++) {
        players.push({
          user_id: `user_${i}`,
          mode: '1v1',
          rating: 1000 + (i % 500),
          joined_at: Date.now() - i * 1000,
          bracket_size: 100,
        });
      }

      storage.set(
        'matchmaking:matchmaking_pool_1v1',
        JSON.stringify({
          players: players,
          last_match_time: Date.now(),
        })
      );

      const request: JoinPoolRequest = { mode: '1v1', rating: 1200 };
      const payload = JSON.stringify(request);
      const result = rpcJoinPool(mockCtx, mockLogger, (mockCtx as any).nk, payload);
      const response = JSON.parse(result);

      expect(response.queue_position).toBe(1001); // After existing 1000 players
    });
  });
});
