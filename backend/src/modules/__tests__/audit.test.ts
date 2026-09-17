import { logAudit, rpcQueryAuditLogs, recordAuditLogPersistFailure } from '../audit';

// Mock config and logger
jest.mock('../../config', () => ({
  config: {
    logger: {
      level: 'info',
      format: 'json',
      output: 'stdout',
      scrubLogs: false,
    },
  },
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Issue #1133: audit.ts declares its own persist-failure Counter locally
// (intentionally — see the comment in audit.ts — adding it to metrics.ts
// would close the audit ↔ admin_auth ↔ metrics import cycle). Mock
// prom-client so the Counter is observable without booting a real registry.
jest.mock('prom-client', () => {
  const inc = jest.fn();
  return {
    Counter: jest.fn().mockImplementation(() => ({ inc })),
    // Expose the shared `inc` so tests can assert on it.
    __mockCounterInc: inc,
  };
});

describe('logAudit', () => {
  let mockNk: any;
  let mockStorageWrite: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageWrite = jest.fn().mockReturnValue({});
    mockNk = { storageWrite: mockStorageWrite };
  });

  it('writes audit log on success', () => {
    logAudit(mockNk, 'user123', '127.0.0.1', 'gain_xp', 'stats', { amount: 100 }, 'success');

    expect(mockStorageWrite).toHaveBeenCalledTimes(1);
    const callArg = mockStorageWrite.mock.calls[0][0][0];
    expect(callArg.collection).toBe('audit_logs');
    expect(callArg.userId).toBe('user123');
    expect(callArg.key).toMatch(/^audit_/);
    const value = JSON.parse(callArg.value);
    expect(value.action).toBe('gain_xp');
    expect(value.resource).toBe('stats');
    expect(value.result).toBe('success');
    expect(value.details.amount).toBe(100);
  });

  it('includes error on failure', () => {
    logAudit(
      mockNk,
      'user456',
      null,
      'equip_gear',
      'gear',
      { gear_id: 'abc' },
      'failure',
      'Not found'
    );

    const callArg = mockStorageWrite.mock.calls[0][0][0];
    const value = JSON.parse(callArg.value);
    expect(value.result).toBe('failure');
    expect(value.error).toBe('Not found');
  });

  it('handles storageWrite failure gracefully', () => {
    // Import the logger after mocks are set up
    const { logger } = require('../../config/logger');
    // Capture the mocked Counter `inc` so we can assert the side-channel
    // (issue #1133) increments without booting a real Prometheus registry.
    const { __mockCounterInc: inc } = require('prom-client') as { __mockCounterInc: jest.Mock };

    mockNk.storageWrite = jest.fn(() => {
      throw new Error('DB error');
    });

    expect(() => logAudit(mockNk, 'user', null, 'test', 'res', {}, 'success')).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith('Failed to write audit log:', expect.any(Error));
    // Issue #1133: the failure must surface (boolean=false) AND increment the
    // side-channel counter so non-critical callers that ignore the return
    // value still leave a paper trail.
    expect(logAudit(mockNk, 'user', null, 'test', 'res', {}, 'success')).toBe(false);
    expect(inc).toHaveBeenCalled();
  });

  it('returns true on successful persist (issue #1133)', () => {
    expect(logAudit(mockNk, 'user', null, 'test', 'res', {}, 'success')).toBe(true);
  });

  it('does not increment the persist-failure counter on success', () => {
    const { __mockCounterInc: inc } = require('prom-client') as { __mockCounterInc: jest.Mock };
    inc.mockClear();
    expect(logAudit(mockNk, 'user', null, 'test', 'res', {}, 'success')).toBe(true);
    expect(inc).not.toHaveBeenCalled();
  });

  it('exposes recordAuditLogPersistFailure for callers that need to mark a drop explicitly', () => {
    // Smoke-test the public API so future refactors don't silently break it.
    expect(() => recordAuditLogPersistFailure()).not.toThrow();
  });

  it('generates unique keys for each log entry', () => {
    logAudit(mockNk, 'user', null, 'action1', 'res1', {}, 'success');
    logAudit(mockNk, 'user', null, 'action2', 'res2', {}, 'success');

    const key1 = mockStorageWrite.mock.calls[0][0][0].key;
    const key2 = mockStorageWrite.mock.calls[1][0][0].key;
    expect(key1).not.toBe(key2);
  });

  it('includes timestamp', () => {
    const before = Date.now();
    logAudit(mockNk, 'user', '127.0.0.1', 'action', 'resource', {}, 'success');
    const after = Date.now();

    const callArg = mockStorageWrite.mock.calls[0][0][0];
    const value = JSON.parse(callArg.value);
    expect(value.timestamp).toBeGreaterThanOrEqual(before);
    expect(value.timestamp).toBeLessThanOrEqual(after);
  });
});

describe('rpcQueryAuditLogs', () => {
  let mockNk: any;
  let mockStorageList: jest.Mock;
  let mockStorageWrite: jest.Mock;
  const callerId = 'user-a';
  const mockCtx = { userId: callerId, ipAddress: '127.0.0.1', variables: {} } as any;
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  function makeStorageObject(entry: Record<string, unknown>) {
    return {
      collection: 'audit_logs',
      key: `audit_${entry.timestamp}_${entry.user_id}_abc`,
      userId: entry.user_id as string,
      value: JSON.stringify(entry),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageList = jest.fn().mockReturnValue([]);
    mockStorageWrite = jest.fn().mockReturnValue({});
    mockNk = { storageList: mockStorageList, storageWrite: mockStorageWrite };
  });

  it('returns validation error for invalid payload', () => {
    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{"result":"invalid"}');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  it('returns empty logs when no entries exist', () => {
    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{}');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.logs).toEqual([]);
    expect(parsed.count).toBe(0);
  });

  it('scopes storageList to the caller when payload user_id matches the caller', () => {
    const result = rpcQueryAuditLogs(
      mockCtx,
      mockLogger as any,
      mockNk,
      `{"user_id":"${callerId}"}`
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(mockStorageList).toHaveBeenCalledWith(callerId, 'audit_logs', 50, '', '');
  });

  it('scopes queries with no user_id to the caller', () => {
    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{}');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(mockStorageList).toHaveBeenCalledWith(callerId, 'audit_logs', 50, '', '');
  });

  it('rejects a user_id belonging to another user and audit-logs the attempt', () => {
    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{"user_id":"user-b"}');
    const parsed = JSON.parse(result);

    // Rejected with a generic error, no entries returned.
    expect(parsed.success).toBe(false);
    expect(parsed.logs).toEqual([]);
    expect(parsed.count).toBe(0);
    // The victim's storage is never read.
    expect(mockStorageList).not.toHaveBeenCalled();
    expect(mockStorageList).not.toHaveBeenCalledWith('user-b', expect.anything(), expect.anything(), expect.anything(), expect.anything());

    // The attempt is recorded in the CALLER's audit trail (not the victim's).
    expect(mockStorageWrite).toHaveBeenCalledTimes(1);
    const callArg = mockStorageWrite.mock.calls[0][0][0];
    expect(callArg.collection).toBe('audit_logs');
    expect(callArg.userId).toBe(callerId);
    const value = JSON.parse(callArg.value);
    expect(value.user_id).toBe(callerId);
    expect(value.action).toBe('query_audit_logs');
    expect(value.result).toBe('failure');
    expect(value.details.requested_user_id).toBe('user-b');
    expect(value.details.reason).toBe('cross_user_access_denied');

    // The client-facing response must not echo the target or any internals.
    expect(result).not.toContain('user-b');
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('returns logs filtered by action', () => {
    const entries = [
      makeStorageObject({
        timestamp: 1000,
        user_id: 'user1',
        action: 'webhook_purchase',
        resource: 'gems',
        details: {},
        result: 'success',
      }),
      makeStorageObject({
        timestamp: 2000,
        user_id: 'user1',
        action: 'spend_gems',
        resource: 'gems',
        details: {},
        result: 'success',
      }),
    ];
    mockStorageList.mockReturnValue(entries);

    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{"action":"spend_gems"}');
    const parsed = JSON.parse(result);
    expect(parsed.logs).toHaveLength(1);
    expect(parsed.logs[0].action).toBe('spend_gems');
  });

  it('returns logs filtered by result', () => {
    const entries = [
      makeStorageObject({
        timestamp: 1000,
        user_id: 'user1',
        action: 'purchase',
        resource: 'gems',
        details: {},
        result: 'success',
      }),
      makeStorageObject({
        timestamp: 2000,
        user_id: 'user1',
        action: 'purchase',
        resource: 'gems',
        details: {},
        result: 'failure',
      }),
    ];
    mockStorageList.mockReturnValue(entries);

    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{"result":"failure"}');
    const parsed = JSON.parse(result);
    expect(parsed.logs).toHaveLength(1);
    expect(parsed.logs[0].result).toBe('failure');
  });

  it('returns logs filtered by date range', () => {
    const entries = [
      makeStorageObject({
        timestamp: 1000,
        user_id: 'user1',
        action: 'purchase',
        resource: 'gems',
        details: {},
        result: 'success',
      }),
      makeStorageObject({
        timestamp: 2000,
        user_id: 'user1',
        action: 'purchase',
        resource: 'gems',
        details: {},
        result: 'success',
      }),
      makeStorageObject({
        timestamp: 3000,
        user_id: 'user1',
        action: 'purchase',
        resource: 'gems',
        details: {},
        result: 'success',
      }),
    ];
    mockStorageList.mockReturnValue(entries);

    const result = rpcQueryAuditLogs(
      mockCtx,
      mockLogger as any,
      mockNk,
      '{"from_timestamp":1500,"to_timestamp":2500}'
    );
    const parsed = JSON.parse(result);
    expect(parsed.logs).toHaveLength(1);
    expect(parsed.logs[0].timestamp).toBe(2000);
  });

  it('handles storageList failure gracefully', () => {
    mockStorageList.mockImplementation(() => {
      throw new Error('Storage error');
    });

    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{}');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Failed to query audit logs');
  });

  it('respects limit parameter', () => {
    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{"limit":25}');
    expect(mockStorageList).toHaveBeenCalledWith(
      expect.anything(),
      'audit_logs',
      25,
      expect.anything(),
      expect.anything()
    );
  });

  it('uses default limit of 50', () => {
    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{}');
    expect(mockStorageList).toHaveBeenCalledWith(
      expect.anything(),
      'audit_logs',
      50,
      expect.anything(),
      expect.anything()
    );
  });

  it('passes cursor to storageList', () => {
    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{"cursor":"next_page"}');
    expect(mockStorageList).toHaveBeenCalledWith(
      expect.anything(),
      'audit_logs',
      50,
      'next_page',
      expect.anything()
    );
  });

  it('skips malformed entries', () => {
    const entries = [
      { collection: 'audit_logs', key: 'bad', userId: 'user1', value: 'not-json' },
      makeStorageObject({
        timestamp: 1000,
        user_id: 'user1',
        action: 'purchase',
        resource: 'gems',
        details: {},
        result: 'success',
      }),
    ];
    mockStorageList.mockReturnValue(entries);

    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{}');
    const parsed = JSON.parse(result);
    expect(parsed.logs).toHaveLength(1);
    expect(parsed.count).toBe(1);
  });
});
