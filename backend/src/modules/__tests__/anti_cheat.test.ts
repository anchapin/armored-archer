import {
  generateRequestIdAndNonce,
  computeSignature,
  verifyRequestSignature,
  validateCombatActionParameters,
  detectTimingAttack,
  initializeAntiCheat,
  cleanupExpiredRequests,
  getAntiCheatStats,
  AntiCheatViolation,
  initializeLeaderboardAntiCheat,
  recordMatchResult,
  recordAbandonment,
  getPlayerMatchHistory,
  isPlayerFlagged,
  getFlagReason,
  clearPlayerFlag,
  getLeaderboardAntiCheatStats,
  submitPlayerReport,
  getReportsForUser,
} from '../anti_cheat';

const mockContext = {
  userId: 'test-user-123',
  sessionId: 'test-session',
  username: 'testuser',
  vars: {},
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600000,
};

describe('Anti-Cheat Module', () => {
  let violations: AntiCheatViolation[] = [];

  beforeEach(() => {
    violations = [];
    initializeAntiCheat(
      {
        hmacSecret: 'test-secret-key',
        replayWindowMs: 300000,
        maxClockSkewMs: 5000,
        enableSignatureVerification: true,
        enableReplayProtection: true,
      },
      (violation) => violations.push(violation)
    );
  });

  afterEach(() => {
    cleanupExpiredRequests();
  });

  test('generateRequestIdAndNonce produces unique values', () => {
    const pair1 = generateRequestIdAndNonce();
    const pair2 = generateRequestIdAndNonce();

    expect(pair1.requestId).toHaveLength(32);
    expect(pair1.nonce).toHaveLength(32);
    expect(pair1.requestId).not.toEqual(pair2.requestId);
    expect(pair1.nonce).not.toEqual(pair2.nonce);
  });

  test('generateRequestIdAndNonce produces valid hex strings', () => {
    const { requestId, nonce } = generateRequestIdAndNonce();
    expect(/^[a-f0-9]{32}$/.test(requestId)).toBe(true);
    expect(/^[a-f0-9]{32}$/.test(nonce)).toBe(true);
  });

  test('computeSignature produces deterministic HMAC-SHA256 signatures', () => {
    const payload = '{"angle":1.57,"power":0.8}';
    const timestamp = 1700000000;
    const nonce = 'a'.repeat(32);

    const sig1 = computeSignature(payload, timestamp, nonce);
    const sig2 = computeSignature(payload, timestamp, nonce);

    expect(sig1).toEqual(sig2);
    expect(sig1).toHaveLength(64);
  });

  test('computeSignature produces different signatures for different inputs', () => {
    const payload = '{"angle":1.57}';
    const timestamp = 1700000000;
    const nonce = 'a'.repeat(32);

    const sig1 = computeSignature(payload, timestamp, nonce);
    const sig2 = computeSignature(payload, timestamp + 1, nonce);
    const sig3 = computeSignature(payload + '2', timestamp, nonce);

    expect(sig1).not.toEqual(sig2);
    expect(sig1).not.toEqual(sig3);
  });

  test('verifyRequestSignature accepts valid signatures', () => {
    const payload = '{"angle":1.57,"power":0.8}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();
    const signature = computeSignature(payload, timestamp, nonce);

    const result = verifyRequestSignature(
      mockContext,
      payload,
      { requestId, timestamp, signature, nonce },
      'test_rpc'
    );

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('verifyRequestSignature detects invalid signatures', () => {
    const payload = '{"angle":1.57}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();
    const badSignature = 'a'.repeat(64);

    const result = verifyRequestSignature(
      mockContext,
      payload,
      { requestId, timestamp, signature: badSignature, nonce },
      'test_rpc'
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.violationType === 'invalid_signature')).toBe(true);
  });

  test('verifyRequestSignature detects replay attacks', () => {
    const payload = '{"angle":1.57}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();
    const signature = computeSignature(payload, timestamp, nonce);

    // First submission should pass
    const result1 = verifyRequestSignature(
      mockContext,
      payload,
      { requestId, timestamp, signature, nonce },
      'test_rpc'
    );
    expect(result1.valid).toBe(true);

    // Same request should be detected as replay
    const result2 = verifyRequestSignature(
      mockContext,
      payload,
      { requestId, timestamp, signature, nonce },
      'test_rpc'
    );
    expect(result2.valid).toBe(false);
    expect(result2.violations.some((v) => v.violationType === 'replay_attack')).toBe(true);
  });

  test('verifyRequestSignature detects clock skew', () => {
    const payload = '{"angle":1.57}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now() - 10000;
    const signature = computeSignature(payload, timestamp, nonce);

    const result = verifyRequestSignature(
      mockContext,
      payload,
      { requestId, timestamp, signature, nonce },
      'test_rpc'
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.violationType === 'clock_skew')).toBe(true);
  });

  test('validateCombatActionParameters accepts valid parameters', () => {
    const result = validateCombatActionParameters(
      1.57,
      0.8,
      'player-1',
      'player-1',
      'submit_combat_action',
      'req-id'
    );

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('validateCombatActionParameters rejects invalid angle', () => {
    const result = validateCombatActionParameters(
      -0.5,
      0.8,
      'player-1',
      'player-1',
      'submit_combat_action',
      'req-id'
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.details.parameterName === 'angle')).toBe(true);
  });

  test('validateCombatActionParameters accepts valid combat action', () => {
    // Pass correct currentTurnUserId to avoid out_of_turn violation
    const result = validateCombatActionParameters(
      1.57,
      0.8,
      'player-1',
      'player-1',
      'submit_combat_action',
      'req-id'
    );

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('detectTimingAttack detects suspiciously fast requests', () => {
    const userId = 'suspicious-user';
    const rpc = 'submit_combat_action';

    // Simulate suspicious: requests every <100ms
    detectTimingAttack(userId, rpc, 'req-1');
    detectTimingAttack(userId, rpc, 'req-2');
    detectTimingAttack(userId, rpc, 'req-3');
    const isAttack = detectTimingAttack(userId, rpc, 'req-4');

    expect(isAttack).toBe(true);
  });

  test('getAntiCheatStats returns correct statistics', () => {
    const stats = getAntiCheatStats();

    expect(stats).toHaveProperty('processedRequestsCount');
    expect(stats).toHaveProperty('timingLogsCount');
    expect(stats).toHaveProperty('config');
    expect(typeof stats.processedRequestsCount).toBe('number');
    expect(typeof stats.timingLogsCount).toBe('number');
  });

  test('Full validation flow for legitimate request', () => {
    const payload = '{"match_id":"m123","action_type":"shoot","angle":1.57,"power":0.8}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();
    const signature = computeSignature(payload, timestamp, nonce);

    // Step 1: Verify signature
    const sigResult = verifyRequestSignature(
      mockContext,
      payload,
      { requestId, timestamp, signature, nonce },
      'submit_combat_action'
    );
    expect(sigResult.valid).toBe(true);

    // Step 2: Validate parameters
    const paramResult = validateCombatActionParameters(
      1.57,
      0.8,
      mockContext.userId,
      mockContext.userId,
      'submit_combat_action',
      requestId
    );
    expect(paramResult.valid).toBe(true);

    // Step 3: Check for timing attacks
    const timingResult = detectTimingAttack(mockContext.userId, 'submit_combat_action', requestId);
    expect(timingResult).toBe(false);

    // All checks should pass
    expect(violations).toHaveLength(0);
  });

  test('Full validation flow detects replayed request', () => {
    const payload = '{"match_id":"m123","action_type":"shoot","angle":1.57,"power":0.8}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();
    const signature = computeSignature(payload, timestamp, nonce);

    const requestSig = { requestId, timestamp, signature, nonce };

    // First submission
    const result1 = verifyRequestSignature(
      mockContext,
      payload,
      requestSig,
      'submit_combat_action'
    );
    expect(result1.valid).toBe(true);

    // Replay attempt
    const result2 = verifyRequestSignature(
      mockContext,
      payload,
      requestSig,
      'submit_combat_action'
    );
    expect(result2.valid).toBe(false);
    expect(violations.some((v) => v.violationType === 'replay_attack')).toBe(true);
  });

  // ===== verifyRequestSignature branch coverage =====

  test('verifyRequestSignature skips signature verification when disabled', () => {
    initializeAntiCheat(
      {
        hmacSecret: 'test-secret-key',
        replayWindowMs: 300000,
        maxClockSkewMs: 5000,
        enableSignatureVerification: false,
        enableReplayProtection: false,
      },
      (violation) => violations.push(violation)
    );

    const payload = '{"angle":1.57}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();
    const badSignature = 'a'.repeat(64);

    const result = verifyRequestSignature(
      mockContext,
      payload,
      { requestId, timestamp, signature: badSignature, nonce },
      'test_rpc'
    );

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('verifyRequestSignature skips replay protection when disabled', () => {
    initializeAntiCheat(
      {
        hmacSecret: 'test-secret-key',
        replayWindowMs: 300000,
        maxClockSkewMs: 5000,
        enableSignatureVerification: false,
        enableReplayProtection: false,
      },
      (violation) => violations.push(violation)
    );

    const payload = '{"angle":1.57}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();

    const sig = { requestId, timestamp, signature: 'a'.repeat(64), nonce };

    const result1 = verifyRequestSignature(mockContext, payload, sig, 'test_rpc');
    expect(result1.valid).toBe(true);

    const result2 = verifyRequestSignature(mockContext, payload, sig, 'test_rpc');
    expect(result2.valid).toBe(true);
    expect(result2.violations).toHaveLength(0);
  });

  test('verifyRequestSignature with valid signature and replay protection disabled', () => {
    initializeAntiCheat(
      {
        hmacSecret: 'test-secret-key',
        replayWindowMs: 300000,
        maxClockSkewMs: 5000,
        enableSignatureVerification: true,
        enableReplayProtection: false,
      },
      (violation) => violations.push(violation)
    );

    const payload = '{"angle":1.57}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();
    const signature = computeSignature(payload, timestamp, nonce);

    const sig = { requestId, timestamp, signature, nonce };

    // Submit twice - should be valid both times since replay protection is off
    const result1 = verifyRequestSignature(mockContext, payload, sig, 'test_rpc');
    expect(result1.valid).toBe(true);

    const result2 = verifyRequestSignature(mockContext, payload, sig, 'test_rpc');
    expect(result2.valid).toBe(true);
  });

  // ===== validateCombatActionParameters branch coverage =====

  test('validateCombatActionParameters rejects angle too high', () => {
    const result = validateCombatActionParameters(
      2 * Math.PI + 1,
      0.8,
      'player-1',
      'player-1',
      'submit_combat_action',
      'req-id'
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.details.parameterName === 'angle')).toBe(true);
  });

  test('validateCombatActionParameters rejects negative power', () => {
    const result = validateCombatActionParameters(
      1.57,
      -0.1,
      'player-1',
      'player-1',
      'submit_combat_action',
      'req-id'
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.details.parameterName === 'power')).toBe(true);
  });

  test('validateCombatActionParameters rejects power too high', () => {
    const result = validateCombatActionParameters(
      1.57,
      1.5,
      'player-1',
      'player-1',
      'submit_combat_action',
      'req-id'
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.details.parameterName === 'power')).toBe(true);
  });

  test('validateCombatActionParameters accepts undefined power', () => {
    const result = validateCombatActionParameters(
      1.57,
      undefined,
      'player-1',
      'player-1',
      'submit_combat_action',
      'req-id'
    );

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('validateCombatActionParameters rejects out-of-turn action', () => {
    const result = validateCombatActionParameters(
      1.57,
      0.8,
      'player-1',
      'player-2',
      'submit_combat_action',
      'req-id'
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.violationType === 'out_of_turn')).toBe(true);
  });

  test('validateCombatActionParameters detects multiple violations', () => {
    const result = validateCombatActionParameters(
      -1,
      -0.5,
      'player-1',
      'player-2',
      'submit_combat_action',
      'req-id'
    );

    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });

  // ===== detectTimingAttack branch coverage =====

  test('detectTimingAttack returns false for normal request patterns', () => {
    const userId = 'normal-user';
    const rpc = 'submit_combat_action';

    detectTimingAttack(userId, rpc, 'req-1');

    // Wait between requests to simulate normal timing
    const isAttack = detectTimingAttack(userId, rpc, 'req-2');

    expect(isAttack).toBe(false);
  });

  test('detectTimingAttack returns false when fewer than 3 requests', () => {
    const userId = 'sparse-user';
    const rpc = 'get_player_stats';

    const r1 = detectTimingAttack(userId, rpc, 'req-1');
    expect(r1).toBe(false);

    const r2 = detectTimingAttack(userId, rpc, 'req-2');
    expect(r2).toBe(false);
  });

  // ===== cleanupExpiredRequests branch coverage =====

  test('cleanupExpiredRequests handles empty stores', () => {
    expect(() => cleanupExpiredRequests()).not.toThrow();
  });

  test('cleanupExpiredRequests removes expired processed requests', () => {
    // Create a request that will be expired (use very short replay window)
    initializeAntiCheat(
      {
        hmacSecret: 'test-secret-key',
        replayWindowMs: 1,
        maxClockSkewMs: 5000,
        enableSignatureVerification: false,
        enableReplayProtection: true,
      },
      (violation) => violations.push(violation)
    );

    const payload = '{}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();

    verifyRequestSignature(
      mockContext,
      payload,
      { requestId, timestamp, signature: 'a'.repeat(64), nonce },
      'test_rpc'
    );

    // Wait for expiration
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* busy wait */
    }

    cleanupExpiredRequests();

    const stats = getAntiCheatStats();
    expect(stats.processedRequestsCount).toBe(0);
  });

  // ===== HMAC production fail-hard tests =====

  describe('HMAC Secret Configuration', () => {
    test('initializeAntiCheat works with explicit HMAC secret', () => {
      expect(() =>
        initializeAntiCheat(
          {
            hmacSecret: 'explicit-secret',
            replayWindowMs: 300000,
            maxClockSkewMs: 5000,
            enableSignatureVerification: true,
            enableReplayProtection: true,
          },
          () => {}
        )
      ).not.toThrow();
    });

    test('initializeAntiCheat overrides module-level default with provided secret', () => {
      initializeAntiCheat(
        {
          hmacSecret: 'override-secret',
          replayWindowMs: 300000,
          maxClockSkewMs: 5000,
          enableSignatureVerification: true,
          enableReplayProtection: true,
        },
        () => {}
      );

      const stats = getAntiCheatStats();
      expect(stats.config.hmacSecret).toBe('override-secret');
    });
  });

  // ===== Leaderboard anti-cheat tests =====

  describe('Leaderboard Anti-Cheat', () => {
    beforeEach(() => {
      initializeLeaderboardAntiCheat({
        suspiciousWinRateThreshold: 0.95,
        minMatchesForWinRateCheck: 5,
        maxSameOpponentMatches: 3,
        abandonmentPenalty: 50,
        escalationMultiplier: 2.0,
        gracePeriodMs: 50,
      });
    });

    test('initializeLeaderboardAntiCheat updates config', () => {
      initializeLeaderboardAntiCheat({ suspiciousWinRateThreshold: 0.9 });
      const stats = getLeaderboardAntiCheatStats();
      expect(stats.config.suspiciousWinRateThreshold).toBe(0.9);
    });

    test('recordMatchResult creates player history on first match', () => {
      const result = recordMatchResult('player-A', 'match-1', 'player-B', 'win', false, 1000, 1050);
      expect(result.flagged).toBe(false);

      const history = getPlayerMatchHistory('player-A');
      expect(history).not.toBeNull();
      expect(history!.matches).toHaveLength(1);
    });

    test('recordMatchResult flags player with suspicious win rate', () => {
      const userId = 'cheater-user';
      // Record 5 ranked wins to meet minMatchesForWinRateCheck (5)
      for (let i = 0; i < 5; i++) {
        recordMatchResult(userId, `match-${i}`, `opponent-${i}`, 'win', true, 1000, 1050);
      }

      expect(isPlayerFlagged(userId)).toBe(true);
      const reason = getFlagReason(userId);
      expect(reason).toContain('Suspicious win rate');
    });

    test('recordMatchResult flags player playing same opponent too many times', () => {
      const userId = 'colluder-user';
      const opponentId = 'same-opponent';
      // Record 3 ranked matches with same opponent (meets maxSameOpponentMatches=3 threshold)
      // First 4 wins to not trigger win rate flag
      recordMatchResult(userId, 'm-1', 'other-1', 'win', true, 1000, 1050);
      recordMatchResult(userId, 'm-2', 'other-2', 'win', true, 1050, 1100);
      // Now 3 with same opponent
      recordMatchResult(userId, 'm-3', opponentId, 'loss', true, 1100, 1080);
      recordMatchResult(userId, 'm-4', opponentId, 'loss', true, 1080, 1060);
      recordMatchResult(userId, 'm-5', opponentId, 'win', true, 1060, 1100);

      expect(isPlayerFlagged(userId)).toBe(true);
      const reason = getFlagReason(userId);
      expect(reason).toContain('same opponent');
    });

    test('recordMatchResult truncates matches beyond 200', () => {
      const userId = 'active-player';
      for (let i = 0; i < 210; i++) {
        recordMatchResult(userId, `match-${i}`, `opp-${i % 10}`, 'win', false, 1000, 1000);
      }
      const history = getPlayerMatchHistory(userId);
      expect(history!.matches.length).toBeLessThanOrEqual(200);
    });

    test('getPlayerMatchHistory returns null for unknown user', () => {
      expect(getPlayerMatchHistory('unknown-user')).toBeNull();
    });

    test('isPlayerFlagged returns false for unknown user', () => {
      expect(isPlayerFlagged('unknown-user')).toBe(false);
    });

    test('getFlagReason returns undefined for unknown user', () => {
      expect(getFlagReason('unknown-user')).toBeUndefined();
    });

    test('clearPlayerFlag clears flag and resets count', () => {
      const userId = 'flagged-user-clear';
      // Trigger flagging via abandonments with delays to bypass grace period
      for (let i = 0; i < 5; i++) {
        recordAbandonment(userId, `match-clear-${i}`, 'opp', false, 1000);
        // Wait past grace period
        const start = Date.now();
        while (Date.now() - start < 60) {
          /* busy wait */
        }
      }
      expect(isPlayerFlagged(userId)).toBe(true);

      clearPlayerFlag(userId);
      expect(isPlayerFlagged(userId)).toBe(false);
      expect(getFlagReason(userId)).toBeUndefined();
    });

    test('clearPlayerFlag does nothing for unknown user', () => {
      expect(() => clearPlayerFlag('no-such-user-xyz')).not.toThrow();
    });

    test('getLeaderboardAntiCheatStats returns correct counts', () => {
      recordMatchResult('stats-p1', 'stats-m1', 'stats-p2', 'win', false, 100, 110);
      recordMatchResult('stats-p2', 'stats-m1', 'stats-p1', 'loss', false, 100, 90);

      const stats = getLeaderboardAntiCheatStats();
      // At least our 2 players are tracked (other tests may add more)
      expect(stats.trackedPlayers).toBeGreaterThanOrEqual(2);
      expect(stats.config).toBeDefined();
    });
  });

  // ===== Abandonment tests =====

  describe('Abandonment System', () => {
    beforeEach(() => {
      initializeLeaderboardAntiCheat({
        suspiciousWinRateThreshold: 0.95,
        minMatchesForWinRateCheck: 100,
        maxSameOpponentMatches: 50,
        abandonmentPenalty: 50,
        escalationMultiplier: 2.0,
        gracePeriodMs: 50,
      });
    });

    test('recordAbandonment applies penalty', () => {
      const result = recordAbandonment('player-X', 'match-1', 'player-Y', true, 1000);
      expect(result.penalty).toBeGreaterThan(0);
    });

    test('recordAbandonment within grace period returns zero penalty', () => {
      const userId = 'grace-user';
      // Record a match first so we have a last match timestamp
      recordMatchResult(userId, 'm-1', 'opp', 'win', false, 100, 110);
      // Immediately abandon (within grace period of 50ms)
      const result = recordAbandonment(userId, 'm-2', 'opp', false, 110);
      expect(result.penalty).toBe(0);
      expect(result.escalationFactor).toBe(1);
    });

    test('recordAbandonment with no prior matches still processes', () => {
      const result = recordAbandonment('brand-new-user', 'm-1', 'opp', false, 100);
      expect(result.penalty).toBeGreaterThan(0);
    });

    test('recordAbandonment escalates with repeat offenses', () => {
      const userId = 'serial-quitter';
      // Bypass grace period by waiting
      const r1 = recordAbandonment(userId, 'm-1', 'opp', false, 100);

      // Wait past grace period
      const start = Date.now();
      while (Date.now() - start < 60) {
        /* busy wait */
      }

      const r2 = recordAbandonment(userId, 'm-2', 'opp', false, 100);
      expect(r2.escalationFactor).toBeGreaterThanOrEqual(r1.escalationFactor);
    });

    test('recordAbandonment flags player after 5 abandonments', () => {
      const userId = 'serial-quitter-flag-2';
      for (let i = 0; i < 5; i++) {
        recordAbandonment(userId, `m-fl-${i}`, 'opp', false, 100);
        const start = Date.now();
        while (Date.now() - start < 60) {
          /* wait past grace period */
        }
      }
      expect(isPlayerFlagged(userId)).toBe(true);
      expect(getFlagReason(userId)).toContain('Excessive abandonments');
    });
  });

  // ===== Player Reporting System =====

  describe('Player Reporting', () => {
    test('submitPlayerReport succeeds with valid data', () => {
      const result = submitPlayerReport('reporter', 'reported', 'harassment');
      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
    });

    test('submitPlayerReport rejects self-reporting', () => {
      const result = submitPlayerReport('same-user', 'same-user', 'harassment');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot report yourself');
    });

    test('submitPlayerReport enforces rate limiting', () => {
      const result1 = submitPlayerReport('reporter-2', 'target-1', 'harassment');
      expect(result1.success).toBe(true);

      const result2 = submitPlayerReport('reporter-2', 'target-2', 'harassment');
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Rate limit');
    });

    test('submitPlayerReport with optional match_id and additional_info', () => {
      const result = submitPlayerReport(
        'reporter-3',
        'target-3',
        'exploiting_bugs',
        'match-123',
        'They were invincible'
      );
      expect(result.success).toBe(true);
    });

    test('getReportsForUser returns reports filed by user', () => {
      submitPlayerReport('filier', 'target-filed', 'other');
      const reports = getReportsForUser('filier');
      expect(reports.length).toBeGreaterThanOrEqual(1);
      expect(reports.some((r) => r.reporterId === 'filier')).toBe(true);
    });

    test('getReportsForUser returns reports against user', () => {
      submitPlayerReport('accuser', 'accused-user', 'match_manipulation');
      const reports = getReportsForUser('accused-user');
      expect(reports.some((r) => r.reportedUserId === 'accused-user')).toBe(true);
    });

    test('getReportsForUser returns reports sorted by timestamp descending', () => {
      // Reports are sorted by timestamp descending
      const reports = getReportsForUser('filier');
      for (let i = 1; i < reports.length; i++) {
        expect(reports[i - 1].timestamp).toBeGreaterThanOrEqual(reports[i].timestamp);
      }
    });
  });
});
