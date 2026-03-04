import { registerRpcMetrics, getMetricsRegistry, recordRateLimitViolation, updateActiveUsersCount } from '../metrics';

// Mock dependencies - use correct path
jest.mock('../../config', () => ({
  config: {
    metrics: {
      namespace: 'test',
      prefix: 'test',
      prometheusPort: 9100,
    },
    rateLimit: {
      enabled: false,
    },
  },
}));

jest.mock('../../utils/rateLimiter', () => ({
  setMetricsCallbacks: jest.fn(),
  createRateLimitedRpcHandler: jest.fn(),
  setEndpointRateLimit: jest.fn(),
}));

jest.mock('prom-client', () => ({
  Registry: jest.fn().mockImplementation(() => ({
    metrics: jest.fn().mockResolvedValue('mock metrics'),
    contentType: 'text/plain',
  })),
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    startTimer: jest.fn().mockReturnValue(jest.fn()),
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
  })),
  collectDefaultMetrics: jest.fn(),
}));

describe('metrics', () => {
  describe('registerRpcMetrics', () => {
    it('should register metrics RPC', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };
      
      registerRpcMetrics(mockInitializer as any);
      
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/metrics',
        expect.any(Function)
      );
    });
  });

  describe('getMetricsRegistry', () => {
    it('should return metrics registry', () => {
      const registry = getMetricsRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('recordRateLimitViolation', () => {
    it('should record rate limit violation', () => {
      // Function should not throw
      expect(() => recordRateLimitViolation('test_rpc')).not.toThrow();
    });
  });

  describe('updateActiveUsersCount', () => {
    it('should update active users count', () => {
      // Function should not throw
      expect(() => updateActiveUsersCount(5)).not.toThrow();
    });
  });
});
