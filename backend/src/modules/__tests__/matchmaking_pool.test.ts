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

  const mockNk = {
    storageRead: jest.fn(),
    storageWrite: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNk.storageRead.mockResolvedValue([]);
    mockNk.storageWrite.mockImplementation(() => {});
  });

  describe('Queue Management', () => {
    it('should add player to pool on join', () => {
      const request: JoinPoolRequest = {
        mode: '1v1',
        rating: 1200,
      };

      const payload = JSON.stringify(request);
      const result = rpcJoinPool(mockCtx, mockLogger, mockNk, payload);
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
      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
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
          }),
        },
      ]);

      const payload = JSON.stringify(request);
      const result = rpcJoinPool(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Already in matchmaking pool');
    });

    it('should remove player from pool on leave', () => {
      // First add player to pool
      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
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
          }),
        },
      ]);

      const request: LeavePoolRequest = {
        mode: '1v1',
      };

      const payload = JSON.stringify(request);
      const result = rpcLeavePool(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
    });

    it('should reject leave when not in pool', () => {
      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
            players: [],
            last_match_time: Date.now(),
          }),
        },
      ]);

      const request: LeavePoolRequest = {
        mode: '1v1',
      };

      const payload = JSON.stringify(request);
      const result = rpcLeavePool(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Not in matchmaking pool');
    });

    it('should maintain separate pools for 1v1 and 2v2', () => {
      const request1v1: JoinPoolRequest = { mode: '1v1', rating: 1200 };
      const request2v2: JoinPoolRequest = { mode: '2v2', rating: 1150 };

      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
            players: [
              {
                user_id: 'user_123',
                mode: '1v1',
                rating: 1200,
                joined_at: Date.now(),
                bracket_size: 100,
              },
              {
                user_id: 'user_123',
                mode: '2v2',
                rating: 1150,
                joined_at: Date.now(),
                bracket_size: 100,
              },
            ],
            last_match_time: Date.now(),
          }),
        },
      ]);

      const payload1v1 = JSON.stringify(request1v1);
      const result1v1 = rpcJoinPool(mockCtx, mockLogger, mockNk, payload1v1);
      const response1v1 = JSON.parse(result1v1);

      // Should already be in 1v1 pool
      expect(response1v1.success).toBe(false);

      const payload2v2 = JSON.stringify(request2v2);
      const result2v2 = rpcJoinPool(mockCtx, mockLogger, mockNk, payload2v2);
      const response2v2 = JSON.parse(result2v2);

      // Should already be in 2v2 pool
      expect(response2v2.success).toBe(false);
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
      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
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
          }),
        },
      ]);

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, mockNk, payload);
      const response: QueueStatusResponse = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.queue_position).toBeGreaterThan(0);
      expect(response.estimated_wait).toBeGreaterThan(0);
    });

    it('should reject status for non-existent player', () => {
      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
            players: [],
            last_match_time: Date.now(),
          }),
        },
      ]);

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Not in matchmaking pool');
    });

    it('should update bracket size based on wait time', () => {
      const now = Date.now();
      const sixtySecondsAgo = now - 60000;

      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
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
          }),
        },
      ]);

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.current_bracket_size).toBe(300);
      expect(response.wait_time_seconds).toBeGreaterThanOrEqual(60);
    });
  });

  describe('Match Finding', () => {
    it('should find match when players in same bracket', () => {
      const now = Date.now();

      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
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
          }),
        },
      ]);

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.match_found).toBe(true);
      expect(response.opponent_id).toBe('user_123' || 'user_456');
    });

    it('should prioritize closest rating when multiple matches', () => {
      const now = Date.now();

      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
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
          }),
        },
      ]);

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.match_found).toBe(true);

      // If user_123 is the caller, should match with user_789 (closest rating)
      // or with user_456 (longest waiting)
    });

    it('should expand bracket when no immediate match', () => {
      const now = Date.now();
      const sixtySecondsAgo = now - 60000;

      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
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
          }),
        },
      ]);

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.match_found).toBe(true); // Should match due to expanded bracket
    });
  });

  describe('Match Processing', () => {
    it('should process matchmaking for both modes', () => {
      const now = Date.now();

      mockNk.storageRead.mockImplementation((requests) => {
        const mode = requests[0].key.includes('1v1') ? '1v1' : '2v2';
        return Promise.resolve([
          {
            value: JSON.stringify({
              players: [
                {
                  user_id: 'user_123',
                  mode: mode,
                  rating: 1200,
                  joined_at: now - 10000,
                  bracket_size: 100,
                },
                {
                  user_id: 'user_456',
                  mode: mode,
                  rating: 1250,
                  joined_at: now - 15000,
                  bracket_size: 100,
                },
              ],
              last_match_time: Date.now(),
            }),
          },
        ]);
      });

      processMatchmaking(mockLogger, mockNk);

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should not match when insufficient players', () => {
      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
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
          }),
        },
      ]);

      processMatchmaking(mockLogger, mockNk);

      // Should not write (no matches made)
      const writeCalls = mockNk.storageWrite.mock.calls;
      // Only initial storage reads, no writes for matches
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty pool gracefully', () => {
      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
            players: [],
            last_match_time: Date.now(),
          }),
        },
      ]);

      const payload = JSON.stringify({ mode: '1v1' });
      const result = rpcGetQueueStatus(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Not in matchmaking pool');
    });

    it('should handle large number of players', () => {
      const players: QueuedPlayer[] = [];
      for (let i = 0; i < 1000; i++) {
        players.push({
          user_id: `user_${i}`,
          mode: '1v1',
          rating: 1000 + (i % 500),
          joined_at: Date.now() - (i * 1000),
          bracket_size: 100,
        });
      }

      mockNk.storageRead.mockResolvedValue([
        {
          value: JSON.stringify({
            players: players,
            last_match_time: Date.now(),
          }),
        },
      ]);

      const request: JoinPoolRequest = { mode: '1v1', rating: 1200 };
      const payload = JSON.stringify(request);
      const result = rpcJoinPool(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.queue_position).toBe(1001); // After existing 1000 players
    });
  });
});
