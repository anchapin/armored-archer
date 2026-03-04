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

    const result = verifyRequestSignature(mockContext, payload, { requestId, timestamp, signature, nonce }, 'test_rpc');

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('verifyRequestSignature detects invalid signatures', () => {
    const payload = '{"angle":1.57}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();
    const badSignature = 'a'.repeat(64);

    const result = verifyRequestSignature(mockContext, payload, { requestId, timestamp, signature: badSignature, nonce }, 'test_rpc');

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.violationType === 'invalid_signature')).toBe(true);
  });

  test('verifyRequestSignature detects replay attacks', () => {
    const payload = '{"angle":1.57}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now();
    const signature = computeSignature(payload, timestamp, nonce);

    // First submission should pass
    const result1 = verifyRequestSignature(mockContext, payload, { requestId, timestamp, signature, nonce }, 'test_rpc');
    expect(result1.valid).toBe(true);

    // Same request should be detected as replay
    const result2 = verifyRequestSignature(mockContext, payload, { requestId, timestamp, signature, nonce }, 'test_rpc');
    expect(result2.valid).toBe(false);
    expect(result2.violations.some((v) => v.violationType === 'replay_attack')).toBe(true);
  });

  test('verifyRequestSignature detects clock skew', () => {
    const payload = '{"angle":1.57}';
    const { requestId, nonce } = generateRequestIdAndNonce();
    const timestamp = Date.now() - 10000;
    const signature = computeSignature(payload, timestamp, nonce);

    const result = verifyRequestSignature(mockContext, payload, { requestId, timestamp, signature, nonce }, 'test_rpc');

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.violationType === 'clock_skew')).toBe(true);
  });

  test('validateCombatActionParameters accepts valid parameters', () => {
    const result = validateCombatActionParameters(1.57, 0.8, 'player-1', 'player-1', 'submit_combat_action', 'req-id');

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('validateCombatActionParameters rejects invalid angle', () => {
    const result = validateCombatActionParameters(-0.5, 0.8, 'player-1', 'player-1', 'submit_combat_action', 'req-id');

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.details.parameterName === 'angle')).toBe(true);
  });

  test('validateCombatActionParameters accepts valid combat action', () => {
    // Pass correct currentTurnUserId to avoid out_of_turn violation
    const result = validateCombatActionParameters(1.57, 0.8, 'player-1', 'player-1', 'submit_combat_action', 'req-id');

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
    const sigResult = verifyRequestSignature(mockContext, payload, { requestId, timestamp, signature, nonce }, 'submit_combat_action');
    expect(sigResult.valid).toBe(true);

    // Step 2: Validate parameters
    const paramResult = validateCombatActionParameters(1.57, 0.8, mockContext.userId, mockContext.userId, 'submit_combat_action', requestId);
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
    const result1 = verifyRequestSignature(mockContext, payload, requestSig, 'submit_combat_action');
    expect(result1.valid).toBe(true);

    // Replay attempt
    const result2 = verifyRequestSignature(mockContext, payload, requestSig, 'submit_combat_action');
    expect(result2.valid).toBe(false);
    expect(violations.some((v) => v.violationType === 'replay_attack')).toBe(true);
  });
});
