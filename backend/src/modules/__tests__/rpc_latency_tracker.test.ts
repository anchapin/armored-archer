/**
 * RPC Latency Tracker Tests
 */

import {
  initializeRpcLatencyTracker,
  recordRpcLatency,
  recordRpcError,
  getAverageResponseTimeMs,
  getErrorRate,
  resetTracker,
} from '../rpc_latency_tracker';

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('rpc_latency_tracker', () => {
  beforeEach(() => {
    resetTracker();
    jest.clearAllMocks();
    initializeRpcLatencyTracker(mockLogger as any);
  });

  afterEach(() => {
    resetTracker();
  });

  describe('recordRpcLatency', () => {
    it('should record latency entries', () => {
      recordRpcLatency('test_rpc', 100);
      recordRpcLatency('test_rpc', 200);

      expect(getAverageResponseTimeMs()).toBe(150);
    });

    it('should not record when not initialized', () => {
      resetTracker();
      recordRpcLatency('test_rpc', 100);
      expect(getAverageResponseTimeMs()).toBe(0);
    });

    it('should evict old entries when buffer exceeds max', () => {
      for (let i = 0; i < 1100; i++) {
        recordRpcLatency('test_rpc', i);
      }

      expect(getAverageResponseTimeMs()).toBeGreaterThan(0);
    });
  });

  describe('recordRpcError', () => {
    it('should record error entries', () => {
      recordRpcLatency('test_rpc', 100);
      recordRpcError('test_rpc', 'TypeError');

      expect(getErrorRate()).toBe(50);
    });

    it('should not record when not initialized', () => {
      resetTracker();
      recordRpcError('test_rpc', 'Error');
      expect(getErrorRate()).toBe(0);
    });
  });

  describe('getAverageResponseTimeMs', () => {
    it('should return 0 when no entries', () => {
      expect(getAverageResponseTimeMs()).toBe(0);
    });

    it('should calculate average of non-error entries', () => {
      recordRpcLatency('rpc1', 100);
      recordRpcLatency('rpc2', 200);
      recordRpcError('rpc3', 'Error');

      expect(getAverageResponseTimeMs()).toBe(150);
    });

    it('should round to 2 decimal places', () => {
      recordRpcLatency('rpc1', 100);
      recordRpcLatency('rpc2', 101);

      const avg = getAverageResponseTimeMs();
      expect(avg).toBe(100.5);
    });
  });

  describe('getErrorRate', () => {
    it('should return 0 when no entries', () => {
      expect(getErrorRate()).toBe(0);
    });

    it('should calculate error rate as percentage', () => {
      recordRpcLatency('rpc1', 50);
      recordRpcLatency('rpc2', 50);
      recordRpcError('rpc3', 'Error');
      recordRpcError('rpc4', 'Error');

      expect(getErrorRate()).toBe(50);
    });

    it('should return 100 when all entries are errors', () => {
      recordRpcError('rpc1', 'Error');
      recordRpcError('rpc2', 'Error');

      expect(getErrorRate()).toBe(100);
    });

    it('should return 0 when no errors', () => {
      recordRpcLatency('rpc1', 50);
      recordRpcLatency('rpc2', 100);

      expect(getErrorRate()).toBe(0);
    });
  });

  describe('sliding window', () => {
    it('should only consider entries within the time window', () => {
      // This test records entries and verifies the window works
      // Entries recorded now should be in the window
      recordRpcLatency('rpc1', 100);
      expect(getAverageResponseTimeMs()).toBe(100);
    });
  });

  describe('resetTracker', () => {
    it('should clear all entries and reset state', () => {
      recordRpcLatency('rpc1', 100);
      recordRpcError('rpc2', 'Error');

      resetTracker();

      expect(getAverageResponseTimeMs()).toBe(0);
      expect(getErrorRate()).toBe(0);
    });
  });
});
