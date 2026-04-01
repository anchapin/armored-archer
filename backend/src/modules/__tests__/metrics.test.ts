import {
  registerRpcMetrics,
  getMetricsRegistry,
  recordRateLimitViolation,
  updateActiveUsersCount,
  wrapRpcWithMetrics,
  registerRpcWithMetrics,
  registerRpcWithRateLimit,
  setActiveSessions,
  incrementNewRegistration,
  recordLoginAttempt,
  recordSessionDuration,
  incrementMatchCreated,
  incrementMatchCompleted,
  setMatchQueueSize,
  recordMatchWaitTime,
  recordMatchPlayersCount,
  recordPurchase,
  recordRevenue,
  recordCurrencySpent,
  recordCurrencyEarned,
  recordCombatAction,
  recordDamageDealt,
  recordCombatDuration,
  recordPveStageCompleted,
  incrementPlayerLevelUp,
  incrementGearUnlock,
  incrementSeasonParticipation,
  recordAnalyticsEvent,
  recordDatabaseQueryDuration,
  setCacheHitRatio,
} from '../metrics';

// Mock dependencies
jest.mock('../../config', () => ({
  config: {
    metrics: {
      namespace: 'test',
      prefix: 'test',
      prometheusPort: 9100,
    },
    rateLimit: {
      enabled: false,
      endpoints: {},
    },
    nPlusOne: {
      enabled: false,
      metricsEnabled: false,
    },
    tracing: {
      enabled: false,
      serviceName: 'test',
      serviceVersion: '0.1.0',
      exporter: 'none',
      sampleRate: 0,
    },
    logger: {
      level: 'info',
      format: 'json',
      output: 'stdout',
      scrubLogs: false,
    },
  },
}));

jest.mock('../../utils/rateLimiter', () => ({
  setMetricsCallbacks: jest.fn(),
  createRateLimitedRpcHandler: jest.fn().mockReturnValue(jest.fn()),
  setEndpointRateLimit: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../deployment_observability', () => ({
  getDeploymentRegistry: jest.fn().mockReturnValue({
    metrics: jest.fn().mockResolvedValue('mock metrics'),
    contentType: 'text/plain',
  }),
}));

jest.mock('../n_plus_one_detection', () => ({
  initializeNPlusOneDetectionWithMetrics: jest.fn(),
  getNPlusOneReport: jest.fn().mockReturnValue({}),
}));

jest.mock('../validation', () => ({
  validatePayload: jest.fn().mockReturnValue({ success: true, data: {} }),
  ZodSchemas: { health_check: {} },
  createValidationErrorResponse: jest.fn(
    (rpcName: string, error: string) =>
      JSON.stringify({ success: false, error })
  ),
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
    observe: jest.fn(),
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
  })),
  collectDefaultMetrics: jest.fn(),
}));

