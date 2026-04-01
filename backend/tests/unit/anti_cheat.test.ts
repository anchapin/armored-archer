import { createHmac } from 'crypto';

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockCtx: any = {
  userId: 'test-user-123',
  username: 'testuser',
  variables: {},
  env: {},
  sessionExpiry: 0,
};

import {
  initializeAntiCheat,
  generateRequestIdAndNonce,
  computeSignature,
  verifyRequestSignature,
  validateCombatActionParameters,
  detectTimingAttack,
  cleanupExpiredRequests,
  getAntiCheatStats,
  initializeLeaderboardAntiCheat,
  recordMatchResult,
  recordAbandonment,
  getPlayerMatchHistory,
  isPlayerFlagged,
  getFlagReason,
  clearPlayerFlag,
  submitPlayerReport,
  getReportsForUser,
  AntiCheatViolation,
  RequestSignature,
} from '../../src/modules/anti_cheat';

describe('AntiCheat Module', () => {
  let violationLog: AntiCheatViolation[];

  beforeEach(() => {
    violationLog = [];
    initializeAntiCheat(
      {
        hmacSecret: 'test-secret-key',
        replayWindowMs: 300000,
        maxClockSkewMs: 5000,
        enableSignatureVerification: true,
        enableReplayProtection: true,
      },
      (violation) => violationLog.push(violation)
    );

    initializeLeaderboardAntiCheat({
      suspiciousWinRateThreshold: 0.95,
      minMatchesForWinRateCheck: 100,
      maxSameOpponentMatches: 50,
      abandonmentPenalty: 50,
      escalationMultiplier: 2.0,
      gracePeriodMs: 30000,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. generateRequestIdAndNonce returns 32-char hex strings
  // =========================================================================
  describe('generateRequestIdAndNonce', () => {
    it('returns requestId and nonce as 32-char hex strings', () => {
      const result = generateRequestIdAndNonce();
      expect(result.requestId).toMatch(/^[0-9a-f]{32}$/);
      expect(result.nonce).toMatch(/^[0-9a-f]{32}$/);
    });

    it('generates unique pairs on successive calls', () => {
      const a = generateRequestIdAndNonce();
      const b = generateRequestIdAndNonce();
      expect(a.requestId).not.toBe(b.requestId);
      expect(a.nonce).not.toBe(b.nonce);
    });
  });

  // =========================================================================
  // 2. computeSignature is deterministic for same inputs
  // =========================================================================
  describe('computeSignature', () => {
    it('produces identical hex digest for identical inputs', () => {
      const payload = '{"action":"shoot","angle":1.57}';
      const timestamp = 1700000000000;
      const nonce = 'abc123def456';

      const sig1 = computeSignature(payload, timestamp, nonce);
      const sig2 = computeSignature(payload, timestamp, nonce);

      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[0-9a-f]+$/);
    });

    it('produces different signatures when payload changes', () => {
      const ts = 1700000000000;
      const nonce = 'test-nonce';
      expect(computeSignature('payload-a', ts, nonce)).not.toBe(
        computeSignature('payload-b', ts, nonce)
      );
    });

    it('produces different signatures when nonce changes', () => {
      const ts = 1700000000000;
      const payload = 'test-payload';
      expect(computeSignature(payload, ts, 'nonce-1')).not.toBe(
        computeSignature(payload, ts, 'nonce-2')
      );
    });

    it('produces different signatures when timestamp changes', () => {
      const payload = 'test-payload';
      const nonce = 'nonce';
      expect(computeSignature(payload, 1000, nonce)).not.toBe(
        computeSignature(payload, 1001, nonce)
      );
    });
  });

  // =========================================================================
  // 3. verifyRequestSignature with valid signature → valid
  // =========================================================================
  describe('verifyRequestSignature', () => {
    function makeSig(
      payload: string,
      timestamp: number,
      nonce: string,
      requestId: string
    ): RequestSignature {
      return {
        requestId,
        timestamp,
        nonce,
        signature: computeSignature(payload, timestamp, nonce),
      };
    }

    it('accepts a valid signature within clock skew window', () => {
      const now = Date.now();
      const nonce = 'valid-nonce';
      const requestId = 'req-valid-01';
      const payload = '{"action":"shoot"}';

      const sig = makeSig(payload, now, nonce, requestId);
      const result = verifyRequestSignature(mockCtx, payload, sig, 'shoot_rpc');

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    // =======================================================================
    // 4. Clock skew detection (over maxClockSkewMs)
    // =======================================================================
    it('detects clock skew exceeding maxClockSkewMs', () => {
      const staleTimestamp = Date.now() - 60000; // 60s ago, default max is 5s
      const nonce = 'skew-nonce';
      const requestId = 'req-skew-01';
      const payload = '{"action":"shoot"}';

      const sig = makeSig(payload, staleTimestamp, nonce, requestId);
      const result = verifyRequestSignature(mockCtx, payload, sig, 'shoot_rpc');

      expect(result.valid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ violationType: 'clock_skew' })
      );
      expect(result.violations[0].details).toMatchObject({
        skewMs: expect.any(Number),
        maxAllowed: 5000,
      });
    });

    // =======================================================================
    // 5. Invalid signature detection
    // =======================================================================
    it('detects invalid signature when verification is enabled', () => {
      const now = Date.now();
      const sig: RequestSignature = {
        requestId: 'req-bad-sig-01',
        timestamp: now,
        nonce: 'nonce',
        signature: 'a'.repeat(64), // wrong signature
      };

      const result = verifyRequestSignature(mockCtx, '{}', sig, 'shoot_rpc');

      expect(result.valid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ violationType: 'invalid_signature' })
      );
    });

    it('skips signature check when verification is disabled', () => {
      initializeAntiCheat({ enableSignatureVerification: false }, (v) => violationLog.push(v));

      const sig: RequestSignature = {
        requestId: 'req-no-verify-01',
        timestamp: Date.now(),
        nonce: 'any',
        signature: 'badsignature',
      };

      const result = verifyRequestSignature(mockCtx, '{}', sig, 'rpc');
      const sigViolations = result.violations.filter(
        (v) => v.violationType === 'invalid_signature'
      );
      expect(sigViolations).toHaveLength(0);
    });

    // =======================================================================
    // 6. Replay attack detection (same requestId twice)
    // =======================================================================
    it('detects replay attack when same requestId is used twice', () => {
      const now = Date.now();
      const nonce = 'replay-nonce';
      const requestId = 'req-replay-01';
      const payload = '{"action":"shoot"}';

      const sig = makeSig(payload, now, nonce, requestId);

      // First call — should succeed
      const first = verifyRequestSignature(mockCtx, payload, sig, 'shoot_rpc');
      expect(first.valid).toBe(true);

      // Second call with same requestId — replay detected
      const second = verifyRequestSignature(mockCtx, payload, sig, 'shoot_rpc');
      expect(second.valid).toBe(false);
      expect(second.violations).toContainEqual(
        expect.objectContaining({ violationType: 'replay_attack' })
      );
    });

    it('does not flag replay when replay protection is disabled', () => {
      initializeAntiCheat({ enableReplayProtection: false }, (v) => violationLog.push(v));

      const now = Date.now();
      const nonce = 'no-replay';
      const requestId = 'req-no-replay-01';
      const payload = '{}';

      const sig = makeSig(payload, now, nonce, requestId);

      expect(verifyRequestSignature(mockCtx, payload, sig, 'rpc').valid).toBe(true);
      // Second call should still be valid — no replay check
      expect(verifyRequestSignature(mockCtx, payload, sig, 'rpc').valid).toBe(true);
    });

    it('detects multiple violations simultaneously', () => {
      const staleTimestamp = Date.now() - 60000;
      const sig: RequestSignature = {
        requestId: 'req-multi-01',
        timestamp: staleTimestamp,
        nonce: 'nonce',
        signature: 'badsignature',
      };

      // First call: clock_skew + invalid_signature
      const first = verifyRequestSignature(mockCtx, '{}', sig, 'rpc');
      expect(first.valid).toBe(false);
      expect(first.violations.length).toBeGreaterThanOrEqual(2);

      // Second call: adds replay_attack
      const second = verifyRequestSignature(mockCtx, '{}', sig, 'rpc');
      const types = second.violations.map((v) => v.violationType);
      expect(types).toContain('clock_skew');
      expect(types).toContain('invalid_signature');
      expect(types).toContain('replay_attack');
    });
  });

  // =========================================================================
  // 7. validateCombatActionParameters valid params → valid
  // =========================================================================
  describe('validateCombatActionParameters', () => {
    const rpcName = 'combat_action';
    const reqId = 'combat-req-01';

    it('returns valid for correct parameters', () => {
      const result = validateCombatActionParameters(
        Math.PI,
        0.5,
        'player-1',
        'player-1',
        rpcName,
        reqId
      );
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('accepts angle at 0', () => {
      const result = validateCombatActionParameters(0, 0.5, 'p1', 'p1', rpcName, reqId);
      expect(result.valid).toBe(true);
    });

    it('accepts angle at 2π', () => {
      const result = validateCombatActionParameters(2 * Math.PI, 0.5, 'p1', 'p1', rpcName, reqId);
      expect(result.valid).toBe(true);
    });

    // =======================================================================
    // 8. Angle out of range → violation
    // =======================================================================
    it('rejects negative angle', () => {
      const result = validateCombatActionParameters(-0.1, 0.5, 'p1', 'p1', rpcName, reqId);
      expect(result.valid).toBe(false);
      expect(result.violations[0].details).toMatchObject({ parameterName: 'angle' });
    });

    it('rejects angle exceeding 2π', () => {
      const result = validateCombatActionParameters(
        2 * Math.PI + 0.02,
        0.5,
        'p1',
        'p1',
        rpcName,
        reqId
      );
      expect(result.valid).toBe(false);
      expect(result.violations[0].details).toMatchObject({ parameterName: 'angle' });
    });

    // =======================================================================
    // 9. Power out of range → violation
    // =======================================================================
    it('accepts undefined power', () => {
      const result = validateCombatActionParameters(1.0, undefined, 'p1', 'p1', rpcName, reqId);
      expect(result.valid).toBe(true);
    });

    it('rejects negative power', () => {
      const result = validateCombatActionParameters(1.0, -0.1, 'p1', 'p1', rpcName, reqId);
      expect(result.valid).toBe(false);
      const powerViolation = result.violations.find(
        (v) => (v.details as any).parameterName === 'power'
      );
      expect(powerViolation).toBeDefined();
    });

    it('rejects power exceeding 1.0', () => {
      const result = validateCombatActionParameters(1.0, 1.02, 'p1', 'p1', rpcName, reqId);
      expect(result.valid).toBe(false);
      const powerViolation = result.violations.find(
        (v) => (v.details as any).parameterName === 'power'
      );
      expect(powerViolation).toBeDefined();
    });

    // =======================================================================
    // 10. Out of turn → violation
    // =======================================================================
    it('detects out-of-turn action', () => {
      const result = validateCombatActionParameters(
        1.0,
        0.5,
        'current-turn-player',
        'not-their-turn',
        rpcName,
        reqId
      );
      expect(result.valid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ violationType: 'out_of_turn' })
      );
    });

    it('detects multiple violations at once', () => {
      const result = validateCombatActionParameters(
        -1.0,
        2.0,
        'turn-owner',
        'intruder',
        rpcName,
        reqId
      );
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBe(3); // bad angle, bad power, out of turn
    });
  });

  // =========================================================================
  // 11. detectTimingAttack first request → false
  // =========================================================================
  describe('detectTimingAttack', () => {
    const rpcName = 'shoot_rpc';

    it('returns false for the first request from a user', () => {
      const result = detectTimingAttack('user-first', rpcName, 'req-1');
      expect(result).toBe(false);
    });

    it('returns false when fewer than 3 requests have been made', () => {
      detectTimingAttack('user-sparse', rpcName, 'req-1');
      const result = detectTimingAttack('user-sparse', rpcName, 'req-2');
      expect(result).toBe(false);
    });

    it('returns false for requests with normal (>100ms) intervals', () => {
      jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1200)
        .mockReturnValueOnce(1400)
        .mockReturnValueOnce(1600)
        .mockReturnValueOnce(1800);

      detectTimingAttack('user-normal', rpcName, 'req-n1');
      detectTimingAttack('user-normal', rpcName, 'req-n2');
      detectTimingAttack('user-normal', rpcName, 'req-n3');
      detectTimingAttack('user-normal', rpcName, 'req-n4');
      const result = detectTimingAttack('user-normal', rpcName, 'req-n5');

      expect(result).toBe(false);
    });

    // =======================================================================
    // 12. Rapid requests trigger timing attack detection
    // =======================================================================
    it('detects timing attack for rapid requests (<100ms avg interval)', () => {
      jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1010)
        .mockReturnValueOnce(1020)
        .mockReturnValueOnce(1030)
        .mockReturnValueOnce(1040);

      detectTimingAttack('user-fast', rpcName, 'req-f1');
      detectTimingAttack('user-fast', rpcName, 'req-f2');
      detectTimingAttack('user-fast', rpcName, 'req-f3');
      detectTimingAttack('user-fast', rpcName, 'req-f4');
      const result = detectTimingAttack('user-fast', rpcName, 'req-f5');

      expect(result).toBe(true);
    });

    it('tracks timing separately per userId+rpc combination', () => {
      detectTimingAttack('user-a', rpcName, 'req-a1');
      detectTimingAttack('user-b', rpcName, 'req-b1');
      // Both are first calls for their respective keys
      expect(detectTimingAttack('user-a', rpcName, 'req-a2')).toBe(false);
    });
  });

  // =========================================================================
  // 13. recordMatchResult and getPlayerMatchHistory
  // =========================================================================
  describe('recordMatchResult and getPlayerMatchHistory', () => {
    it('records a match and returns not flagged for normal play', () => {
      const result = recordMatchResult('player-1', 'match-1', 'opp-1', 'win', true, 1000, 1010);
      expect(result.flagged).toBe(false);
    });

    it('stores match results in player history', () => {
      recordMatchResult('player-hist', 'm1', 'opp-1', 'win', true, 1000, 1010);
      recordMatchResult('player-hist', 'm2', 'opp-2', 'loss', true, 1010, 1005);

      const history = getPlayerMatchHistory('player-hist');
      expect(history).not.toBeNull();
      expect(history!.matches).toHaveLength(2);
      expect(history!.matches[0].matchId).toBe('m1');
      expect(history!.matches[1].matchId).toBe('m2');
    });

    it('returns null for a player with no match history', () => {
      expect(getPlayerMatchHistory('nonexistent')).toBeNull();
    });

    it('trims matches to the last 200', () => {
      for (let i = 0; i < 210; i++) {
        recordMatchResult('trim-player', `m${i}`, 'opp', 'win', true, 1000, 1010);
      }
      const history = getPlayerMatchHistory('trim-player');
      expect(history!.matches.length).toBe(200);
      expect(history!.matches[0].matchId).toBe('m10');
    });

    // =======================================================================
    // 14. Win rate flagging (95%+ over 100+ matches)
    // =======================================================================
    it('flags player with 95%+ win rate over 100+ ranked matches', () => {
      const userId = 'cheater-wr';

      // 99 wins + 1 loss = 100 matches, 99% win rate
      for (let i = 0; i < 99; i++) {
        recordMatchResult(userId, `win-${i}`, `opp-${i % 10}`, 'win', true, 1000, 1010);
      }
      recordMatchResult(userId, 'loss-0', 'opp-good', 'loss', true, 1010, 1005);

      expect(isPlayerFlagged(userId)).toBe(true);
      expect(getFlagReason(userId)).toContain('Suspicious win rate');
    });

    it('does not flag player with below-threshold win rate', () => {
      const userId = 'normal-wr';
      for (let i = 0; i < 100; i++) {
        // Use varied opponents to avoid triggering same-opponent flag
        recordMatchResult(
          userId,
          `m-${i}`,
          `opp-${i % 20}`,
          i % 2 === 0 ? 'win' : 'loss',
          true,
          1000,
          1010
        );
      }
      expect(isPlayerFlagged(userId)).toBe(false);
    });

    it('does not check win rate before min matches threshold is met', () => {
      const userId = 'new-player-wr';
      for (let i = 0; i < 50; i++) {
        recordMatchResult(userId, `m-${i}`, 'opp', 'win', true, 1000, 1010);
      }
      expect(isPlayerFlagged(userId)).toBe(false);
    });

    it('ignores unranked matches in win rate calculation', () => {
      const userId = 'unranked-wr';
      // 50 ranked wins — under 100 threshold
      for (let i = 0; i < 50; i++) {
        recordMatchResult(userId, `r-${i}`, 'opp', 'win', true, 1000, 1010);
      }
      // 50 unranked wins — should not count toward ranked threshold
      for (let i = 0; i < 50; i++) {
        recordMatchResult(userId, `u-${i}`, 'opp', 'win', false, 1000, 1010);
      }
      expect(isPlayerFlagged(userId)).toBe(false);
    });
  });

  // =========================================================================
  // 15. recordAbandonment grace period → no penalty
  // =========================================================================
  describe('recordAbandonment', () => {
    beforeEach(() => {
      initializeLeaderboardAntiCheat({
        abandonmentPenalty: 50,
        escalationMultiplier: 2.0,
        gracePeriodMs: 50,
      });
    });

    it('applies no penalty within the grace period', () => {
      const userId = 'grace-player';
      recordMatchResult(userId, 'match-1', 'opp-1', 'win', false, 1000, 1010);
      // Immediately abandon — within 50ms grace period
      const result = recordAbandonment(userId, 'match-2', 'opp-2', false, 1010);

      expect(result.penalty).toBe(0);
      expect(result.escalationFactor).toBe(1);
    });

    it('applies penalty after the grace period expires', () => {
      const userId = 'penalty-player';
      recordMatchResult(userId, 'match-1', 'opp', 'win', false, 1000, 1010);

      // Wait past grace period
      const start = Date.now();
      while (Date.now() - start < 60) { /* busy wait */ }

      const result = recordAbandonment(userId, 'match-2', 'opp', false, 1010);
      expect(result.penalty).toBeGreaterThan(0);
    });

    it('resets abandonment count after a 1-hour gap', () => {
      const userId = 'reset-abandoner';

      // Simulate 3 abandonments within 1 hour by direct manipulation
      for (let i = 0; i < 3; i++) {
        recordAbandonment(userId, `a-${i}`, 'opp', false, 1000);
        const start = Date.now();
        while (Date.now() - start < 60) { /* wait past grace */ }
      }

      // Verify count is 3
      const history = getPlayerMatchHistory(userId);
      expect(history!.abandonmentCount).toBe(3);

      // Manually reset by setting lastAbandonmentTime far in the past
      // and triggering a new abandonment — since we can't wait 1 hour,
      // we test the reset logic via the count property directly
      history!.lastAbandonmentTime = Date.now() - 3601000;
      recordAbandonment(userId, 'a-new', 'opp', false, 1000);

      const updatedHistory = getPlayerMatchHistory(userId);
      expect(updatedHistory!.abandonmentCount).toBe(1);
    });

    it('escalates penalty with repeat offenses', () => {
      const userId = 'escalation-player';

      const first = recordAbandonment(userId, 'a1', 'opp', false, 1000);
      const start = Date.now();
      while (Date.now() - start < 60) { /* wait past grace */ }

      const second = recordAbandonment(userId, 'a2', 'opp', false, 1000);
      expect(second.penalty).toBeGreaterThan(first.penalty);
    });

    // =======================================================================
    // 16. Abandonment escalation (5+ in 1 hour → flagged)
    // =======================================================================
    it('flags player after 5+ abandonments in 1 hour', () => {
      const userId = 'serial-abandoner';

      for (let i = 0; i < 5; i++) {
        recordAbandonment(userId, `abandon-${i}`, 'opp', false, 1000);
        const start = Date.now();
        while (Date.now() - start < 60) { /* wait past grace period */ }
      }

      expect(isPlayerFlagged(userId)).toBe(true);
      expect(getFlagReason(userId)).toContain('Excessive abandonments');
    });
  });

  // =========================================================================
  // 17. clearPlayerFlag resets state
  // =========================================================================
  describe('clearPlayerFlag', () => {
    beforeEach(() => {
      initializeLeaderboardAntiCheat({
        abandonmentPenalty: 50,
        escalationMultiplier: 2.0,
        gracePeriodMs: 50,
      });
    });

    it('resets flag, reason, and abandonment count', () => {
      const userId = 'flagged-clear';

      for (let i = 0; i < 5; i++) {
        recordAbandonment(userId, `a-${i}`, 'opp', false, 1000);
        const start = Date.now();
        while (Date.now() - start < 60) { /* wait past grace period */ }
      }
      expect(isPlayerFlagged(userId)).toBe(true);

      clearPlayerFlag(userId);

      expect(isPlayerFlagged(userId)).toBe(false);
      expect(getFlagReason(userId)).toBeUndefined();

      const history = getPlayerMatchHistory(userId);
      expect(history!.abandonmentCount).toBe(0);
    });

    it('is a no-op for a nonexistent player', () => {
      expect(() => clearPlayerFlag('ghost-player')).not.toThrow();
    });
  });

  // =========================================================================
  // 18. submitPlayerReport self-report → rejected
  // =========================================================================
  describe('submitPlayerReport', () => {
    it('rejects self-reporting', () => {
      const result = submitPlayerReport('user-a', 'user-a', 'harassment');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot report yourself');
    });

    it('accepts a valid report from a different user', () => {
      const result = submitPlayerReport('reporter-1', 'reported-1', 'suspicious_win_rate');
      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
    });

    // =======================================================================
    // 19. Report cooldown enforcement
    // =======================================================================
    it('enforces report cooldown between submissions', () => {
      const first = submitPlayerReport('reporter-cd', 'target-1', 'win_trading');
      expect(first.success).toBe(true);

      // Immediate second report — should be rate-limited
      const second = submitPlayerReport('reporter-cd', 'target-2', 'harassment');
      expect(second.success).toBe(false);
      expect(second.error).toContain('Rate limit');
    });

    it('allows a report after the cooldown period expires', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      submitPlayerReport('reporter-exp', 'target-1', 'exploiting_bugs');

      // Advance past 5-minute cooldown
      jest.spyOn(Date, 'now').mockReturnValue(now + 301000);
      const second = submitPlayerReport('reporter-exp', 'target-2', 'other');
      expect(second.success).toBe(true);
    });

    it('stores optional matchId and additionalInfo', () => {
      const result = submitPlayerReport(
        'r-opt',
        't-opt',
        'match_manipulation',
        'match-abc',
        'They intentionally lost'
      );
      expect(result.success).toBe(true);

      const reports = getReportsForUser('t-opt');
      expect(reports).toHaveLength(1);
      expect(reports[0].matchId).toBe('match-abc');
      expect(reports[0].additionalInfo).toBe('They intentionally lost');
    });
  });

  // =========================================================================
  // 20. getReportsForUser returns reports for user
  // =========================================================================
  describe('getReportsForUser', () => {
    it('returns reports filed against a user', () => {
      submitPlayerReport('r-g1', 'target-user-g', 'harassment');
      submitPlayerReport('r-g2', 'target-user-g', 'exploiting_bugs');

      const reports = getReportsForUser('target-user-g');
      expect(reports.length).toBeGreaterThanOrEqual(2);
      expect(reports.every((r) => r.reportedUserId === 'target-user-g')).toBe(true);
    });

    it('returns reports filed by a user', () => {
      submitPlayerReport('prolific-reporter', 't-f1', 'win_trading');

      // Advance past cooldown
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 301000);
      submitPlayerReport('prolific-reporter', 't-f2', 'harassment');

      const reports = getReportsForUser('prolific-reporter');
      expect(reports.length).toBeGreaterThanOrEqual(2);
      expect(reports.every((r) => r.reporterId === 'prolific-reporter')).toBe(true);
    });

    it('returns an empty array for a user with no reports', () => {
      expect(getReportsForUser('no-reports-user')).toEqual([]);
    });

    it('sorts reports by timestamp descending', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      submitPlayerReport('sort-r1', 'sort-target', 'other');

      jest.spyOn(Date, 'now').mockReturnValue(now + 301000);
      submitPlayerReport('sort-r2', 'sort-target', 'other');

      const reports = getReportsForUser('sort-target');
      for (let i = 1; i < reports.length; i++) {
        expect(reports[i - 1].timestamp).toBeGreaterThanOrEqual(reports[i].timestamp);
      }
    });
  });
});
