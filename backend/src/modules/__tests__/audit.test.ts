import { logAudit } from '../audit';

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