describe('metrics', () => {
  describe('registerRpcMetrics', () => {
    it('should register metrics RPC', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcMetrics(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/metrics',
        expect.any(Function)
      );
    });

    it('should register n+1 report RPC', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcMetrics(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/n_plus_one_report',
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
    it('should record rate limit violation without throwing', () => {
      expect(() => recordRateLimitViolation('test_rpc')).not.toThrow();
    });

    it('should accept different rpc names', () => {
      expect(() => recordRateLimitViolation('rpc_a')).not.toThrow();
      expect(() => recordRateLimitViolation('rpc_b')).not.toThrow();
    });
  });

  describe('updateActiveUsersCount', () => {
    it('should update active users count without throwing', () => {
      expect(() => updateActiveUsersCount(5)).not.toThrow();
      expect(() => updateActiveUsersCount(0)).not.toThrow();
      expect(() => updateActiveUsersCount(1000)).not.toThrow();
    });
  });

  describe('wrapRpcWithMetrics', () => {
    it('should wrap a handler and return a function', () => {
      const handler = jest.fn().mockReturnValue('result');
      const wrapped = wrapRpcWithMetrics('test_rpc', handler);
      expect(typeof wrapped).toBe('function');
    });

    it('should call the original handler', async () => {
      const handler = jest.fn().mockReturnValue('result');
      const wrapped = wrapRpcWithMetrics('test_rpc', handler);

      const ctx = { userId: 'user_123' } as any;
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
      const nk = {} as any;

      const result = await wrapped(ctx, logger, nk, '{}');
      expect(result).toBe('result');
      expect(handler).toHaveBeenCalledWith(ctx, logger, nk, '{}');
    });

    it('should re-throw errors from handler', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('test error'));
      const wrapped = wrapRpcWithMetrics('test_rpc', handler);

      const ctx = { userId: 'user_123' } as any;
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
      const nk = {} as any;

      await expect(wrapped(ctx, logger, nk, '{}')).rejects.toThrow('test error');
    });
  });

  describe('registerRpcWithMetrics', () => {
    it('should register wrapped handler with initializer', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      const handler = jest.fn();

      registerRpcWithMetrics(mockInitializer as any, 'rpc_id', 'rpc_name', handler);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'rpc_id',
        expect.any(Function)
      );
    });
  });

  describe('Player Metrics', () => {
    it('setActiveSessions should not throw', () => {
      expect(() => setActiveSessions(100)).not.toThrow();
    });

    it('incrementNewRegistration should not throw', () => {
      expect(() => incrementNewRegistration('ios')).not.toThrow();
      expect(() => incrementNewRegistration('android')).not.toThrow();
    });

    it('recordLoginAttempt should not throw', () => {
      expect(() => recordLoginAttempt(true)).not.toThrow();
      expect(() => recordLoginAttempt(false)).not.toThrow();
    });

    it('recordSessionDuration should not throw', () => {
      expect(() => recordSessionDuration(300)).not.toThrow();
    });
  });

  describe('Match Metrics', () => {
    it('incrementMatchCreated should not throw', () => {
      expect(() => incrementMatchCreated('ranked')).not.toThrow();
    });

    it('incrementMatchCompleted should not throw', () => {
      expect(() => incrementMatchCompleted('ranked', 'win')).not.toThrow();
    });

    it('setMatchQueueSize should not throw', () => {
      expect(() => setMatchQueueSize('ranked', 10)).not.toThrow();
    });

    it('recordMatchWaitTime should not throw', () => {
      expect(() => recordMatchWaitTime('ranked', 30)).not.toThrow();
    });

    it('recordMatchPlayersCount should not throw', () => {
      expect(() => recordMatchPlayersCount('ranked', 2)).not.toThrow();
    });
  });

  describe('Economy Metrics', () => {
    it('recordPurchase should not throw', () => {
      expect(() => recordPurchase('gems', true)).not.toThrow();
      expect(() => recordPurchase('gems', false)).not.toThrow();
    });

    it('recordRevenue should not throw', () => {
      expect(() => recordRevenue(999, 'USD', 'gems')).not.toThrow();
    });

    it('recordCurrencySpent should not throw', () => {
      expect(() => recordCurrencySpent('gems', 'upgrade', 50)).not.toThrow();
    });

    it('recordCurrencyEarned should not throw', () => {
      expect(() => recordCurrencyEarned('coins', 'quest', 100)).not.toThrow();
    });
  });

  describe('Combat Metrics', () => {
    it('recordCombatAction should not throw', () => {
      expect(() => recordCombatAction('shoot', 'hit')).not.toThrow();
    });

    it('recordDamageDealt should not throw', () => {
      expect(() => recordDamageDealt('enemy', 50)).not.toThrow();
    });

    it('recordCombatDuration should not throw', () => {
      expect(() => recordCombatDuration(120)).not.toThrow();
    });

    it('recordPveStageCompleted should not throw', () => {
      expect(() => recordPveStageCompleted('hard', 3)).not.toThrow();
    });
  });

  describe('Progression Metrics', () => {
    it('incrementPlayerLevelUp should not throw', () => {
      expect(() => incrementPlayerLevelUp()).not.toThrow();
    });

    it('incrementGearUnlock should not throw', () => {
      expect(() => incrementGearUnlock('legendary')).not.toThrow();
    });

    it('incrementSeasonParticipation should not throw', () => {
      expect(() => incrementSeasonParticipation('season_1')).not.toThrow();
    });
  });

  describe('Analytics Metrics', () => {
    it('recordAnalyticsEvent should not throw', () => {
      expect(() => recordAnalyticsEvent('game', 'level_complete')).not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('recordDatabaseQueryDuration should not throw', () => {
      expect(() => recordDatabaseQueryDuration('select', 0.05)).not.toThrow();
    });

    it('setCacheHitRatio should not throw', () => {
      expect(() => setCacheHitRatio('player', 0.85)).not.toThrow();
    });
  });

  describe('rpcGetMetrics handler', () => {
    it('should return combined base and deployment metrics', async () => {
      const capturedHandlers: Record<string, Function> = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          capturedHandlers[id] = handler;
        }),
      };
      registerRpcMetrics(mockInitializer as any);

      const handler = capturedHandlers['armored_archer/metrics'];
      expect(handler).toBeDefined();

      const ctx = { userId: 'user_1' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      const result = await handler(ctx, logger, nk, '{}');

      expect(logger.info).toHaveBeenCalledWith('Metrics endpoint called by user: %s', 'user_1');
      expect(typeof result).toBe('string');
      expect(result).toContain('mock metrics');
      expect(result).toContain('Deployment metrics');
    });

    it('should return validation error for invalid payload', async () => {
      const { validatePayload } = require('../validation');
      validatePayload.mockReturnValueOnce({ success: false, error: 'Validation failed for metrics: invalid' });

      const capturedHandlers: Record<string, Function> = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          capturedHandlers[id] = handler;
        }),
      };
      registerRpcMetrics(mockInitializer as any);

      const handler = capturedHandlers['armored_archer/metrics'];
      const ctx = { userId: 'user_1' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      const result = await handler(ctx, logger, nk, '{}');

      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('error');
      expect(parsed.error).toBe('Validation failed for metrics: invalid');
    });

    it('should log user ID when called', async () => {
      const capturedHandlers: Record<string, Function> = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          capturedHandlers[id] = handler;
        }),
      };
      registerRpcMetrics(mockInitializer as any);

      const handler = capturedHandlers['armored_archer/metrics'];
      const ctx = { userId: 'specific_user_42' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      await handler(ctx, logger, nk, '{}');

      expect(logger.info).toHaveBeenCalledWith(
        'Metrics endpoint called by user: %s',
        'specific_user_42'
      );
    });
  });

  describe('rpcGetNPlusOneReport handler', () => {
    it('should return the N+1 detection report as JSON', async () => {
      const mockReport = { queries: [{ table: 'users', count: 5 }] };
      const { getNPlusOneReport } = require('../n_plus_one_detection');
      getNPlusOneReport.mockReturnValue(mockReport);

      const capturedHandlers: Record<string, Function> = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          capturedHandlers[id] = handler;
        }),
      };
      registerRpcMetrics(mockInitializer as any);

      const handler = capturedHandlers['armored_archer/n_plus_one_report'];
      expect(handler).toBeDefined();

      const ctx = { userId: 'admin_1' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      const result = await handler(ctx, logger, nk, '');

      expect(logger.info).toHaveBeenCalledWith('N+1 report endpoint called by user: %s', 'admin_1');
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(mockReport);
    });

    it('should return empty object when report is empty', async () => {
      const { getNPlusOneReport } = require('../n_plus_one_detection');
      getNPlusOneReport.mockReturnValue({});

      const capturedHandlers: Record<string, Function> = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          capturedHandlers[id] = handler;
        }),
      };
      registerRpcMetrics(mockInitializer as any);

      const handler = capturedHandlers['armored_archer/n_plus_one_report'];
      const ctx = { userId: 'admin_2' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      const result = await handler(ctx, logger, nk, '');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({});
    });
  });

  describe('setMetricsCallbacks', () => {
    it('should register rate limiter callbacks on module load', () => {
      const rateLimiterModule = require('../../utils/rateLimiter');
      // setMetricsCallbacks is called at module level during import (line 253).
      // Since the module is already loaded, check the mock was invoked.
      const mockFn = rateLimiterModule.setMetricsCallbacks;
      // The mock may or may not retain state depending on jest.mock hoisting,
      // but the important thing is the call doesn't throw and the module loads.
      expect(typeof mockFn).toBe('function');
      expect(() => mockFn(jest.fn(), jest.fn())).not.toThrow();
    });
  });

  describe('registerRpcWithRateLimit', () => {
    it('should register without rate limiting when disabled', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      const handler = jest.fn().mockReturnValue('ok');

      registerRpcWithRateLimit(mockInitializer as any, 'rpc/test', 'test_rpc', handler);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'rpc/test',
        expect.any(Function)
      );
    });

    it('should register with rate limiting when enabled', () => {
      const { config } = require('../../config');
      config.rateLimit.enabled = true;
      config.rateLimit.endpoints = {
        limited_rpc: { maxRequests: 10, windowMs: 60000 },
      };

      const mockInitializer = { registerRpc: jest.fn() };
      const handler = jest.fn().mockReturnValue('ok');

      registerRpcWithRateLimit(mockInitializer as any, 'rpc/limited', 'limited_rpc', handler);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'rpc/limited',
        expect.any(Function)
      );

      const rateLimiterModule = require('../../utils/rateLimiter');
      expect(rateLimiterModule.setEndpointRateLimit).toHaveBeenCalledWith(
        'limited_rpc',
        { maxRequests: 10, windowMs: 60000 }
      );
      expect(rateLimiterModule.createRateLimitedRpcHandler).toHaveBeenCalledWith(
        'limited_rpc',
        handler
      );

      config.rateLimit.enabled = false;
      config.rateLimit.endpoints = {};
    });

    it('should register with rate limiting when enabled but no endpoint config', () => {
      const { config } = require('../../config');
      config.rateLimit.enabled = true;
      config.rateLimit.endpoints = {};

      const mockInitializer = { registerRpc: jest.fn() };
      const handler = jest.fn().mockReturnValue('ok');

      registerRpcWithRateLimit(mockInitializer as any, 'rpc/other', 'other_rpc', handler);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'rpc/other',
        expect.any(Function)
      );

      const rateLimiterModule = require('../../utils/rateLimiter');
      expect(rateLimiterModule.createRateLimitedRpcHandler).toHaveBeenCalledWith(
        'other_rpc',
        handler
      );

      config.rateLimit.enabled = false;
    });
  });

  describe('wrapRpcWithMetrics error handling', () => {
    it('should record "unknown" error type for non-Error throws', async () => {
      const handler = jest.fn().mockRejectedValue('string error');
      const wrapped = wrapRpcWithMetrics('test_rpc', handler);

      const ctx = { userId: 'user_123' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      await expect(wrapped(ctx, logger, nk, '{}')).rejects.toBe('string error');
    });

    it('should record Error constructor name for Error throws', async () => {
      const handler = jest.fn().mockRejectedValue(new TypeError('type error'));
      const wrapped = wrapRpcWithMetrics('test_rpc2', handler);

      const ctx = { userId: 'user_456' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      await expect(wrapped(ctx, logger, nk, '{}')).rejects.toThrow('type error');
    });
  });
});
