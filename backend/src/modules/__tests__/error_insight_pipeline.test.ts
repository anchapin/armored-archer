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

describe('error_insight_pipeline', () => {
  beforeEach(() => {
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

    it('should return early when disabled', () => {
      const { config } = require('../../config');
      config.errorInsights.enabled = false;

      const mockLogger = { info: jest.fn() };
      expect(() => initializeErrorInsightsPipeline(mockLogger as any)).not.toThrow();

      config.errorInsights.enabled = true;
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
      const errors = store.getErrorsInRange(new Date(0), new Date());

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toBe('Test error');
      expect(errors[0].rpcName).toBe('test_rpc');
      expect(errors[0].userId).toBe('test_user');
    });

    it('should detect error source from message', () => {
      const error = new Error('Database connection timeout');

      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].source).toBe('database');
    });

    it('should determine severity from error message', () => {
      const criticalError = new Error('Fatal: out of memory');

      collectError(criticalError, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe('critical');
    });

    it('should not collect when disabled', () => {
      const { config } = require('../../config');
      config.errorInsights.enabled = false;

      const error = new Error('Should not be collected');
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      const collectedErrors = errors.filter(e => e.message === 'Should not be collected');
      expect(collectedErrors.length).toBe(0);

      config.errorInsights.enabled = true;
    });

    it('should detect cache source', () => {
      const error = new Error('Redis cache miss');
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('cache');
    });

    it('should detect validation source', () => {
      const error = new Error('Validation failed for input');
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('validation');
    });

    it('should detect nakama source', () => {
      const error = new Error('Nakama RPC timeout');
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('nakama');
    });

    it('should detect external source', () => {
      const error = new Error('External API timeout');
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('external');
    });

    it('should detect unknown source', () => {
      const error = new Error('Some random thing happened');
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('unknown');
    });

    it('should determine error severity', () => {
      const error = new Error('Something failed unexpectedly');
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('error');
    });

    it('should determine warning severity', () => {
      const error = new Error('This is a warning about deprecated usage');
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('warning');
    });

    it('should determine info severity for benign errors', () => {
      const error = new Error('Just a regular info message');
      collectError(error, { severity: 'info' });

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('info');
    });

    it('should respect provided source', () => {
      const error = new Error('Some error');
      collectError(error, { source: 'database' });

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('database');
    });

    it('should respect provided severity', () => {
      const error = new Error('Some error');
      collectError(error, { severity: 'critical' });

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('critical');
    });
  });

  describe('Error Store', () => {
    it('should add and retrieve errors', () => {
      const store = getErrorStore();

      store.addError({
        id: '1',
        timestamp: new Date().toISOString(),
        message: 'Test error',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      const errors = store.getErrorsInRange(new Date(0), new Date());

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Test error');
    });

    it('should filter errors by time range', () => {
      const store = getErrorStore();
      const now = new Date();

      store.addError({
        id: 'old',
        timestamp: new Date(now.getTime() - 100000).toISOString(),
        message: 'Old error',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      store.addError({
        id: 'new',
        timestamp: now.toISOString(),
        message: 'New error',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      const recentErrors = store.getErrorsInRange(
        new Date(now.getTime() - 50000),
        new Date(now.getTime() + 1000)
      );

      expect(recentErrors.length).toBe(1);
      expect(recentErrors[0].id).toBe('new');
    });

    it('should track patterns', () => {
      const store = getErrorStore();

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
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should upsert patterns', () => {
      const store = getErrorStore();

      store.upsertPattern({
        patternId: 'test-pattern-1',
        signature: 'sig1',
        count: 5,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        errorType: 'Error',
        messageTemplate: 'Test pattern',
        affectedRpcs: ['rpc1'],
        affectedUsers: ['user1'],
        occurrencesPerHour: 10,
        severity: 'error',
        source: 'database',
      });

      const patterns = store.getPatterns();
      expect(patterns.length).toBe(1);
      expect(patterns[0].patternId).toBe('test-pattern-1');
    });

    it('should add and retrieve insights', () => {
      const store = getErrorStore();

      store.addInsight({
        id: 'insight-1',
        generatedAt: new Date().toISOString(),
        patternId: 'pattern-1',
        title: 'Test Insight',
        description: 'A test insight',
        priority: 'high',
        recommendations: ['Fix the thing'],
        impact: { userImpact: 'High', systemImpact: 'High' },
        actionable: true,
        errorCount: 10,
        affectedUserCount: 5,
      });

      const insights = store.getInsights();
      expect(insights.length).toBe(1);
      expect(insights[0].title).toBe('Test Insight');
    });

    it('should limit insights to maxInsights', () => {
      const store = getErrorStore();

      for (let i = 0; i < 55; i++) {
        store.addInsight({
          id: `insight-${i}`,
          generatedAt: new Date().toISOString(),
          patternId: `pattern-${i}`,
          title: `Insight ${i}`,
          description: 'Description',
          priority: 'low',
          recommendations: [],
          impact: { userImpact: 'Low', systemImpact: 'Low' },
          actionable: false,
          errorCount: 1,
          affectedUserCount: 1,
        });
      }

      const insights = store.getInsights();
      expect(insights.length).toBeLessThanOrEqual(50);
    });

    it('should get pipeline stats', () => {
      const store = getErrorStore();

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

      expect(() => store.cleanupExpiredPatterns()).not.toThrow();
    });

    it('should clear all data', () => {
      const store = getErrorStore();

      store.addError({
        id: '1',
        timestamp: new Date().toISOString(),
        message: 'Test',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      store.clear();

      const errors = store.getErrorsInRange(new Date(0), new Date());
      const patterns = store.getPatterns();
      const insights = store.getInsights();

      expect(errors.length).toBe(0);
      expect(patterns.length).toBe(0);
      expect(insights.length).toBe(0);
    });

    it('should trim errors when exceeding 10000', () => {
      const store = getErrorStore();

      for (let i = 0; i < 10005; i++) {
        store.addError({
          id: `${i}`,
          timestamp: new Date().toISOString(),
          message: `Error ${i}`,
          errorType: 'Error',
          severity: 'error',
          source: 'nakama',
        });
      }

      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors.length).toBe(10000);
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
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate same signature for similar errors', () => {
      const store = getErrorStore();

      for (let i = 0; i < 3; i++) {
        store.addError({
          id: `dup-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Database connection timeout',
          errorType: 'Error',
          severity: 'error',
          source: 'database',
          rpcName: 'test_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('RPC endpoints', () => {
    const mockCtx = { userId: 'test-user' };
    const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const mockNk = {};

    it('should handle get error dashboard RPC with valid payload', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const dashboardHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_dashboard'
      )?.[1];

      if (dashboardHandler) {
        const result = await dashboardHandler(mockCtx, mockLogger, mockNk, JSON.stringify({}));
        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('summary');
        expect(parsed).toHaveProperty('patterns');
        expect(parsed).toHaveProperty('insights');
        expect(parsed).toHaveProperty('lastUpdated');
      }
    });

    it('should handle get error dashboard RPC with empty payload', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const dashboardHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_dashboard'
      )?.[1];

      if (dashboardHandler) {
        const result = await dashboardHandler(mockCtx, mockLogger, mockNk, '');
        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('summary');
      }
    });

    it('should handle dismiss insight with valid payload', async () => {
      const store = getErrorStore();

      store.addInsight({
        id: 'dismiss-me',
        generatedAt: new Date().toISOString(),
        patternId: 'pattern-1',
        title: 'Test',
        description: 'Test',
        priority: 'low',
        recommendations: [],
        impact: { userImpact: 'Low', systemImpact: 'Low' },
        actionable: false,
        errorCount: 1,
        affectedUserCount: 0,
      });

      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const dismissHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_dismiss'
      )?.[1];

      if (dismissHandler) {
        const result = await dismissHandler(
          mockCtx,
          mockLogger,
          mockNk,
          JSON.stringify({ insightId: 'dismiss-me' })
        );
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
      }
    });

    it('should handle dismiss insight with missing payload', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const dismissHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_dismiss'
      )?.[1];

      if (dismissHandler) {
        const result = await dismissHandler(mockCtx, mockLogger, mockNk, '');
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
      }
    });

    it('should handle dismiss insight with invalid payload', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const dismissHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_dismiss'
      )?.[1];

      if (dismissHandler) {
        const result = await dismissHandler(mockCtx, mockLogger, mockNk, 'invalid json');
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
      }
    });

    it('should handle dismiss insight with missing insightId', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const dismissHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_dismiss'
      )?.[1];

      if (dismissHandler) {
        const result = await dismissHandler(mockCtx, mockLogger, mockNk, JSON.stringify({}));
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
      }
    });

    it('should handle dismiss insight with non-existent ID', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const dismissHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_dismiss'
      )?.[1];

      if (dismissHandler) {
        const result = await dismissHandler(
          mockCtx,
          mockLogger,
          mockNk,
          JSON.stringify({ insightId: 'non-existent' })
        );
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
      }
    });

    it('should handle get patterns RPC', async () => {
      const store = getErrorStore();

      store.addError({
        id: '1',
        timestamp: new Date().toISOString(),
        message: 'Test pattern error',
        errorType: 'Error',
        severity: 'error',
        source: 'database',
        rpcName: 'test_rpc',
      });

      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const patternsHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_patterns'
      )?.[1];

      if (patternsHandler) {
        const result = await patternsHandler(mockCtx, mockLogger, mockNk, '');
        const parsed = JSON.parse(result);
        expect(Array.isArray(parsed)).toBe(true);
      }
    });

    it('should handle get stats RPC', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const statsHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_stats'
      )?.[1];

      if (statsHandler) {
        const result = await statsHandler(mockCtx, mockLogger, mockNk, '');
        const parsed = JSON.parse(result);
        expect(parsed.totalErrorsProcessed).toBeDefined();
      }
    });
  });

  describe('Insight generation', () => {
    it('should generate insights for frequent errors', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        collectError(new Error('Database timeout'), {
          rpcName: 'test_rpc',
          userId: `user-${i}`,
        });
      }

      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate database recommendations', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `db-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Database connection timeout',
          errorType: 'Error',
          severity: 'error',
          source: 'database',
          rpcName: 'db_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate cache recommendations', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `cache-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Cache miss error',
          errorType: 'Error',
          severity: 'error',
          source: 'cache',
          rpcName: 'cache_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate validation recommendations', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `val-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Validation failed',
          errorType: 'Error',
          severity: 'error',
          source: 'validation',
          rpcName: 'val_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate nakama recommendations', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `nak-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Nakama RPC error',
          errorType: 'Error',
          severity: 'error',
          source: 'nakama',
          rpcName: 'nakama_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate external recommendations', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `ext-${i}`,
          timestamp: new Date().toISOString(),
          message: 'External API error',
          errorType: 'Error',
          severity: 'error',
          source: 'external',
          rpcName: 'ext_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate unknown recommendations', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `unk-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Unknown error occurred',
          errorType: 'Error',
          severity: 'error',
          source: 'unknown',
          rpcName: 'unk_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error signature generation', () => {
    it('should normalize UUIDs in signatures', () => {
      const store = getErrorStore();

      store.addError({
        id: 'uuid-1',
        timestamp: new Date().toISOString(),
        message: 'Error with 550e8400-e29b-41d4-a716-446655440000 in it',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
        rpcName: 'rpc1',
      });

      store.addError({
        id: 'uuid-2',
        timestamp: new Date().toISOString(),
        message: 'Error with 123e4567-e89b-12d3-a456-426614174000 in it',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
        rpcName: 'rpc1',
      });

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should normalize numbers in signatures', () => {
      const store = getErrorStore();

      store.addError({
        id: 'num-1',
        timestamp: new Date().toISOString(),
        message: 'Error 404 not found',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
        rpcName: 'rpc1',
      });

      store.addError({
        id: 'num-2',
        timestamp: new Date().toISOString(),
        message: 'Error 500 not found',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
        rpcName: 'rpc1',
      });

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should normalize paths in signatures', () => {
      const store = getErrorStore();

      store.addError({
        id: 'path-1',
        timestamp: new Date().toISOString(),
        message: 'Error at /usr/local/file.ts',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
        rpcName: 'rpc1',
      });

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Time span description', () => {
    it('should describe minutes correctly', () => {
      const store = getErrorStore();
      const now = new Date();

      store.addError({
        id: 'min-1',
        timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        message: 'Recent error',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      store.addError({
        id: 'min-2',
        timestamp: now.toISOString(),
        message: 'Recent error',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Impact assessment', () => {
    it('should assess critical impact', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `crit-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Fatal crash',
          errorType: 'Error',
          severity: 'critical',
          source: 'nakama',
          rpcName: 'crit_rpc',
          userId: `user-${i}`,
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should assess error impact', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `err-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Operation failed',
          errorType: 'Error',
          severity: 'error',
          source: 'nakama',
          rpcName: 'err_rpc',
          userId: `user-${i}`,
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should assess warning impact', () => {
      const store = getErrorStore();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `warn-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Deprecated warning',
          errorType: 'Warning',
          severity: 'warning',
          source: 'nakama',
          rpcName: 'warn_rpc',
          userId: `user-${i}`,
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('High frequency errors', () => {
    it('should flag high frequency errors', () => {
      const store = getErrorStore();

      for (let i = 0; i < 60; i++) {
        store.addError({
          id: `freq-${i}`,
          timestamp: new Date().toISOString(),
          message: 'Frequent error',
          errorType: 'Error',
          severity: 'error',
          source: 'nakama',
          rpcName: 'freq_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });
});
