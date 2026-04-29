import { logAudit, rpcQueryAuditLogs } from '../audit';

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

    mockNk.storageWrite = jest.fn(() => {
      throw new Error('DB error');
    });

    expect(() => logAudit(mockNk, 'user', null, 'test', 'res', {}, 'success')).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith('Failed to write audit log:', expect.any(Error));
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
  const mockCtx = { userId: 'admin', ipAddress: '127.0.0.1', variables: {} } as any;
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
    mockNk = { storageList: mockStorageList };
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

  it('passes user_id to storageList for server-side filtering', () => {
    const result = rpcQueryAuditLogs(mockCtx, mockLogger as any, mockNk, '{"user_id":"user1"}');
    expect(mockStorageList).toHaveBeenCalledWith('user1', 'audit_logs', 50, '', '');
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
