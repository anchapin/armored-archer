/**
 * Tests for PvP Anti-Abuse Rate Limiting Module.
 * @fileoverview Tests for rate limiting, cooldowns, win trading detection,
 * and concurrent match limits against the durable Nakama-storage backing
 * (issue #1697), including cross-instance sharing, restart persistence,
 * OCC contention, and storage-outage behavior.
 */

jest.mock('../../config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

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

/**
 * Stateful in-memory storage backing with Nakama OCC semantics, so the
 * durable rate-limit records behave like real storage (issue #1697). Two
 * mocks built on the SAME `records` map simulate two Nakama instances
 * sharing a backend.
 */
const createStorageNk = (sharedRecords?: Map<string, { value: string; version: string }>) => {
  const records = sharedRecords ?? new Map<string, { value: string; version: string }>();
  const storageRead = jest.fn((objects: { collection: string; key: string }[]) =>
    objects
      .map((obj) => {
        const record = records.get(`${obj.collection}:${obj.key}`);
        if (!record) return null;
        return {
          collection: obj.collection,
          key: obj.key,
          userId: '',
          value: record.value,
          version: record.version,
          permissionRead: 0,
          permissionWrite: 0,
          createTime: 0,
          updateTime: 0,
        };
      })
      .filter(Boolean)
  );
  const storageWrite = jest.fn(
    (objects: { collection: string; key: string; value: unknown; version?: string }[]) => {
      objects.forEach((obj) => {
        const mapKey = `${obj.collection}:${obj.key}`;
        // Nakama OCC: '*' is create-only-if-absent; a specific version must
        // match the stored one.
        if (obj.version === '*' && records.has(mapKey)) {
          throw new Error('Storage write rejected - version check failed');
        }
        if (obj.version && obj.version !== '*') {
          const current = records.get(mapKey);
          if (!current || current.version !== obj.version) {
            throw new Error('Storage write rejected - version check failed');
          }
        }
        const normalized = typeof obj.value === 'string' ? obj.value : JSON.stringify(obj.value);
        records.set(mapKey, { value: normalized, version: String(Date.now()) });
      });
      return [];
    }
  );
  return { records, nk: { storageRead, storageWrite } as any, storageRead, storageWrite };
};

describe('Rate Limiting Module', () => {
  let nk: any;
  let records: Map<string, { value: string; version: string }>;

  beforeEach(() => {
    jest.useFakeTimers();
    ({ nk, records } = createStorageNk());
    resetRateLimiting();
    initializeRateLimiting();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetRateLimiting();
  });

  describe('RPC Rate Limiting', () => {
    test('allows requests within rate limit', () => {
      const userId = 'user_123';

      // Make 5 requests (limit is 5/min for create_match)
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(nk, userId, 'create_match');
        expect(result.allowed).toBe(true);
      }
    });

    test('blocks requests exceeding rate limit', () => {
      const userId = 'user_123';

      // Make requests up to limit
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(nk, userId, 'create_match');
        expect(result.allowed).toBe(i < 5);
      }

      // 6th request should be blocked
      const result = checkRateLimit(nk, userId, 'create_match');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('applies penalty period after rate limit exceeded', () => {
      const userId = 'user_123';

      // Exhaust rate limit (5/min for create_match)
      for (let i = 0; i < 5; i++) {
        checkRateLimit(nk, userId, 'create_match');
      }

      // This request triggers the rate limit
      const firstBlockedResult = checkRateLimit(nk, userId, 'create_match');
      expect(firstBlockedResult.allowed).toBe(false);
      expect(firstBlockedResult.reason).toBe('rate_limit_exceeded');

      // Next request should be blocked with penalty
      const secondBlockedResult = checkRateLimit(nk, userId, 'create_match');
      expect(secondBlockedResult.allowed).toBe(false);
      expect(secondBlockedResult.reason).toBe('rate_limit_penalty');
      expect(secondBlockedResult.retryAfter).toBeGreaterThan(0);
    });

    test('resets rate limit after penalty expires', () => {
      const userId = 'user_123';

      // Exhaust rate limit with short penalty
      initializeRateLimiting(
        {
          create_match: { maxRequests: 2, windowMs: 1000, penaltyMs: 500 },
        },
        undefined
      );

      checkRateLimit(nk, userId, 'create_match');
      checkRateLimit(nk, userId, 'create_match');

      // Should be blocked
      const blockedResult = checkRateLimit(nk, userId, 'create_match');
      expect(blockedResult.allowed).toBe(false);

      // Wait for penalty to expire
      jest.advanceTimersByTime(600);

      // Should be allowed again
      const allowedResult = checkRateLimit(nk, userId, 'create_match');
      expect(allowedResult.allowed).toBe(true);
    });

    test('tracks per-user rate limits independently', () => {
      const user1 = 'user_1';
      const user2 = 'user_2';

      // User 1 exhausts their limit (5/min for create_match)
      for (let i = 0; i < 5; i++) {
        checkRateLimit(nk, user1, 'create_match');
      }

      // User 1 should be blocked
      const user1Result = checkRateLimit(nk, user1, 'create_match');
      expect(user1Result.allowed).toBe(false);

      // User 2 should still be allowed
      const user2Result = checkRateLimit(nk, user2, 'create_match');
      expect(user2Result.allowed).toBe(true);
    });

    test('returns allowed for unconfigured RPCs', () => {
      const userId = 'user_123';
      const result = checkRateLimit(nk, userId, 'unconfigured_rpc' as any);
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    test('sliding window expires old timestamps', () => {
      const userId = 'user_123';

      for (let i = 0; i < 5; i++) {
        checkRateLimit(nk, userId, 'create_match');
      }
      expect(checkRateLimit(nk, userId, 'create_match').allowed).toBe(false);

      // Penalty (5 min) and window (1 min) pass
      jest.advanceTimersByTime(6 * 60000);

      const result = checkRateLimit(nk, userId, 'create_match');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Match Cooldowns', () => {
    test('allows action when no cooldown active', () => {
      const userId = 'user_123';
      const result = checkMatchCooldown(nk, userId, 'create');
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    test('blocks action during cooldown period', () => {
      const userId = 'user_123';

      // Record a match creation
      recordMatchAction(nk, userId, 'create', 'match_123');

      // Should be in cooldown
      const result = checkMatchCooldown(nk, userId, 'create');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('allows action after cooldown expires', () => {
      const userId = 'user_123';

      // Custom short cooldown for testing
      initializeRateLimiting(undefined, { matchCreateMs: 100 });

      recordMatchAction(nk, userId, 'create', 'match_123');

      // Should be in cooldown
      const blockedResult = checkMatchCooldown(nk, userId, 'create');
      expect(blockedResult.allowed).toBe(false);

      // Wait for cooldown to expire
      jest.advanceTimersByTime(150);

      // Should be allowed again
      const allowedResult = checkMatchCooldown(nk, userId, 'create');
      expect(allowedResult.allowed).toBe(true);
    });

    test('tracks different cooldowns independently', () => {
      const userId = 'user_123';

      // Record match creation
      recordMatchAction(nk, userId, 'create', 'match_123');

      // Create should be in cooldown
      const createResult = checkMatchCooldown(nk, userId, 'create');
      expect(createResult.allowed).toBe(false);

      // Accept should not be in cooldown
      const acceptResult = checkMatchCooldown(nk, userId, 'accept');
      expect(acceptResult.allowed).toBe(true);
    });
  });

  describe('Concurrent Match Limits', () => {
    test('allows creating matches under limit', () => {
      const userId = 'user_123';

      // Create 2 matches (under the limit of 3)
      for (let i = 0; i < 2; i++) {
        recordMatchAction(nk, userId, 'create', `match_${i}`);
        const result = checkConcurrentMatchLimit(nk, userId);
        expect(result.allowed).toBe(true);
        expect(result.activeCount).toBe(i + 1);
      }
    });

    test('blocks creating matches over limit', () => {
      const userId = 'user_123';

      // Create max allowed matches
      for (let i = 0; i < 3; i++) {
        recordMatchAction(nk, userId, 'create', `match_${i}`);
      }

      // Should be blocked
      const result = checkConcurrentMatchLimit(nk, userId);
      expect(result.allowed).toBe(false);
      expect(result.activeCount).toBe(3);
      expect(result.limit).toBe(3);
    });

    test('decrements active count on match completion', () => {
      const userId = 'user_123';

      // Create max matches
      for (let i = 0; i < 3; i++) {
        recordMatchAction(nk, userId, 'create', `match_${i}`);
      }

      // Should be blocked
      const blockedResult = checkConcurrentMatchLimit(nk, userId);
      expect(blockedResult.allowed).toBe(false);

      // Complete a match
      recordMatchAction(nk, userId, 'complete', 'match_0');

      // Should be allowed now
      const allowedResult = checkConcurrentMatchLimit(nk, userId);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.activeCount).toBe(2);
    });

    test('decrements active count on match abandonment', () => {
      const userId = 'user_123';

      // Create max matches
      for (let i = 0; i < 3; i++) {
        recordMatchAction(nk, userId, 'create', `match_${i}`);
      }

      // Should be blocked
      const blockedResult = checkConcurrentMatchLimit(nk, userId);
      expect(blockedResult.allowed).toBe(false);

      // Abandon a match
      recordMatchAction(nk, userId, 'abandon', 'match_0');

      // Should be allowed now
      const allowedResult = checkConcurrentMatchLimit(nk, userId);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.activeCount).toBe(2);
    });

    test('prunes active matches older than 24h so they release their slots', () => {
      const userId = 'user_123';

      for (let i = 0; i < 3; i++) {
        recordMatchAction(nk, userId, 'create', `match_${i}`);
      }
      expect(checkConcurrentMatchLimit(nk, userId).allowed).toBe(false);

      // Matches idle past the 24h stale-entry lifetime
      jest.advanceTimersByTime(24 * 3600000 + 1000);

      const result = checkConcurrentMatchLimit(nk, userId);
      expect(result.allowed).toBe(true);
      expect(result.activeCount).toBe(0);
    });
  });

  describe('Abandonment Limits', () => {
    test('allows abandonments under limit', () => {
      const userId = 'user_123';

      for (let i = 0; i < 4; i++) {
        recordMatchAction(nk, userId, 'abandon', `match_${i}`);
        const result = checkAbandonmentLimit(nk, userId);
        expect(result.allowed).toBe(true);
        expect(result.abandonCount).toBe(i + 1);
      }
    });

    test('blocks abandonments over limit', () => {
      const userId = 'user_123';

      // Create max allowed abandonments
      for (let i = 0; i < 5; i++) {
        recordMatchAction(nk, userId, 'abandon', `match_${i}`);
      }

      // Should be blocked
      const result = checkAbandonmentLimit(nk, userId);
      expect(result.allowed).toBe(false);
      expect(result.abandonCount).toBe(5);
      expect(result.limit).toBe(5);
      expect(result.reason).toBe('too_many_abandonments');
    });

    test('resets abandonment count after hour', () => {
      const userId = 'user_123';

      // Create max abandonments
      for (let i = 0; i < 5; i++) {
        recordMatchAction(nk, userId, 'abandon', `match_${i}`);
      }

      // Should be blocked
      const blockedResult = checkAbandonmentLimit(nk, userId);
      expect(blockedResult.allowed).toBe(false);

      // Advance time by over an hour
      jest.advanceTimersByTime(3601000);

      // Should be allowed again
      const allowedResult = checkAbandonmentLimit(nk, userId);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.abandonCount).toBe(0);
    });

    test('resets abandonment count on successful match completion', () => {
      const userId = 'user_123';

      // Create abandonments
      for (let i = 0; i < 3; i++) {
        recordMatchAction(nk, userId, 'abandon', `match_${i}`);
      }

      const beforeResult = checkAbandonmentLimit(nk, userId);
      expect(beforeResult.abandonCount).toBe(3);

      // Complete a match
      recordMatchAction(nk, userId, 'complete', 'match_complete');

      // Count should be reset
      const afterResult = checkAbandonmentLimit(nk, userId);
      expect(afterResult.abandonCount).toBe(0);
    });
  });

  describe('Turn Submission Duplicate Detection', () => {
    test('allows first turn submission', () => {
      const userId = 'user_123';
      const matchId = 'match_123';
      const turnNumber = 1;

      const result = checkDuplicateTurn(nk, userId, matchId, turnNumber);
      expect(result.isDuplicate).toBe(false);
    });

    test('blocks duplicate turn submission for same turn', () => {
      const userId = 'user_123';
      const matchId = 'match_123';
      const turnNumber = 1;

      // First submission
      checkDuplicateTurn(nk, userId, matchId, turnNumber);

      // Duplicate submission
      const result = checkDuplicateTurn(nk, userId, matchId, turnNumber);
      expect(result.isDuplicate).toBe(true);
      expect(result.lastTurnNumber).toBe(1);
    });

    test('allows submission for different turns', () => {
      const userId = 'user_123';
      const matchId = 'match_123';

      // Submit turn 1
      checkDuplicateTurn(nk, userId, matchId, 1);

      // Submit turn 2 - should be allowed
      const result = checkDuplicateTurn(nk, userId, matchId, 2);
      expect(result.isDuplicate).toBe(false);
    });

    test('tracks turn submissions per user per match', () => {
      const user1 = 'user_1';
      const user2 = 'user_2';
      const matchId = 'match_123';

      // User 1 submits turn 1
      const result1a = checkDuplicateTurn(nk, user1, matchId, 1);
      expect(result1a.isDuplicate).toBe(false);

      // User 1 tries duplicate - should be blocked
      const result1b = checkDuplicateTurn(nk, user1, matchId, 1);
      expect(result1b.isDuplicate).toBe(true);

      // User 2 submits turn 1 - should be allowed (different user)
      const result2 = checkDuplicateTurn(nk, user2, matchId, 1);
      expect(result2.isDuplicate).toBe(false);
    });

    test('clears turn tracking after cleanup', () => {
      const userId = 'user_123';
      const matchId = 'match_123';

      // Submit turn
      checkDuplicateTurn(nk, userId, matchId, 1);

      // Cleanup
      cleanupTurnTracking(nk, userId, matchId);

      // Should allow submission again after cleanup
      const result = checkDuplicateTurn(nk, userId, matchId, 1);
      expect(result.isDuplicate).toBe(false);
    });

    test('prunes turn submissions older than 24h', () => {
      const userId = 'user_123';
      const matchId = 'match_123';

      checkDuplicateTurn(nk, userId, matchId, 1);
      expect(checkDuplicateTurn(nk, userId, matchId, 1).isDuplicate).toBe(true);

      jest.advanceTimersByTime(24 * 3600000 + 1000);

      // Pruned by the stale-entry lifetime - the same turn reads as new
      const result = checkDuplicateTurn(nk, userId, matchId, 1);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Durable storage behavior (issue #1697)', () => {
    test('shares rate limit state across instances backed by the same storage', () => {
      // Two Nakama instances (pods) sharing one storage backend
      const podA = createStorageNk(records).nk;
      const podB = createStorageNk(records).nk;
      const userId = 'user_shared';
      // Pin the default config (an earlier test installs a custom one;
      // initializeRateLimiting merges rather than resets).
      initializeRateLimiting({
        create_match: { maxRequests: 5, windowMs: 60000, penaltyMs: 300000 },
      });

      // 3 requests land on pod A, 2 on pod B (limit 5/min for create_match)
      for (let i = 0; i < 3; i++) {
        expect(checkRateLimit(podA, userId, 'create_match').allowed).toBe(true);
      }
      for (let i = 0; i < 2; i++) {
        expect(checkRateLimit(podB, userId, 'create_match').allowed).toBe(true);
      }

      // The 6th request is denied on EITHER pod - the per-instance bypass
      // from #1697 is closed.
      expect(checkRateLimit(podB, userId, 'create_match').allowed).toBe(false);
      expect(checkRateLimit(podA, userId, 'create_match').allowed).toBe(false);
    });

    test('shares match cooldown and concurrency state across instances', () => {
      const podA = createStorageNk(records).nk;
      const podB = createStorageNk(records).nk;
      const userId = 'user_shared_match';

      recordMatchAction(podA, userId, 'create', 'match_1');
      recordMatchAction(podB, userId, 'create', 'match_2');

      // Both pods see both active matches and the create cooldown
      const concurrent = checkConcurrentMatchLimit(podB, userId);
      expect(concurrent.activeCount).toBe(2);
      expect(checkMatchCooldown(podA, userId, 'create').allowed).toBe(false);
    });

    test('state survives a module restart (fresh module, same storage)', () => {
      const userId = 'user_restart';

      // A fresh module instance simulates a production process: it boots
      // with resetId 0 and never calls resetRateLimiting, so the records it
      // writes are readable by the next process.
      jest.resetModules();
      const writer = require('../rate_limit');
      for (let i = 0; i < 5; i++) {
        writer.checkRateLimit(nk, userId, 'create_match');
      }
      expect(writer.checkRateLimit(nk, userId, 'create_match').allowed).toBe(false);

      // Simulate the restart: another fresh module instance, same storage.
      // The limit is still enforced - no deploy-time reset (issue #1697).
      jest.resetModules();
      const fresh = require('../rate_limit');
      const result = fresh.checkRateLimit(nk, userId, 'create_match');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_penalty');
    });

    test('resetRateLimiting invalidates stored state (test hook)', () => {
      const userId = 'user_reset';

      for (let i = 0; i < 5; i++) {
        checkRateLimit(nk, userId, 'create_match');
      }
      expect(checkRateLimit(nk, userId, 'create_match').allowed).toBe(false);

      resetRateLimiting();

      expect(checkRateLimit(nk, userId, 'create_match').allowed).toBe(true);
    });

    test('retries the CAS write after losing an OCC race', () => {
      const userId = 'user_cas';
      const storageWrite = nk.storageWrite as jest.Mock;
      let calls = 0;
      const realImpl = storageWrite.getMockImplementation();
      storageWrite.mockImplementation((objects: any[]) => {
        calls++;
        if (calls === 1) {
          throw new Error('Storage write rejected - version check failed');
        }
        return realImpl!(objects);
      });

      // First call: write loses the race once, then retries - but the retry
      // re-reads and still finds room, so the request is allowed.
      const result = checkRateLimit(nk, userId, 'create_match');
      expect(result.allowed).toBe(true);
      expect(calls).toBeGreaterThan(1);
    });

    test('fails closed after CAS contention is exhausted', () => {
      const userId = 'user_contention';
      (nk.storageWrite as jest.Mock).mockImplementation(() => {
        throw new Error('Storage write rejected - version check failed');
      });

      const result = checkRateLimit(nk, userId, 'create_match');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_contention');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('fails open when storage reads throw (outage)', () => {
      const userId = 'user_outage';
      (nk.storageRead as jest.Mock).mockImplementation(() => {
        throw new Error('connection refused');
      });

      expect(checkRateLimit(nk, userId, 'create_match').allowed).toBe(true);
      expect(checkMatchCooldown(nk, userId, 'create').allowed).toBe(true);
      expect(checkConcurrentMatchLimit(nk, userId).allowed).toBe(true);
      expect(checkAbandonmentLimit(nk, userId).allowed).toBe(true);
      expect(checkDuplicateTurn(nk, userId, 'match_1', 1).isDuplicate).toBe(false);
      expect(getPlayerRateLimitStatus(nk, userId).activeMatches).toBe(0);
      // Record bookkeeping is dropped, not fatal
      expect(() => recordMatchAction(nk, userId, 'create', 'match_1')).not.toThrow();
      expect(() => cleanupTurnTracking(nk, userId, 'match_1')).not.toThrow();
    });

    test('fails open when storage writes throw a non-version error', () => {
      const userId = 'user_write_outage';
      (nk.storageWrite as jest.Mock).mockImplementation(() => {
        throw new Error('disk full');
      });

      expect(checkRateLimit(nk, userId, 'create_match').allowed).toBe(true);
    });

    test('treats a corrupt stored record as fresh', () => {
      const userId = 'user_corrupt';
      records.set(`pvp_rate_limits:${userId}:actions`, {
        value: '{not valid json',
        version: '7',
      });

      const result = checkRateLimit(nk, userId, 'create_match');
      expect(result.allowed).toBe(true);
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

      checkRateLimit(nk, userId, 'create_match');
      recordMatchAction(nk, userId, 'create', 'match_123');
      checkDuplicateTurn(nk, userId, 'match_123', 1);

      const stats = getRateLimitStats();

      expect(stats.trackedUsers).toBeGreaterThan(0);
      expect(stats.trackedMatches).toBeGreaterThan(0);
      expect(stats.trackedTurns).toBeGreaterThan(0);
    });

    test('returns player rate limit status', () => {
      const userId = 'user_123';

      // Create and complete a match
      recordMatchAction(nk, userId, 'create', 'match_123');
      recordMatchAction(nk, userId, 'complete', 'match_123');

      const status = getPlayerRateLimitStatus(nk, userId);

      expect(status.activeMatches).toBe(0);
      expect(status.abandonCount).toBe(0);
      expect(status.lastMatchAction).toBe('complete');
    });

    test('tracks active matches correctly', () => {
      const userId = 'user_123';

      recordMatchAction(nk, userId, 'create', 'match_1');
      recordMatchAction(nk, userId, 'create', 'match_2');
      recordMatchAction(nk, userId, 'create', 'match_3');

      const status = getPlayerRateLimitStatus(nk, userId);
      expect(status.activeMatches).toBe(3);
    });

    test('tracks abandonment count correctly', () => {
      const userId = 'user_123';

      recordMatchAction(nk, userId, 'abandon', 'match_1');
      recordMatchAction(nk, userId, 'abandon', 'match_2');

      const status = getPlayerRateLimitStatus(nk, userId);
      expect(status.abandonCount).toBe(2);
    });
  });

  describe('Cleanup and Memory Management', () => {
    test('cleans up stale observability-mirror entries', () => {
      const userId = 'user_123';

      // Create some activity
      checkRateLimit(nk, userId, 'create_match');

      // Advance time significantly
      jest.advanceTimersByTime(86400000 * 2); // 2 days

      // Trigger cleanup
      cleanupOldEntries();

      // The stale mirror entry is pruned; the durable record is unaffected
      // (its own timestamps govern expiry, not the mirror).
      const stats = getRateLimitStats();
      expect(stats.trackedUsers).toBe(0);
    });

    test('resets all tracking on explicit reset', () => {
      const userId = 'user_123';

      // Create activity
      checkRateLimit(nk, userId, 'create_match');
      recordMatchAction(nk, userId, 'create', 'match_123');
      checkDuplicateTurn(nk, userId, 'match_123', 1);

      // Reset
      resetRateLimiting();

      const stats = getRateLimitStats();
      expect(stats.trackedUsers).toBe(0);
      expect(stats.trackedMatches).toBe(0);
      expect(stats.trackedTurns).toBe(0);
    });
  });
});
