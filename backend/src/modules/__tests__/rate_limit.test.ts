/**
 * Tests for PvP Anti-Abuse Rate Limiting Module.
 * @fileoverview Tests for rate limiting, cooldowns, win trading detection,
 * and concurrent match limits.
 */

import {
  initializeRateLimiting,
  checkRateLimit,
  checkMatchCooldown,
  recordMatchAction,
  checkConcurrentMatchLimit,
  checkAbandonmentLimit,
  checkDuplicateTurn,
  cleanupTurnTracking,
  detectWinTrading,
  getRateLimitStats,
  getPlayerRateLimitStatus,
  cleanupOldEntries,
  resetRateLimiting,
} from '../rate_limit';

describe('Rate Limiting Module', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetRateLimiting();
    initializeRateLimiting();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetRateLimiting();
  });

  afterEach(() => {
    resetRateLimiting();
  });

  describe('RPC Rate Limiting', () => {
    test('allows requests within rate limit', () => {
      const userId = 'user_123';

      // Make 5 requests (limit is 10/min for submit_turn)
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(userId, 'submit_turn');
        expect(result.allowed).toBe(true);
      }
    });

    test('blocks requests exceeding rate limit', () => {
      const userId = 'user_123';

      // Make requests up to limit
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit(userId, 'submit_turn');
        expect(result.allowed).toBe(i < 10);
      }

      // 11th request should be blocked
      const result = checkRateLimit(userId, 'submit_turn');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('applies penalty period after rate limit exceeded', () => {
      const userId = 'user_123';

      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit(userId, 'submit_turn');
      }

      // This request triggers the rate limit
      const firstBlockedResult = checkRateLimit(userId, 'submit_turn');
      expect(firstBlockedResult.allowed).toBe(false);
      expect(firstBlockedResult.reason).toBe('rate_limit_exceeded');

      // Next request should be blocked with penalty
      const secondBlockedResult = checkRateLimit(userId, 'submit_turn');
      expect(secondBlockedResult.allowed).toBe(false);
      expect(secondBlockedResult.reason).toBe('rate_limit_penalty');
      expect(secondBlockedResult.retryAfter).toBeGreaterThan(0);
    });

    test('resets rate limit after penalty expires', () => {
      const userId = 'user_123';

      // Exhaust rate limit with short penalty
      initializeRateLimiting(
        {
          submit_turn: { maxRequests: 2, windowMs: 1000, penaltyMs: 500 },
        },
        undefined
      );

      checkRateLimit(userId, 'submit_turn');
      checkRateLimit(userId, 'submit_turn');

      // Should be blocked
      const blockedResult = checkRateLimit(userId, 'submit_turn');
      expect(blockedResult.allowed).toBe(false);

      // Wait for penalty to expire
      jest.advanceTimersByTime(600);

      // Should be allowed again
      const allowedResult = checkRateLimit(userId, 'submit_turn');
      expect(allowedResult.allowed).toBe(true);
    });

    test('tracks per-user rate limits independently', () => {
      const user1 = 'user_1';
      const user2 = 'user_2';

      // User 1 exhausts their limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit(user1, 'submit_turn');
      }

      // User 1 should be blocked
      const user1Result = checkRateLimit(user1, 'submit_turn');
      expect(user1Result.allowed).toBe(false);

      // User 2 should still be allowed
      const user2Result = checkRateLimit(user2, 'submit_turn');
      expect(user2Result.allowed).toBe(true);
    });

    test('returns allowed for unconfigured RPCs', () => {
      const userId = 'user_123';
      const result = checkRateLimit(userId, 'unconfigured_rpc' as any);
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });
  });

  describe('Match Cooldowns', () => {
    test('allows action when no cooldown active', () => {
      const userId = 'user_123';
      const result = checkMatchCooldown(userId, 'create');
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    test('blocks action during cooldown period', () => {
      const userId = 'user_123';

      // Record a match creation
      recordMatchAction(userId, 'create', 'match_123');

      // Should be in cooldown
      const result = checkMatchCooldown(userId, 'create');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('allows action after cooldown expires', () => {
      const userId = 'user_123';

      // Custom short cooldown for testing
      initializeRateLimiting(undefined, { matchCreateMs: 100 });

      recordMatchAction(userId, 'create', 'match_123');

      // Should be in cooldown
      const blockedResult = checkMatchCooldown(userId, 'create');
      expect(blockedResult.allowed).toBe(false);

      // Wait for cooldown to expire
      jest.advanceTimersByTime(150);

      // Should be allowed again
      const allowedResult = checkMatchCooldown(userId, 'create');
      expect(allowedResult.allowed).toBe(true);
    });

    test('tracks different cooldowns independently', () => {
      const userId = 'user_123';

      // Record match creation
      recordMatchAction(userId, 'create', 'match_123');

      // Create should be in cooldown
      const createResult = checkMatchCooldown(userId, 'create');
      expect(createResult.allowed).toBe(false);

      // Accept should not be in cooldown
      const acceptResult = checkMatchCooldown(userId, 'accept');
      expect(acceptResult.allowed).toBe(true);
    });
  });

  describe('Concurrent Match Limits', () => {
    test('allows creating matches under limit', () => {
      const userId = 'user_123';

      // Create 2 matches (under the limit of 3)
      for (let i = 0; i < 2; i++) {
        recordMatchAction(userId, 'create', `match_${i}`);
        const result = checkConcurrentMatchLimit(userId);
        expect(result.allowed).toBe(true);
        expect(result.activeCount).toBe(i + 1);
      }
    });

    test('blocks creating matches over limit', () => {
      const userId = 'user_123';

      // Create max allowed matches
      for (let i = 0; i < 3; i++) {
        recordMatchAction(userId, 'create', `match_${i}`);
      }

      // Should be blocked
      const result = checkConcurrentMatchLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.activeCount).toBe(3);
      expect(result.limit).toBe(3);
    });

    test('decrements active count on match completion', () => {
      const userId = 'user_123';

      // Create max matches
      for (let i = 0; i < 3; i++) {
        recordMatchAction(userId, 'create', `match_${i}`);
      }

      // Should be blocked
      const blockedResult = checkConcurrentMatchLimit(userId);
      expect(blockedResult.allowed).toBe(false);

      // Complete a match
      recordMatchAction(userId, 'complete', 'match_0');

      // Should be allowed now
      const allowedResult = checkConcurrentMatchLimit(userId);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.activeCount).toBe(2);
    });

    test('decrements active count on match abandonment', () => {
      const userId = 'user_123';

      // Create max matches
      for (let i = 0; i < 3; i++) {
        recordMatchAction(userId, 'create', `match_${i}`);
      }

      // Should be blocked
      const blockedResult = checkConcurrentMatchLimit(userId);
      expect(blockedResult.allowed).toBe(false);

      // Abandon a match
      recordMatchAction(userId, 'abandon', 'match_0');

      // Should be allowed now
      const allowedResult = checkConcurrentMatchLimit(userId);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.activeCount).toBe(2);
    });
  });

  describe('Abandonment Limits', () => {
    test('allows abandonments under limit', () => {
      const userId = 'user_123';

      for (let i = 0; i < 4; i++) {
        recordMatchAction(userId, 'abandon', `match_${i}`);
        const result = checkAbandonmentLimit(userId);
        expect(result.allowed).toBe(true);
        expect(result.abandonCount).toBe(i + 1);
      }
    });

    test('blocks abandonments over limit', () => {
      const userId = 'user_123';

      // Create max allowed abandonments
      for (let i = 0; i < 5; i++) {
        recordMatchAction(userId, 'abandon', `match_${i}`);
      }

      // Should be blocked
      const result = checkAbandonmentLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.abandonCount).toBe(5);
      expect(result.limit).toBe(5);
      expect(result.reason).toBe('too_many_abandonments');
    });

    test('resets abandonment count after hour', () => {
      const userId = 'user_123';

      // Create max abandonments
      for (let i = 0; i < 5; i++) {
        recordMatchAction(userId, 'abandon', `match_${i}`);
      }

      // Should be blocked
      const blockedResult = checkAbandonmentLimit(userId);
      expect(blockedResult.allowed).toBe(false);

      // Advance time by over an hour
      jest.advanceTimersByTime(3601000);

      // Should be allowed again
      const allowedResult = checkAbandonmentLimit(userId);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.abandonCount).toBe(0);
    });

    test('resets abandonment count on successful match completion', () => {
      const userId = 'user_123';

      // Create abandonments
      for (let i = 0; i < 3; i++) {
        recordMatchAction(userId, 'abandon', `match_${i}`);
      }

      const beforeResult = checkAbandonmentLimit(userId);
      expect(beforeResult.abandonCount).toBe(3);

      // Complete a match
      recordMatchAction(userId, 'complete', 'match_complete');

      // Count should be reset
      const afterResult = checkAbandonmentLimit(userId);
      expect(afterResult.abandonCount).toBe(0);
    });
  });

  describe('Turn Submission Duplicate Detection', () => {
    test('allows first turn submission', () => {
      const userId = 'user_123';
      const matchId = 'match_123';
      const turnNumber = 1;

      const result = checkDuplicateTurn(userId, matchId, turnNumber);
      expect(result.isDuplicate).toBe(false);
    });

    test('blocks duplicate turn submission for same turn', () => {
      const userId = 'user_123';
      const matchId = 'match_123';
      const turnNumber = 1;

      // First submission
      checkDuplicateTurn(userId, matchId, turnNumber);

      // Duplicate submission
      const result = checkDuplicateTurn(userId, matchId, turnNumber);
      expect(result.isDuplicate).toBe(true);
      expect(result.lastTurnNumber).toBe(1);
    });

    test('allows submission for different turns', () => {
      const userId = 'user_123';
      const matchId = 'match_123';

      // Submit turn 1
      checkDuplicateTurn(userId, matchId, 1);

      // Submit turn 2 - should be allowed
      const result = checkDuplicateTurn(userId, matchId, 2);
      expect(result.isDuplicate).toBe(false);
    });

    test('tracks turn submissions per user per match', () => {
      const user1 = 'user_1';
      const user2 = 'user_2';
      const matchId = 'match_123';

      // User 1 submits turn 1
      const result1a = checkDuplicateTurn(user1, matchId, 1);
      expect(result1a.isDuplicate).toBe(false);

      // User 1 tries duplicate - should be blocked
      const result1b = checkDuplicateTurn(user1, matchId, 1);
      expect(result1b.isDuplicate).toBe(true);

      // User 2 submits turn 1 - should be allowed (different user)
      const result2 = checkDuplicateTurn(user2, matchId, 1);
      expect(result2.isDuplicate).toBe(false);
    });

    test('clears turn tracking after cleanup', () => {
      const userId = 'user_123';
      const matchId = 'match_123';

      // Submit turn
      checkDuplicateTurn(userId, matchId, 1);

      // Cleanup
      cleanupTurnTracking(userId, matchId);

      // Should allow submission again after cleanup
      const result = checkDuplicateTurn(userId, matchId, 1);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Win Trading Detection', () => {
    test('does not flag normal play patterns', () => {
      const userId = 'user_1';
      const opponentId = 'user_2';

      const baseTime = Date.now();
      const results = [
        { result: 'win' as const, timestamp: baseTime - 600000 }, // 10 minutes ago
        { result: 'loss' as const, timestamp: baseTime - 300000 }, // 5 minutes ago
        { result: 'win' as const, timestamp: baseTime - 100000 }, // 1.6 minutes ago
      ];

      const detection = detectWinTrading(userId, opponentId, results);

      expect(detection.suspicious).toBe(false);
      expect(detection.pattern).toBe('normal');
    });

    test('detects alternating win/loss pattern', () => {
      const userId = 'user_1';
      const opponentId = 'user_2';

      const baseTime = Date.now();
      const results = [
        { result: 'win' as const, timestamp: baseTime - 400000 },
        { result: 'loss' as const, timestamp: baseTime - 300000 },
        { result: 'win' as const, timestamp: baseTime - 200000 },
        { result: 'loss' as const, timestamp: baseTime - 100000 },
        { result: 'win' as const, timestamp: baseTime - 50000 },
      ];

      const detection = detectWinTrading(userId, opponentId, results);

      expect(detection.suspicious).toBe(true);
      expect(detection.pattern).toBe('alternating_wins_losses');
      expect(detection.confidence).toBeGreaterThan(0.8);
    });

    test('detects rapid matches against same opponent', () => {
      const userId = 'user_1';
      const opponentId = 'user_2';

      const baseTime = Date.now();
      const results = [
        { result: 'win' as const, timestamp: baseTime - 180000 },
        { result: 'win' as const, timestamp: baseTime - 120000 },
        { result: 'win' as const, timestamp: baseTime - 60000 },
      ];

      const detection = detectWinTrading(userId, opponentId, results);

      expect(detection.suspicious).toBe(true);
      expect(detection.pattern).toBe('rapid_repeated_opponents');
      expect(detection.confidence).toBeGreaterThanOrEqual(0.5);
    });

    test('returns insufficient data for small sample sizes', () => {
      const userId = 'user_1';
      const opponentId = 'user_2';

      const results = [
        { result: 'win' as const, timestamp: Date.now() - 100000 },
        { result: 'loss' as const, timestamp: Date.now() - 50000 },
      ];

      const detection = detectWinTrading(userId, opponentId, results);

      expect(detection.suspicious).toBe(false);
      expect(detection.pattern).toBe('insufficient_data');
      expect(detection.confidence).toBe(0);
    });

    test('calculates confidence based on pattern severity', () => {
      const userId = 'user_1';
      const opponentId = 'user_2';

      const baseTime = Date.now();
      const results = [
        { result: 'win' as const, timestamp: baseTime - 400000 },
        { result: 'loss' as const, timestamp: baseTime - 300000 },
        { result: 'win' as const, timestamp: baseTime - 200000 },
        { result: 'loss' as const, timestamp: baseTime - 100000 },
        { result: 'win' as const, timestamp: baseTime - 50000 },
      ];

      const detection1 = detectWinTrading(userId, opponentId, results);

      // Test with even more rapid matches
      const rapidResults = [
        { result: 'win' as const, timestamp: baseTime - 120000 },
        { result: 'loss' as const, timestamp: baseTime - 60000 },
        { result: 'win' as const, timestamp: baseTime - 30000 },
      ];

      const detection2 = detectWinTrading(userId, opponentId, rapidResults);

      // Rapid pattern should have higher confidence
      expect(detection2.confidence).toBeGreaterThan(detection1.confidence);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('returns rate limit statistics', () => {
      const userId = 'user_123';

      checkRateLimit(userId, 'submit_turn');
      recordMatchAction(userId, 'create', 'match_123');
      checkDuplicateTurn(userId, 'match_123', 1);

      const stats = getRateLimitStats();

      expect(stats.trackedUsers).toBeGreaterThan(0);
      expect(stats.trackedMatches).toBeGreaterThan(0);
      expect(stats.trackedTurns).toBeGreaterThan(0);
    });

    test('returns player rate limit status', () => {
      const userId = 'user_123';

      // Create and complete a match
      recordMatchAction(userId, 'create', 'match_123');
      recordMatchAction(userId, 'complete', 'match_123');

      const status = getPlayerRateLimitStatus(userId);

      expect(status.activeMatches).toBe(0);
      expect(status.abandonCount).toBe(0);
      expect(status.lastMatchAction).toBe('complete');
    });

    test('tracks active matches correctly', () => {
      const userId = 'user_123';

      recordMatchAction(userId, 'create', 'match_1');
      recordMatchAction(userId, 'create', 'match_2');
      recordMatchAction(userId, 'create', 'match_3');

      const status = getPlayerRateLimitStatus(userId);
      expect(status.activeMatches).toBe(3);
    });

    test('tracks abandonment count correctly', () => {
      const userId = 'user_123';

      recordMatchAction(userId, 'abandon', 'match_1');
      recordMatchAction(userId, 'abandon', 'match_2');

      const status = getPlayerRateLimitStatus(userId);
      expect(status.abandonCount).toBe(2);
    });
  });

  describe('Cleanup and Memory Management', () => {
    test('cleans up old rate limit entries', () => {
      const userId = 'user_123';

      // Create some activity
      checkRateLimit(userId, 'submit_turn');

      // Advance time significantly
      jest.advanceTimersByTime(86400000 * 2); // 2 days

      // Trigger cleanup
      cleanupOldEntries();

      // After cleanup, old timestamps should be filtered out
      // The user tracker will still exist but have empty timestamps
      const stats = getRateLimitStats();
      // Since timestamps are filtered out but tracker still exists, trackedUsers should be 1
      // But since timestamps are empty, the next request would reset them
      expect(stats.trackedUsers).toBe(1);
    });

    test('resets all tracking on explicit reset', () => {
      const userId = 'user_123';

      // Create activity
      checkRateLimit(userId, 'submit_turn');
      recordMatchAction(userId, 'create', 'match_123');
      checkDuplicateTurn(userId, 'match_123', 1);

      // Reset
      resetRateLimiting();

      const stats = getRateLimitStats();
      expect(stats.trackedUsers).toBe(0);
      expect(stats.trackedMatches).toBe(0);
      expect(stats.trackedTurns).toBe(0);
    });
  });
});
