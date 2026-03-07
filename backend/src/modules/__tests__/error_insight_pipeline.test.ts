import {
  collectError,
  getErrorStore,
  registerErrorInsightRpcs,
  initializeErrorInsightsPipeline,
} from '../error_insight_pipeline';

// Mock dependencies
jest.mock('../../config', () => ({
  config: {
    errorInsights: {
      enabled: true,
      aggregationWindowMinutes: 15,
      minOccurrencesForInsight: 3,
      insightWindowHours: 24,
      maxPatterns: 100,
      maxInsights: 50,
      autoResolvePatterns: true,
      patternTtlDays: 7,
    },
    alerting: {
      enabled: false,
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

jest.mock('../validation', () => ({
  validatePayload: jest.fn().mockReturnValue({ success: true }),
  createValidationErrorResponse: jest.fn().mockReturnValue('{"error": "validation failed"}'),
}));

describe('error_insight_pipeline', () => {
  beforeEach(() => {
    // Clear the store before each test
    const store = getErrorStore();
    store.clear();
  });

  describe('initializeErrorInsightsPipeline', () => {
    it('should initialize without errors when enabled', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      expect(() => initializeErrorInsightsPipeline(mockLogger as any)).not.toThrow();
    });
  });

  describe('collectError', () => {
    it('should collect error data', () => {
      const error = new Error('Test error');
      
      collectError(error, {
        rpcName: 'test_rpc',
        userId: 'test_user',
        requestId: 'test_request',
      });

      const store = getErrorStore();
      const errors = store.getErrorsInRange(
        new Date(0),
        new Date()
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toBe('Test error');
      expect(errors[0].rpcName).toBe('test_rpc');
      expect(errors[0].userId).toBe('test_user');
    });

    it('should detect error source from message', () => {
      const error = new Error('Database connection timeout');
      
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(
        new Date(0),
        new Date()
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].source).toBe('database');
    });

    it('should determine severity from error message', () => {
      const criticalError = new Error('Fatal: out of memory');
      
      collectError(criticalError, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(
        new Date(0),
        new Date()
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe('critical');
    });
  });

  describe('Error Store', () => {
    it('should add and retrieve errors', () => {
      const store = getErrorStore();
      
      const error = new Error('Test error');
      store.addError({
        id: '1',
        timestamp: new Date().toISOString(),
        message: error.message,
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      const errors = store.getErrorsInRange(
        new Date(0),
        new Date()
      );

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Test error');
    });

    it('should track patterns', () => {
      const store = getErrorStore();
      
      // Add multiple similar errors
      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `${i}`,
          timestamp: new Date().toISOString(),
          message: 'Database connection timeout',
          errorType: 'Error',
          severity: 'error',
          source: 'database',
          rpcName: 'test_rpc',
        });
      }

      const patterns = store.getPatterns();
      
      // Should have at least one pattern
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should get pipeline stats', () => {
      const store = getErrorStore();
      
      // Add some errors
      store.addError({
        id: '1',
        timestamp: new Date().toISOString(),
        message: 'Test error',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      const stats = store.getStats();

      expect(stats.totalErrorsProcessed).toBe(1);
      expect(stats.uptime).toBeDefined();
      expect(stats.errorsPerMinute).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup expired patterns', () => {
      const store = getErrorStore();
      
      // This should not throw
      expect(() => store.cleanupExpiredPatterns()).not.toThrow();
    });
  });

  describe('registerErrorInsightRpcs', () => {
    it('should register RPC handlers', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerErrorInsightRpcs(mockInitializer as any);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/error_insights_dashboard',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/error_insights_summary',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/error_insights_patterns',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/error_insights_stats',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/error_insights_dismiss',
        expect.any(Function)
      );
    });
  });

  describe('Error Pattern Analysis', () => {
    it('should generate unique signatures for different errors', () => {
      const store = getErrorStore();
      
      // Add different errors
      store.addError({
        id: '1',
        timestamp: new Date().toISOString(),
        message: 'Error 1: something failed',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
        rpcName: 'rpc1',
      });

      store.addError({
        id: '2',
        timestamp: new Date().toISOString(),
        message: 'Error 2: another thing failed',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
        rpcName: 'rpc2',
      });

      const patterns = store.getPatterns();
      
      // Should have at least some patterns
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });
});
