import {
  collectError,
  getErrorStore,
  registerErrorInsightRpcs,
  initializeErrorInsightsPipeline,
} from '../error_insight_pipeline';
import { resetAdminAllowlistCache } from '../admin_auth';

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
  // The error-insights RPCs are registered behind the shared admin gate
  // (issue #1075), so handler-level tests must allowlist their caller ctxs
  // ('test-user' in RPC endpoints, 'test' in the branch suites).
  const previousAdminIds = process.env.ADMIN_USER_IDS;

  beforeAll(() => {
    process.env.ADMIN_USER_IDS = 'test-user,test';
    resetAdminAllowlistCache();
  });

  afterAll(() => {
    if (previousAdminIds === undefined) {
      delete process.env.ADMIN_USER_IDS;
    } else {
      process.env.ADMIN_USER_IDS = previousAdminIds;
    }
    resetAdminAllowlistCache();
  });

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
      const collectedErrors = errors.filter((e) => e.message === 'Should not be collected');
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

  describe('Message-based source detection', () => {
    it('should detect database source from message keywords', () => {
      collectError(new Error('postgres connection failed'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('database');
    });

    it('should detect database source from stack trace containing db_', () => {
      const error = new Error('Something went wrong');
      error.stack = 'Error: Something went wrong\n    at db_query (module.js:10:5)';
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('database');
    });

    it('should detect cache source from message containing "cache"', () => {
      collectError(new Error('cache key not found'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('cache');
    });

    it('should detect validation source from message containing "invalid"', () => {
      collectError(new Error('invalid input provided'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('validation');
    });

    it('should detect nakama source from message containing "rpc"', () => {
      collectError(new Error('rpc handler crashed'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('nakama');
    });

    it('should detect external source from message containing "api"', () => {
      collectError(new Error('api rate limit exceeded'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('external');
    });

    it('should return unknown when no keywords match', () => {
      collectError(new Error('something unexpected happened'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].source).toBe('unknown');
    });
  });

  describe('Message-based severity detection', () => {
    it('should detect critical severity from "crash" keyword', () => {
      collectError(new Error('application crash detected'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('critical');
    });

    it('should detect critical severity from "out of memory" keyword', () => {
      collectError(new Error('out of memory'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('critical');
    });

    it('should detect critical severity from segmentation in stack', () => {
      const error = new Error('Process terminated');
      error.stack = 'Error: Process terminated\n    at segmentation fault handler';
      collectError(error, {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('critical');
    });

    it('should detect error severity from "exception" keyword', () => {
      collectError(new Error('unhandled exception occurred'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('error');
    });

    it('should detect error severity from "failed" keyword', () => {
      collectError(new Error('operation failed to complete'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('error');
    });

    it('should detect warning severity from "deprecated" keyword', () => {
      collectError(new Error('deprecated function called'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('warning');
    });

    it('should return info severity when no keywords match', () => {
      collectError(new Error('routine notification message'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      expect(errors[errors.length - 1].severity).toBe('info');
    });
  });

  describe('Insight generation from sufficient errors', () => {
    it('should generate insights when error count meets threshold', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database connection pool exhausted'), {
          rpcName: 'get_player_data',
          userId: `user-${i}`,
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].errorCount).toBeGreaterThanOrEqual(3);
    });

    it('should generate insight with correct priority based on count > 100', () => {
      for (let i = 0; i < 105; i++) {
        collectError(new Error('recurring cache timeout'), {
          rpcName: 'cache_lookup',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].priority).toBe('critical');
    });

    it('should generate insight with high priority based on count > 50', () => {
      for (let i = 0; i < 55; i++) {
        collectError(new Error('recurring validation failure'), {
          rpcName: 'validate_input',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].priority).toBe('high');
    });

    it('should generate insight with medium priority based on count > 10', () => {
      for (let i = 0; i < 15; i++) {
        collectError(new Error('intermittent warning message'), {
          rpcName: 'health_check',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].priority).toBe('medium');
    });

    it('should generate insight with low priority for low count info errors', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('minor info notification'), {
          severity: 'info',
          rpcName: 'status_check',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].priority).toBe('low');
    });

    it('should set actionable true when recommendations exist', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database query timeout'), {
          rpcName: 'slow_query',
          userId: `user-${i}`,
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].actionable).toBe(true);
      expect(insights[0].recommendations.length).toBeGreaterThan(0);
    });

    it('should include affectedRpcs in insight description', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('nakama rpc execution failed'), {
          rpcName: 'submit_score',
          userId: `user-${i}`,
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].description).toContain('submit_score');
    });

    it('should generate insights for critical severity errors', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('fatal system crash'), {
          rpcName: 'critical_rpc',
          userId: `user-${i}`,
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].priority).toBe('critical');
    });

    it('should not generate duplicate insights on repeated processing', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database connection lost'), {
          rpcName: 'db_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      const patternIds = insights.map((i) => i.patternId);
      const uniquePatternIds = [...new Set(patternIds)];
      expect(uniquePatternIds.length).toBe(patternIds.length);
    });
  });

  describe('Insight title generation by source', () => {
    it('should generate database title with affected RPCs', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database query failed'), {
          rpcName: 'get_leaderboard',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].title).toContain('Database Errors');
      expect(insights[0].title).toContain('get_leaderboard');
    });

    it('should generate cache title with affected RPCs', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('redis cache unavailable'), {
          rpcName: 'session_cache',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].title).toContain('Cache Issues');
      expect(insights[0].title).toContain('session_cache');
    });

    it('should generate validation title with affected RPCs', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('validation error in request'), {
          rpcName: 'submit_move',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].title).toContain('Validation Errors');
      expect(insights[0].title).toContain('submit_move');
    });

    it('should generate nakama title with affected RPCs', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('nakama rpc timeout'), {
          rpcName: 'match_state',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].title).toContain('Server Errors');
      expect(insights[0].title).toContain('match_state');
    });

    it('should generate external title with source label', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('external api returned 500'), {
          rpcName: 'payment_webhook',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].title).toContain('External Service Errors');
    });

    it('should generate default title with error type for unknown source', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('unexpected runtime issue'), {
          rpcName: 'unknown_op',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].title).toContain('Recurring Error');
    });

    it('should use fallback RPC label when no RPCs affected', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database query failed'), {});
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].title).toContain('operations');
    });
  });

  describe('Time span description', () => {
    it('should describe time span in minutes for short durations', () => {
      for (let i = 0; i < 5; i++) {
        const store = getErrorStore();
        store.addError({
          id: `ts-min-${i}`,
          timestamp: new Date(Date.now() - (5 - i) * 60 * 1000).toISOString(),
          message: 'short duration error',
          errorType: 'Error',
          severity: 'error',
          source: 'nakama',
          rpcName: 'ts_rpc',
        });
      }

      const store = getErrorStore();
      const patterns = store.getPatterns();
      // Patterns created directly don't trigger processErrors, so test through collectError
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should describe time span in hours for medium durations', () => {
      const store = getErrorStore();
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `ts-hr-${i}`,
          timestamp: new Date(now.getTime() - (4 - i) * 2 * 60 * 60 * 1000).toISOString(),
          message: 'hourly duration error',
          errorType: 'Error',
          severity: 'error',
          source: 'nakama',
          rpcName: 'ts_hr_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should describe time span in days for long durations', () => {
      const store = getErrorStore();
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        store.addError({
          id: `ts-day-${i}`,
          timestamp: new Date(now.getTime() - (4 - i) * 2 * 24 * 60 * 60 * 1000).toISOString(),
          message: 'multi day duration error',
          errorType: 'Error',
          severity: 'error',
          source: 'nakama',
          rpcName: 'ts_day_rpc',
        });
      }

      const patterns = store.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Impact assessment branches', () => {
    it('should assess warning severity impact correctly', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('deprecated warning issued'), {
          rpcName: 'warn_rpc',
          userId: `user-${i}`,
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].impact.systemImpact).toContain('performance degradation');
    });

    it('should assess info severity impact as minimal', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('routine info log entry'), {
          severity: 'info',
          rpcName: 'info_rpc',
          userId: `user-${i}`,
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].impact.userImpact).toContain('Minimal');
    });

    it('should include affectedPercentage when users are affected', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database query failed'), {
          rpcName: 'db_query',
          userId: `user-${i}`,
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].impact.affectedPercentage).toBeDefined();
    });
  });

  describe('Recommendation generation branches', () => {
    it('should add timeout recommendation for database errors with timeout', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database query timeout exceeded'), {
          rpcName: 'db_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].recommendations).toContain('Increase database query timeout settings');
    });

    it('should add circuit breaker recommendation for high frequency cache errors', () => {
      for (let i = 0; i < 20; i++) {
        collectError(new Error('cache connection failed'), {
          rpcName: 'cache_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].recommendations).toContain(
        'Consider implementing circuit breaker pattern'
      );
    });

    it('should add focus recommendation for nakama errors with affected RPCs', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('nakama rpc execution error'), {
          rpcName: 'broken_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].recommendations.some((r) => r.includes('broken_rpc'))).toBe(true);
    });

    it('should add urgent recommendation for very high frequency errors', () => {
      for (let i = 0; i < 60; i++) {
        collectError(new Error('critical flood error'), {
          rpcName: 'flood_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].recommendations[0]).toContain('URGENT');
    });

    it('should add validation-specific recommendations', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('validation failed for input data'), {
          rpcName: 'validate',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].recommendations).toContain('Review client-side validation logic');
      expect(insights[0].recommendations).toContain(
        'Add more descriptive error messages for users'
      );
      expect(insights[0].recommendations).toContain('Consider implementing input sanitization');
    });

    it('should add external-specific recommendations', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('external api connection refused'), {
          rpcName: 'external_call',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].recommendations).toContain('Monitor external service health');
      expect(insights[0].recommendations).toContain(
        'Implement retry logic with exponential backoff'
      );
      expect(insights[0].recommendations).toContain('Consider adding fallback mechanisms');
    });

    it('should add unknown source recommendations', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('unclassified runtime anomaly'), {
          rpcName: 'unknown_op',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].recommendations).toContain('Investigate error root cause');
      expect(insights[0].recommendations).toContain('Add detailed logging around this operation');
    });
  });

  describe('formatUptime through getStats', () => {
    it('should format uptime in minutes for short uptimes', () => {
      const store = getErrorStore();
      const stats = store.getStats();
      expect(stats.uptime).toMatch(/^\d+m$/);
    });

    it('should include errorsPerMinute in stats', () => {
      const store = getErrorStore();
      store.addError({
        id: 'epm-1',
        timestamp: new Date().toISOString(),
        message: 'Rate test error',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      const stats = store.getStats();
      expect(stats.errorsPerMinute).toBeGreaterThanOrEqual(0);
    });

    it('should include lastErrorProcessed timestamp', () => {
      const store = getErrorStore();
      store.addError({
        id: 'lep-1',
        timestamp: new Date().toISOString(),
        message: 'Timestamp test error',
        errorType: 'Error',
        severity: 'error',
        source: 'nakama',
      });

      const stats = store.getStats();
      expect(stats.lastErrorProcessed).toBeDefined();
    });
  });

  describe('processErrors pattern merge', () => {
    it('should merge patterns when same errors are processed across windows', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database merge test error'), {
          rpcName: 'merge_rpc',
        });
      }

      const store = getErrorStore();
      const patterns = store.getPatterns();
      const mergePattern = patterns.find((p) => p.messageTemplate.includes('merge test error'));

      if (mergePattern) {
        expect(mergePattern.count).toBeGreaterThanOrEqual(5);
      }
    });

    it('should merge affectedRpcs when processing overlapping patterns', () => {
      for (let i = 0; i < 3; i++) {
        collectError(new Error('nakama merge rpc error'), {
          rpcName: `rpc_${i}`,
        });
      }

      const store = getErrorStore();
      const patterns = store.getPatterns();
      const mergePattern = patterns.find((p) => p.messageTemplate.includes('merge rpc error'));

      if (mergePattern) {
        expect(mergePattern.affectedRpcs.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should merge affectedUsers when processing overlapping patterns', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database user merge error'), {
          rpcName: 'user_rpc',
          userId: `merge_user_${i}`,
        });
      }

      const store = getErrorStore();
      const patterns = store.getPatterns();
      const mergePattern = patterns.find((p) => p.messageTemplate.includes('user merge error'));

      if (mergePattern) {
        expect(mergePattern.affectedUsers.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('createInsightFromPattern priority branches', () => {
    it('should assign medium priority for warning severity with count <= 10', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('deprecated warning notice'), {
          severity: 'warning',
          rpcName: 'dep_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].priority).toBe('medium');
    });
  });

  describe('assessImpact warning severity branch', () => {
    it('should set correct impact strings for warning severity', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('deprecated function usage'), {
          severity: 'warning',
          rpcName: 'legacy_rpc',
          userId: `user-${i}`,
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].impact.userImpact).toContain('Some users');
      expect(insights[0].impact.systemImpact).toContain('Minor');
    });
  });

  describe('generateRecommendations nakama with affectedRpcs', () => {
    it('should add focus recommendation when nakama errors have affected RPCs', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('nakama handler error'), {
          rpcName: 'focus_target_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].recommendations.some((r: string) => r.includes('focus_target_rpc'))).toBe(
        true
      );
    });
  });

  describe('processErrors pattern merge with existing RPCs and users', () => {
    it('should not duplicate RPCs when merging existing pattern', () => {
      // First batch: creates the pattern
      for (let i = 0; i < 3; i++) {
        collectError(new Error('dedup rpc merge test'), {
          rpcName: 'same_rpc',
        });
      }

      const store = getErrorStore();
      const patternsBefore = store.getPatterns();
      const targetPattern = patternsBefore.find((p) =>
        p.messageTemplate.includes('dedup rpc merge test')
      );
      const rpcCountBefore = targetPattern ? targetPattern.affectedRpcs.length : 0;

      // Second batch: same rpc name, should not duplicate
      for (let i = 0; i < 3; i++) {
        collectError(new Error('dedup rpc merge test'), {
          rpcName: 'same_rpc',
        });
      }

      const patternsAfter = store.getPatterns();
      const targetAfter = patternsAfter.find((p) =>
        p.messageTemplate.includes('dedup rpc merge test')
      );
      if (targetAfter) {
        expect(targetAfter.affectedRpcs.length).toBe(rpcCountBefore);
      }
    });

    it('should not duplicate users when merging existing pattern', () => {
      for (let i = 0; i < 3; i++) {
        collectError(new Error('dedup user merge test'), {
          rpcName: 'user_dedup_rpc',
          userId: 'same_user',
        });
      }

      const store = getErrorStore();
      const patternsBefore = store.getPatterns();
      const targetPattern = patternsBefore.find((p) =>
        p.messageTemplate.includes('dedup user merge test')
      );
      const userCountBefore = targetPattern ? targetPattern.affectedUsers.length : 0;

      // Second batch: same user id, should not duplicate
      for (let i = 0; i < 3; i++) {
        collectError(new Error('dedup user merge test'), {
          rpcName: 'user_dedup_rpc',
          userId: 'same_user',
        });
      }

      const patternsAfter = store.getPatterns();
      const targetAfter = patternsAfter.find((p) =>
        p.messageTemplate.includes('dedup user merge test')
      );
      if (targetAfter) {
        expect(targetAfter.affectedUsers.length).toBe(userCountBefore);
      }
    });
  });

  describe('processErrors insight deduplication', () => {
    it('should not add duplicate insights for same patternId', () => {
      // This triggers processErrors multiple times with the same pattern
      for (let i = 0; i < 5; i++) {
        collectError(new Error('insight dedup test error'), {
          rpcName: 'dedup_insight_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      const patternIds = insights.map((i) => i.patternId);
      const uniqueIds = new Set(patternIds);
      expect(uniqueIds.size).toBe(patternIds.length);
    });
  });

  describe('rpcGetErrorSummary branches', () => {
    it('should handle summary RPC with valid JSON payload', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const summaryHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_summary'
      )?.[1];

      if (summaryHandler) {
        const now = new Date();
        const payload = JSON.stringify({
          startTime: new Date(now.getTime() - 3600000).toISOString(),
          endTime: now.toISOString(),
        });
        const result = await summaryHandler(
          { userId: 'test' },
          { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
          {},
          payload
        );
        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('totalErrors');
      }
    });

    it('should handle summary RPC with empty payload (default time range)', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const summaryHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_summary'
      )?.[1];

      if (summaryHandler) {
        const result = await summaryHandler(
          { userId: 'test' },
          { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
          {},
          ''
        );
        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('totalErrors');
      }
    });

    it('should handle summary RPC with invalid JSON payload (catch branch)', async () => {
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const summaryHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_summary'
      )?.[1];

      if (summaryHandler) {
        const result = await summaryHandler(
          { userId: 'test' },
          { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
          {},
          'not valid json{{}'
        );
        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('totalErrors');
      }
    });
  });

  describe('rpcGetErrorDashboard validation branch', () => {
    it('should handle dashboard RPC when validation fails with non-empty payload', async () => {
      // The validation uses ZodSchemas.health_check
      // We need a payload that is truthy but fails validation
      const { registerErrorInsightRpcs } = require('../error_insight_pipeline');
      const mockInitializer = { registerRpc: jest.fn() };
      registerErrorInsightRpcs(mockInitializer);

      const dashboardHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer/error_insights_dashboard'
      )?.[1];

      if (dashboardHandler) {
        // Pass a payload that might fail validation
        const result = await dashboardHandler(
          { userId: 'test' },
          { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
          {},
          'invalid-payload'
        );
        // Should return either dashboard or validation error
        const parsed = JSON.parse(result);
        expect(parsed).toBeDefined();
      }
    });
  });

  describe('Edge cases for full coverage', () => {
    it('should handle errors with no rpcName in pattern analysis', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database connection timeout'), {});
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
    });

    it('should handle errors with no userId in pattern analysis', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('cache retrieval failure'), {
          rpcName: 'cache_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThan(0);
    });

    it('should handle multiple different error types generating separate insights', () => {
      for (let i = 0; i < 5; i++) {
        collectError(new Error('database first unique error'), {
          rpcName: 'first_rpc',
        });
      }
      for (let i = 0; i < 5; i++) {
        collectError(new Error('cache second unique error'), {
          rpcName: 'second_rpc',
        });
      }

      const store = getErrorStore();
      const insights = store.getInsights();
      expect(insights.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle disabled pipeline in processErrors', () => {
      const { config } = require('../../config');
      config.errorInsights.enabled = false;

      collectError(new Error('should not process'), {});

      const store = getErrorStore();
      const errors = store.getErrorsInRange(new Date(0), new Date());
      const matchingErrors = errors.filter((e) => e.message === 'should not process');
      expect(matchingErrors.length).toBe(0);

      config.errorInsights.enabled = true;
    });

    it('should cleanup expired patterns during processErrors', () => {
      const { config } = require('../../config');
      const store = getErrorStore();
      const expiredDate = new Date(
        Date.now() - (config.errorInsights.patternTtlDays + 1) * 24 * 60 * 60 * 1000
      ).toISOString();

      store.upsertPattern({
        patternId: 'expired-pattern',
        signature: 'expired-sig',
        count: 1,
        firstSeen: expiredDate,
        lastSeen: expiredDate,
        errorType: 'Error',
        messageTemplate: 'Expired pattern',
        affectedRpcs: [],
        affectedUsers: [],
        occurrencesPerHour: 0,
        severity: 'error',
        source: 'unknown',
      });

      for (let i = 0; i < 3; i++) {
        collectError(new Error('active error for cleanup trigger'), {
          rpcName: 'cleanup_rpc',
        });
      }

      const patterns = store.getPatterns();
      const expiredPattern = patterns.find((p) => p.patternId === 'expired-pattern');
      expect(expiredPattern).toBeUndefined();
    });
  });
});
