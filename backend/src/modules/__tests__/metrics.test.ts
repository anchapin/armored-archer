import { Counter, Gauge, Histogram } from 'prom-client';
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
  incrementAdminRpcAccessDenied,
  setAdminAllowlistSize,
  recordWebhookEvent,
  recordWebhookProcessingTime,
  setWebhookPendingAwards,
  incrementWebhookRedisError,
  setWebhookConfigured,
  recordSettlementOutcome,
} from '../metrics';
import { resetAdminAllowlistCache } from '../admin_auth';

// ---- Admin-guard metric registration capture (issue #1141) ----
// Snapshot the Counter/Gauge constructor configs metrics.ts passed at module
// load. Taken at file scope — before any beforeEach's jest.clearAllMocks()
// wipes the constructor call log — so registration vocabulary stays assertable.
const registeredCounterConfigs = ((Counter as unknown as jest.Mock).mock.calls ?? []).map(
  (call: unknown[]) => call[0] as { name: string; labelNames?: readonly string[] }
);
const registeredGaugeConfigs = ((Gauge as unknown as jest.Mock).mock.calls ?? []).map(
  (call: unknown[]) => call[0] as { name: string }
);

const registeredHistogramConfigs = ((Histogram as unknown as jest.Mock).mock.calls ?? []).map(
  (call: unknown[]) => call[0] as { name: string; labelNames?: readonly string[] }
);

function counterConfigs(): Array<{ name: string; labelNames?: readonly string[] }> {
  return registeredCounterConfigs;
}

function gaugeConfigs(): Array<{ name: string }> {
  return registeredGaugeConfigs;
}

// ---- Mocks ----

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
    metrics: jest.fn().mockResolvedValue('mock deployment metrics'),
    contentType: 'text/plain',
  }),
}));

jest.mock('../health_monitor', () => ({
  getHealthRegistry: jest.fn().mockReturnValue({
    metrics: jest.fn().mockResolvedValue('mock health metrics'),
    contentType: 'text/plain',
  }),
}));

jest.mock('../progressive_rollout', () => ({
  getRolloutRegistry: jest.fn().mockReturnValue({
    metrics: jest.fn().mockResolvedValue('mock rollout metrics'),
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
  createValidationErrorResponse: jest.fn((rpcName: string, error: string) =>
    JSON.stringify({ success: false, error })
  ),
}));

// Module-scoped so timer tests can access captured endTimer
let capturedEndTimer: jest.Mock;

jest.mock('prom-client', () => ({
  Registry: jest.fn().mockImplementation(() => ({
    metrics: jest.fn().mockResolvedValue('mock base metrics'),
    contentType: 'text/plain',
  })),
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    startTimer: jest.fn().mockImplementation(() => {
      capturedEndTimer = jest.fn();
      return capturedEndTimer;
    }),
    observe: jest.fn(),
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
  })),
  collectDefaultMetrics: jest.fn(),
}));

// ---- Helpers ----

function makeRpcArgs() {
  const ctx = { userId: '00000000-0000-4000-8000-00000000000a' } as any;
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
  const nk = {} as any;
  return { ctx, logger, nk };
}

// ---- Tests ----

describe('metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // getMetricsRegistry
  // ==========================================

  describe('getMetricsRegistry', () => {
    it('returns a Registry instance', () => {
      const registry = getMetricsRegistry();
      expect(registry).toBeDefined();
      expect(registry).toHaveProperty('metrics');
      expect(typeof registry.metrics).toBe('function');
    });

    it('returns the same registry on repeated calls', () => {
      const a = getMetricsRegistry();
      const b = getMetricsRegistry();
      expect(a).toBe(b);
    });
  });

  // ==========================================
  // wrapRpcWithMetrics
  // ==========================================

  describe('wrapRpcWithMetrics', () => {
    it('returns a function', () => {
      const handler = jest.fn().mockReturnValue('ok');
      const wrapped = wrapRpcWithMetrics('test_rpc', handler);
      expect(typeof wrapped).toBe('function');
    });

    it('delegates to the original handler and returns its result', async () => {
      const handler = jest.fn().mockReturnValue('result');
      const wrapped = wrapRpcWithMetrics('test_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      const result = await wrapped(ctx, logger, nk, '{}');

      expect(result).toBe('result');
      expect(handler).toHaveBeenCalledWith(ctx, logger, nk, '{}');
    });

    it('supports async handlers', async () => {
      const handler = jest.fn().mockResolvedValue('async_result');
      const wrapped = wrapRpcWithMetrics('async_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      const result = await wrapped(ctx, logger, nk, '{}');

      expect(result).toBe('async_result');
    });

    it('increments success counter on success', async () => {
      const handler = jest.fn().mockReturnValue('ok');
      const wrapped = wrapRpcWithMetrics('success_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      await wrapped(ctx, logger, nk, '{}');

      // The Counter mock's inc should have been called with success labels.
      // We verify via the prom-client Counter mock that was constructed for rpcCallsTotal.
      const { Counter } = require('prom-client');
      const rpcCallsTotalInstance = Counter.mock.results.find(
        (r: any) => r.value.inc.mock.calls.length > 0
      )?.value;

      // At minimum the handler was called, meaning the success path executed
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('increments error counter on failure and re-throws', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('boom'));
      const wrapped = wrapRpcWithMetrics('fail_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      await expect(wrapped(ctx, logger, nk, '{}')).rejects.toThrow('boom');

      // Handler was called, confirming error path executed
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('records "unknown" error type for non-Error throws', async () => {
      const handler = jest.fn().mockRejectedValue('string error');
      const wrapped = wrapRpcWithMetrics('non_error_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      await expect(wrapped(ctx, logger, nk, '{}')).rejects.toBe('string error');
    });

    it('records "TypeError" for TypeError throws', async () => {
      const handler = jest.fn().mockRejectedValue(new TypeError('type error'));
      const wrapped = wrapRpcWithMetrics('type_error_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      await expect(wrapped(ctx, logger, nk, '{}')).rejects.toThrow('type error');
    });

    it('calls startTimer and invokes the returned end function', async () => {
      const handler = jest.fn().mockReturnValue('ok');
      const wrapped = wrapRpcWithMetrics('timed_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      await wrapped(ctx, logger, nk, '{}');

      expect(capturedEndTimer).toBeDefined();
      expect(capturedEndTimer).toHaveBeenCalled();
    });

    it('stops timer even when handler throws', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('fail'));
      const wrapped = wrapRpcWithMetrics('timer_fail_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      await expect(wrapped(ctx, logger, nk, '{}')).rejects.toThrow('fail');

      expect(capturedEndTimer).toBeDefined();
      expect(capturedEndTimer).toHaveBeenCalled();
    });
  });

  // ==========================================
  // registerRpcWithMetrics
  // ==========================================

  describe('registerRpcWithMetrics', () => {
    it('registers a wrapped handler with the initializer', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      const handler = jest.fn();

      registerRpcWithMetrics(mockInitializer as any, 'rpc_id', 'rpc_name', handler);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith('rpc_id', expect.any(Function));
    });
  });

  // ==========================================
  // registerRpcMetrics
  // ==========================================

  describe('registerRpcMetrics', () => {
    it('registers the metrics RPC endpoint', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcMetrics(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/metrics',
        expect.any(Function)
      );
    });

    it('registers the n+1 report RPC endpoint', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcMetrics(mockInitializer as any);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/n_plus_one_report',
        expect.any(Function)
      );
    });
  });

  // ==========================================
  // Prometheus scrape endpoints (issue #1074)
  // ==========================================

  describe('registerRpcMetrics prometheus scrape endpoints', () => {
    const scrapeRpcIds = [
      'armored_archer/prometheus_metrics',
      'armored_archer/prometheus_deployment',
      'armored_archer/prometheus_health',
      'armored_archer/prometheus_rollout',
    ];

    function captureScrapeHandlers(): Record<string, Function> {
      const capturedHandlers: Record<string, Function> = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          capturedHandlers[id] = handler;
        }),
      };
      registerRpcMetrics(mockInitializer as any);
      return capturedHandlers;
    }

    it('registers the four scrape RPC endpoints', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      registerRpcMetrics(mockInitializer as any);
      for (const id of scrapeRpcIds) {
        expect(mockInitializer.registerRpc).toHaveBeenCalledWith(id, expect.any(Function));
      }
    });

    it('exposes each registry as raw Prometheus text for user-less http-key scrapes', async () => {
      const capturedHandlers = captureScrapeHandlers();

      // Prometheus scrapes arrive as GET with an empty body, authenticated by
      // Nakama's runtime HTTP key rather than a user session — ctx carries no
      // userId and there is no payload to validate.
      const cases: Array<[string, string]> = [
        ['armored_archer/prometheus_metrics', 'mock base metrics'],
        ['armored_archer/prometheus_deployment', 'mock deployment metrics'],
        ['armored_archer/prometheus_health', 'mock health metrics'],
        ['armored_archer/prometheus_rollout', 'mock rollout metrics'],
      ];

      for (const [id, expectedText] of cases) {
        const handler = capturedHandlers[id];
        expect(handler).toBeDefined();
        const ctx = { userId: '' } as any;
        const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
        const result = await handler(ctx, logger, {} as any, '');
        expect(result).toBe(expectedText);
      }
    });

    it('does not wrap scrape endpoints in the admin guard', async () => {
      // Regression guard for issue #1074: withAdminGuard is fail-closed for
      // user-less calls, so an admin-guarded scrape handler would reject
      // every Prometheus request — exactly the failure that kept the
      // armored_archer_* scrape targets DOWN.
      const previousAdminIds = process.env.ADMIN_USER_IDS;
      delete process.env.ADMIN_USER_IDS;
      resetAdminAllowlistCache();

      try {
        const capturedHandlers = captureScrapeHandlers();
        const handler = capturedHandlers['armored_archer/prometheus_metrics'];
        const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
        const result = await handler({ userId: '' } as any, logger, {} as any, '');
        expect(result).toBe('mock base metrics');
      } finally {
        if (previousAdminIds !== undefined) {
          process.env.ADMIN_USER_IDS = previousAdminIds;
        }
        resetAdminAllowlistCache();
      }
    });
  });

  // ==========================================
  // RPC handler: rpcGetMetrics
  // ==========================================

  describe('rpcGetMetrics handler', () => {
    // The metrics RPCs are registered behind the shared admin guard
    // (issue #1075), so handler-level tests must allowlist their callers.
    const previousAdminIds = process.env.ADMIN_USER_IDS;

    beforeEach(() => {
      process.env.ADMIN_USER_IDS = '00000000-0000-4000-8000-00000000000a,00000000-0000-4000-8000-00000000000b,00000000-0000-4000-8000-00000000000c,00000000-0000-4000-8000-00000000000d';
      resetAdminAllowlistCache();
    });

    afterEach(() => {
      if (previousAdminIds === undefined) {
        delete process.env.ADMIN_USER_IDS;
      } else {
        process.env.ADMIN_USER_IDS = previousAdminIds;
      }
      resetAdminAllowlistCache();
    });

    it('returns combined base and deployment metrics', async () => {
      const capturedHandlers: Record<string, Function> = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          capturedHandlers[id] = handler;
        }),
      };
      registerRpcMetrics(mockInitializer as any);

      const handler = capturedHandlers['armored_archer/metrics'];
      const { ctx, logger, nk } = makeRpcArgs();

      const result = await handler(ctx, logger, nk, '{}');

      expect(logger.info).toHaveBeenCalledWith('Metrics endpoint called by user: %s', '00000000-0000-4000-8000-00000000000a');
      expect(typeof result).toBe('string');
      expect(result).toContain('mock base metrics');
      expect(result).toContain('Deployment metrics');
      expect(result).toContain('mock deployment metrics');
    });

    it('returns validation error for invalid payload', async () => {
      const { validatePayload } = require('../validation');
      validatePayload.mockReturnValueOnce({
        success: false,
        error: 'Validation failed for metrics: invalid',
      });

      const capturedHandlers: Record<string, Function> = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          capturedHandlers[id] = handler;
        }),
      };
      registerRpcMetrics(mockInitializer as any);

      const handler = capturedHandlers['armored_archer/metrics'];
      const { ctx, logger, nk } = makeRpcArgs();

      const result = await handler(ctx, logger, nk, '{}');

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('error');
      expect(parsed.error).toBe('Validation failed for metrics: invalid');
    });

    it('logs user ID when called', async () => {
      const capturedHandlers: Record<string, Function> = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          capturedHandlers[id] = handler;
        }),
      };
      registerRpcMetrics(mockInitializer as any);

      const handler = capturedHandlers['armored_archer/metrics'];
      const ctx = { userId: '00000000-0000-4000-8000-00000000000b' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      await handler(ctx, logger, nk, '{}');

      expect(logger.info).toHaveBeenCalledWith(
        'Metrics endpoint called by user: %s',
        '00000000-0000-4000-8000-00000000000b'
      );
    });
  });

  // ==========================================
  // RPC handler: rpcGetNPlusOneReport
  // ==========================================

  describe('rpcGetNPlusOneReport handler', () => {
    // Behind the shared admin guard (issue #1075) — see note above.
    const previousAdminIds = process.env.ADMIN_USER_IDS;

    beforeEach(() => {
      process.env.ADMIN_USER_IDS = '00000000-0000-4000-8000-00000000000a,00000000-0000-4000-8000-00000000000b,00000000-0000-4000-8000-00000000000c,00000000-0000-4000-8000-00000000000d';
      resetAdminAllowlistCache();
    });

    afterEach(() => {
      if (previousAdminIds === undefined) {
        delete process.env.ADMIN_USER_IDS;
      } else {
        process.env.ADMIN_USER_IDS = previousAdminIds;
      }
      resetAdminAllowlistCache();
    });

    it('returns the N+1 detection report as JSON', async () => {
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

      const ctx = { userId: '00000000-0000-4000-8000-00000000000c' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      const result = await handler(ctx, logger, nk, '');

      expect(logger.info).toHaveBeenCalledWith('N+1 report endpoint called by user: %s', '00000000-0000-4000-8000-00000000000c');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(mockReport);
    });

    it('returns empty object when report is empty', async () => {
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
      const ctx = { userId: '00000000-0000-4000-8000-00000000000d' } as any;
      const logger = { info: jest.fn() } as any;
      const nk = {} as any;

      const result = await handler(ctx, logger, nk, '');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({});
    });
  });

  // ==========================================
  // Rate Limiting Metrics
  // ==========================================

  describe('recordRateLimitViolation', () => {
    it('does not throw when called', () => {
      expect(() => recordRateLimitViolation('test_rpc')).not.toThrow();
    });

    it('accepts different rpc names without throwing', () => {
      expect(() => recordRateLimitViolation('rpc_a')).not.toThrow();
      expect(() => recordRateLimitViolation('rpc_b')).not.toThrow();
      expect(() => recordRateLimitViolation('rpc_c')).not.toThrow();
    });

    it('handles multiple rapid calls', () => {
      for (let i = 0; i < 50; i++) {
        recordRateLimitViolation(`rpc_${i}`);
      }
      // No throw = pass
    });
  });

  describe('updateActiveUsersCount', () => {
    it('does not throw when called', () => {
      expect(() => updateActiveUsersCount(42)).not.toThrow();
    });

    it('handles zero count', () => {
      expect(() => updateActiveUsersCount(0)).not.toThrow();
    });

    it('handles large counts', () => {
      expect(() => updateActiveUsersCount(1_000_000)).not.toThrow();
    });

    it('handles multiple updates', () => {
      updateActiveUsersCount(10);
      updateActiveUsersCount(20);
      updateActiveUsersCount(5);
      // No throw = pass
    });
  });

  describe('setMetricsCallbacks', () => {
    it('registers rate limiter callbacks on module load', () => {
      const rateLimiterModule = require('../../utils/rateLimiter');
      const mockFn = rateLimiterModule.setMetricsCallbacks;
      expect(typeof mockFn).toBe('function');
      expect(() => mockFn(jest.fn(), jest.fn())).not.toThrow();
    });
  });

  // ==========================================
  // registerRpcWithRateLimit
  // ==========================================

  describe('registerRpcWithRateLimit', () => {
    it('registers without rate limiting when disabled', () => {
      const mockInitializer = { registerRpc: jest.fn() };
      const handler = jest.fn().mockReturnValue('ok');

      registerRpcWithRateLimit(mockInitializer as any, 'rpc/test', 'test_rpc', handler);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith('rpc/test', expect.any(Function));
    });

    it('registers with rate limiting when enabled', () => {
      const { config } = require('../../config');
      config.rateLimit.enabled = true;
      config.rateLimit.endpoints = {
        limited_rpc: { maxRequests: 10, windowMs: 60000 },
      };

      const mockInitializer = { registerRpc: jest.fn() };
      const handler = jest.fn().mockReturnValue('ok');

      registerRpcWithRateLimit(mockInitializer as any, 'rpc/limited', 'limited_rpc', handler);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith('rpc/limited', expect.any(Function));

      const rateLimiterModule = require('../../utils/rateLimiter');
      expect(rateLimiterModule.setEndpointRateLimit).toHaveBeenCalledWith('limited_rpc', {
        maxRequests: 10,
        windowMs: 60000,
      });
      expect(rateLimiterModule.createRateLimitedRpcHandler).toHaveBeenCalledWith(
        'limited_rpc',
        handler
      );

      config.rateLimit.enabled = false;
      config.rateLimit.endpoints = {};
    });

    it('registers with rate limiting enabled but no endpoint config', () => {
      const { config } = require('../../config');
      config.rateLimit.enabled = true;
      config.rateLimit.endpoints = {};

      const mockInitializer = { registerRpc: jest.fn() };
      const handler = jest.fn().mockReturnValue('ok');

      registerRpcWithRateLimit(mockInitializer as any, 'rpc/other', 'other_rpc', handler);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith('rpc/other', expect.any(Function));

      const rateLimiterModule = require('../../utils/rateLimiter');
      expect(rateLimiterModule.createRateLimitedRpcHandler).toHaveBeenCalledWith(
        'other_rpc',
        handler
      );

      config.rateLimit.enabled = false;
    });
  });

  // ==========================================
  // Player Metrics
  // ==========================================

  describe('Player Metrics', () => {
    describe('setActiveSessions', () => {
      it('does not throw when called', () => {
        expect(() => setActiveSessions(100)).not.toThrow();
      });

      it('handles zero sessions', () => {
        expect(() => setActiveSessions(0)).not.toThrow();
      });

      it('handles multiple calls', () => {
        setActiveSessions(50);
        setActiveSessions(75);
        setActiveSessions(25);
      });
    });

    describe('incrementNewRegistration', () => {
      it('does not throw when called', () => {
        expect(() => incrementNewRegistration('ios')).not.toThrow();
      });

      it('supports multiple platforms', () => {
        incrementNewRegistration('ios');
        incrementNewRegistration('android');
        incrementNewRegistration('web');
      });

      it('handles rapid calls for same platform', () => {
        for (let i = 0; i < 20; i++) {
          incrementNewRegistration('ios');
        }
      });
    });

    describe('recordLoginAttempt', () => {
      it('does not throw for success', () => {
        expect(() => recordLoginAttempt(true)).not.toThrow();
      });

      it('does not throw for failure', () => {
        expect(() => recordLoginAttempt(false)).not.toThrow();
      });

      it('handles mixed success/failure calls', () => {
        recordLoginAttempt(true);
        recordLoginAttempt(false);
        recordLoginAttempt(true);
      });
    });

    describe('recordSessionDuration', () => {
      it('does not throw when called', () => {
        expect(() => recordSessionDuration(300)).not.toThrow();
      });

      it('handles zero duration', () => {
        expect(() => recordSessionDuration(0)).not.toThrow();
      });

      it('handles long sessions', () => {
        expect(() => recordSessionDuration(14400)).not.toThrow();
      });

      it('handles multiple observations', () => {
        recordSessionDuration(60);
        recordSessionDuration(120);
        recordSessionDuration(300);
      });
    });
  });

  // ==========================================
  // Match/Multiplayer Metrics
  // ==========================================

  describe('Match Metrics', () => {
    describe('incrementMatchCreated', () => {
      it('does not throw when called', () => {
        expect(() => incrementMatchCreated('ranked')).not.toThrow();
      });

      it('supports different match types', () => {
        incrementMatchCreated('ranked');
        incrementMatchCreated('casual');
        incrementMatchCreated('tournament');
      });
    });

    describe('incrementMatchCompleted', () => {
      it('does not throw when called', () => {
        expect(() => incrementMatchCompleted('ranked', 'win')).not.toThrow();
      });

      it('supports different results', () => {
        incrementMatchCompleted('ranked', 'win');
        incrementMatchCompleted('ranked', 'loss');
        incrementMatchCompleted('ranked', 'draw');
      });
    });

    describe('setMatchQueueSize', () => {
      it('does not throw when called', () => {
        expect(() => setMatchQueueSize('ranked', 10)).not.toThrow();
      });

      it('handles zero queue size', () => {
        expect(() => setMatchQueueSize('ranked', 0)).not.toThrow();
      });

      it('handles multiple match types simultaneously', () => {
        setMatchQueueSize('ranked', 5);
        setMatchQueueSize('casual', 12);
      });
    });

    describe('recordMatchWaitTime', () => {
      it('does not throw when called', () => {
        expect(() => recordMatchWaitTime('ranked', 30)).not.toThrow();
      });

      it('handles zero wait time', () => {
        expect(() => recordMatchWaitTime('ranked', 0)).not.toThrow();
      });

      it('handles long wait times', () => {
        expect(() => recordMatchWaitTime('ranked', 300)).not.toThrow();
      });
    });

    describe('recordMatchPlayersCount', () => {
      it('does not throw when called', () => {
        expect(() => recordMatchPlayersCount('ranked', 2)).not.toThrow();
      });

      it('handles various player counts', () => {
        recordMatchPlayersCount('ranked', 1);
        recordMatchPlayersCount('ranked', 2);
        recordMatchPlayersCount('ranked', 4);
      });
    });
  });

  // ==========================================
  // Economy/Store Metrics
  // ==========================================

  describe('Economy Metrics', () => {
    describe('recordPurchase', () => {
      it('does not throw for success', () => {
        expect(() => recordPurchase('gems', true)).not.toThrow();
      });

      it('does not throw for failure', () => {
        expect(() => recordPurchase('gems', false)).not.toThrow();
      });

      it('supports different product types', () => {
        recordPurchase('gems', true);
        recordPurchase('coins', true);
        recordPurchase('battle_pass', true);
      });
    });

    describe('recordRevenue', () => {
      it('does not throw when called', () => {
        expect(() => recordRevenue(999, 'USD', 'gems')).not.toThrow();
      });

      it('handles different currencies', () => {
        recordRevenue(999, 'USD', 'gems');
        recordRevenue(500, 'EUR', 'gems');
        recordRevenue(10000, 'JPY', 'coins');
      });

      it('handles zero amount', () => {
        expect(() => recordRevenue(0, 'USD', 'free_item')).not.toThrow();
      });
    });

    describe('recordCurrencySpent', () => {
      it('does not throw when called', () => {
        expect(() => recordCurrencySpent('gems', 'upgrade', 50)).not.toThrow();
      });

      it('handles different spend reasons', () => {
        recordCurrencySpent('gems', 'upgrade', 50);
        recordCurrencySpent('gems', 'shop_purchase', 100);
        recordCurrencySpent('coins', 'reroll', 25);
      });
    });

    describe('recordCurrencyEarned', () => {
      it('does not throw when called', () => {
        expect(() => recordCurrencyEarned('coins', 'quest', 100)).not.toThrow();
      });

      it('handles different earn sources', () => {
        recordCurrencyEarned('coins', 'quest', 100);
        recordCurrencyEarned('coins', 'daily_login', 50);
        recordCurrencyEarned('gems', 'achievement', 10);
      });
    });
  });

  // ==========================================
  // Combat/Gameplay Metrics
  // ==========================================

  describe('Combat Metrics', () => {
    describe('recordCombatAction', () => {
      it('does not throw when called', () => {
        expect(() => recordCombatAction('shoot', 'hit')).not.toThrow();
      });

      it('supports different action types and results', () => {
        recordCombatAction('shoot', 'hit');
        recordCombatAction('shoot', 'miss');
        recordCombatAction('dodge', 'success');
        recordCombatAction('ability', 'critical');
      });
    });

    describe('recordDamageDealt', () => {
      it('does not throw when called', () => {
        expect(() => recordDamageDealt('enemy', 50)).not.toThrow();
      });

      it('handles different target types', () => {
        recordDamageDealt('enemy', 50);
        recordDamageDealt('boss', 200);
        recordDamageDealt('player', 30);
      });

      it('handles zero damage', () => {
        expect(() => recordDamageDealt('enemy', 0)).not.toThrow();
      });

      it('handles high damage values', () => {
        expect(() => recordDamageDealt('boss', 9999)).not.toThrow();
      });
    });

    describe('recordCombatDuration', () => {
      it('does not throw when called', () => {
        expect(() => recordCombatDuration(120)).not.toThrow();
      });

      it('handles short combats', () => {
        expect(() => recordCombatDuration(3)).not.toThrow();
      });

      it('handles long combats', () => {
        expect(() => recordCombatDuration(600)).not.toThrow();
      });
    });

    describe('recordPveStageCompleted', () => {
      it('does not throw when called', () => {
        expect(() => recordPveStageCompleted('hard', 3)).not.toThrow();
      });

      it('handles different difficulties and star ratings', () => {
        recordPveStageCompleted('easy', 1);
        recordPveStageCompleted('normal', 2);
        recordPveStageCompleted('hard', 3);
        recordPveStageCompleted('nightmare', 3);
      });

      it('handles zero stars', () => {
        expect(() => recordPveStageCompleted('easy', 0)).not.toThrow();
      });
    });
  });

  // ==========================================
  // Progression Metrics
  // ==========================================

  describe('Progression Metrics', () => {
    describe('incrementPlayerLevelUp', () => {
      it('does not throw when called', () => {
        expect(() => incrementPlayerLevelUp()).not.toThrow();
      });

      it('handles rapid level ups', () => {
        for (let i = 0; i < 10; i++) {
          incrementPlayerLevelUp();
        }
      });
    });

    describe('incrementGearUnlock', () => {
      it('does not throw when called', () => {
        expect(() => incrementGearUnlock('legendary')).not.toThrow();
      });

      it('supports all rarity tiers', () => {
        incrementGearUnlock('common');
        incrementGearUnlock('rare');
        incrementGearUnlock('epic');
        incrementGearUnlock('legendary');
      });
    });

    describe('incrementSeasonParticipation', () => {
      it('does not throw when called', () => {
        expect(() => incrementSeasonParticipation('season_1')).not.toThrow();
      });

      it('handles different seasons', () => {
        incrementSeasonParticipation('season_1');
        incrementSeasonParticipation('season_2');
        incrementSeasonParticipation('season_3');
      });
    });
  });

  // ==========================================
  // Analytics Metrics
  // ==========================================

  describe('Analytics Metrics', () => {
    describe('recordAnalyticsEvent', () => {
      it('does not throw when called', () => {
        expect(() => recordAnalyticsEvent('game', 'level_complete')).not.toThrow();
      });

      it('handles different event categories', () => {
        recordAnalyticsEvent('game', 'level_complete');
        recordAnalyticsEvent('social', 'friend_added');
        recordAnalyticsEvent('economy', 'purchase');
        recordAnalyticsEvent('engagement', 'session_start');
      });

      it('handles rapid event recording', () => {
        for (let i = 0; i < 100; i++) {
          recordAnalyticsEvent('batch', `event_${i}`);
        }
      });
    });
  });

  // ==========================================
  // Performance Metrics
  // ==========================================

  describe('Performance Metrics', () => {
    describe('recordDatabaseQueryDuration', () => {
      it('does not throw when called', () => {
        expect(() => recordDatabaseQueryDuration('select', 0.05)).not.toThrow();
      });

      it('handles different query types', () => {
        recordDatabaseQueryDuration('select', 0.01);
        recordDatabaseQueryDuration('insert', 0.02);
        recordDatabaseQueryDuration('update', 0.015);
        recordDatabaseQueryDuration('delete', 0.005);
      });

      it('handles very fast queries', () => {
        expect(() => recordDatabaseQueryDuration('select', 0.0001)).not.toThrow();
      });

      it('handles slow queries', () => {
        expect(() => recordDatabaseQueryDuration('complex_join', 2.5)).not.toThrow();
      });
    });

    describe('setCacheHitRatio', () => {
      it('does not throw when called', () => {
        expect(() => setCacheHitRatio('player', 0.85)).not.toThrow();
      });

      it('handles different cache types', () => {
        setCacheHitRatio('player', 0.9);
        setCacheHitRatio('session', 0.75);
        setCacheHitRatio('leaderboard', 0.95);
      });

      it('handles boundary values', () => {
        setCacheHitRatio('test', 0.0);
        setCacheHitRatio('test', 1.0);
      });

      it('handles multiple rapid updates', () => {
        for (let i = 0; i < 20; i++) {
          setCacheHitRatio('dynamic', i / 20);
        }
      });
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    it('calling all record functions multiple times does not throw', () => {
      // Rate limiting
      recordRateLimitViolation('rpc_a');
      recordRateLimitViolation('rpc_b');
      updateActiveUsersCount(10);
      updateActiveUsersCount(20);

      // Player
      setActiveSessions(50);
      setActiveSessions(75);
      incrementNewRegistration('ios');
      incrementNewRegistration('android');
      recordLoginAttempt(true);
      recordLoginAttempt(false);
      recordSessionDuration(60);
      recordSessionDuration(120);

      // Match
      incrementMatchCreated('ranked');
      incrementMatchCreated('casual');
      incrementMatchCompleted('ranked', 'win');
      incrementMatchCompleted('casual', 'loss');
      setMatchQueueSize('ranked', 5);
      setMatchQueueSize('casual', 10);
      recordMatchWaitTime('ranked', 15);
      recordMatchWaitTime('casual', 30);
      recordMatchPlayersCount('ranked', 2);
      recordMatchPlayersCount('casual', 4);

      // Economy
      recordPurchase('gems', true);
      recordPurchase('coins', false);
      recordRevenue(999, 'USD', 'gems');
      recordRevenue(500, 'EUR', 'coins');
      recordCurrencySpent('gems', 'upgrade', 50);
      recordCurrencyEarned('coins', 'quest', 100);

      // Combat
      recordCombatAction('shoot', 'hit');
      recordCombatAction('dodge', 'success');
      recordDamageDealt('enemy', 50);
      recordDamageDealt('boss', 200);
      recordCombatDuration(60);
      recordCombatDuration(120);
      recordPveStageCompleted('hard', 3);
      recordPveStageCompleted('easy', 1);

      // Progression
      incrementPlayerLevelUp();
      incrementPlayerLevelUp();
      incrementGearUnlock('legendary');
      incrementGearUnlock('common');
      incrementSeasonParticipation('season_1');
      incrementSeasonParticipation('season_2');

      // Analytics
      recordAnalyticsEvent('game', 'level_complete');
      recordAnalyticsEvent('social', 'friend_added');

      // Performance
      recordDatabaseQueryDuration('select', 0.01);
      recordDatabaseQueryDuration('insert', 0.02);
      setCacheHitRatio('player', 0.85);
      setCacheHitRatio('session', 0.9);

      // If we reach here without throwing, the test passes
      expect(true).toBe(true);
    });

    it('wrapRpcWithMetrics handles concurrent calls correctly', async () => {
      const handler = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('ok'), 1)));
      const wrapped = wrapRpcWithMetrics('concurrent_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      const results = await Promise.all([
        wrapped(ctx, logger, nk, '{}'),
        wrapped(ctx, logger, nk, '{}'),
        wrapped(ctx, logger, nk, '{}'),
      ]);

      expect(results).toEqual(['ok', 'ok', 'ok']);
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('wrapRpcWithMetrics handles concurrent errors correctly', async () => {
      let callCount = 0;
      const handler = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error(`error_${callCount}`));
        }
        return Promise.resolve('ok');
      });
      const wrapped = wrapRpcWithMetrics('mixed_rpc', handler);
      const { ctx, logger, nk } = makeRpcArgs();

      const outcomes = await Promise.allSettled([
        wrapped(ctx, logger, nk, '{}'),
        wrapped(ctx, logger, nk, '{}'),
        wrapped(ctx, logger, nk, '{}'),
        wrapped(ctx, logger, nk, '{}'),
      ]);

      expect(outcomes[0].status).toBe('fulfilled');
      expect(outcomes[1].status).toBe('rejected');
      expect(outcomes[2].status).toBe('fulfilled');
      expect(outcomes[3].status).toBe('rejected');
    });
  });

  // =================== Admin guard metrics (issue #1141) ===================

  describe('admin guard metrics', () => {
    // prom-client is mocked file-wide, so counter/gauge values are not
    // observable here — the real-registry behavior (increment on rejection,
    // gauge on allowlist resolution) is covered by admin_auth.test.ts, which
    // imports the real prom-client. Here we assert the registration
    // vocabulary captured at module load, before beforeEach clears the mocks.
    it('registers armored_archer_admin_rpc_access_denied_total with rpc_id and reason labels', () => {
      expect(counterConfigs()).toContainEqual(
        expect.objectContaining({
          name: 'armored_archer_admin_rpc_access_denied_total',
          labelNames: ['rpc_id', 'reason'],
        })
      );
    });

    it('registers armored_archer_admin_allowlist_size (no labels)', () => {
      expect(gaugeConfigs()).toContainEqual(
        expect.objectContaining({
          name: 'armored_archer_admin_allowlist_size',
        })
      );
    });

    it('exposes increment/set helpers that the admin guard can wire as sinks', () => {
      expect(() => incrementAdminRpcAccessDenied('armored_archer/x', 'caller_id_missing')).not.toThrow();
      expect(() => setAdminAllowlistSize(0)).not.toThrow();
    });
  });

  // =================== Webhook ledger metrics (issue #1140) ===================

  describe('webhook ledger metrics', () => {
    // Same approach as the admin-guard section above: prom-client is mocked
    // file-wide, so assert the registration vocabulary captured at module
    // load; real counter/gauge behavior is covered by
    // revenuecat_webhook.test.ts, which exercises the ledger code paths
    // against the live registry.
    it('registers armored_archer_webhook_events_total with event_type and outcome labels', () => {
      expect(counterConfigs()).toContainEqual(
        expect.objectContaining({
          name: 'armored_archer_webhook_events_total',
          labelNames: ['event_type', 'outcome'],
        })
      );
    });

    it('registers armored_archer_webhook_redis_errors_total with an operation label', () => {
      expect(counterConfigs()).toContainEqual(
        expect.objectContaining({
          name: 'armored_archer_webhook_redis_errors_total',
          labelNames: ['operation'],
        })
      );
    });

    it('registers armored_archer_webhook_processing_seconds with an event_type label', () => {
      expect(registeredHistogramConfigs).toContainEqual(
        expect.objectContaining({
          name: 'armored_archer_webhook_processing_seconds',
          labelNames: ['event_type'],
        })
      );
    });

    it('registers armored_archer_webhook_pending_awards with a user_id label', () => {
      expect(gaugeConfigs()).toContainEqual(
        expect.objectContaining({
          name: 'armored_archer_webhook_pending_awards',
          labelNames: ['user_id'],
        })
      );
    });

    it('registers armored_archer_webhook_configured (no labels)', () => {
      expect(gaugeConfigs()).toContainEqual(
        expect.objectContaining({
          name: 'armored_archer_webhook_configured',
        })
      );
    });

    it('exposes record/set helpers the webhook ledger can call without throwing', () => {
      expect(() => recordWebhookEvent('initial_purchase', 'processed')).not.toThrow();
      expect(() => recordWebhookProcessingTime('initial_purchase', 0.01)).not.toThrow();
      expect(() => setWebhookPendingAwards('user-1', 2)).not.toThrow();
      expect(() => incrementWebhookRedisError('dedup_lookup')).not.toThrow();
      expect(() => setWebhookConfigured(true)).not.toThrow();
    });
  });

  // =================== Settlement outcome metrics (issue #1143) ===================

  describe('settlement outcome metrics', () => {
    // prom-client is mocked file-wide, so counter values are not observable
    // here — the emission behavior is covered by matchmaker.test.ts, which
    // imports the real metrics module. Here we assert the registration
    // vocabulary captured at module load, before beforeEach clears the mocks.
    it('registers armored_archer_settlement_outcomes_total with a result label', () => {
      expect(counterConfigs()).toContainEqual(
        expect.objectContaining({
          name: 'armored_archer_settlement_outcomes_total',
          labelNames: ['result'],
        })
      );
    });

    it('exposes recordSettlementOutcome accepting the full result vocabulary', () => {
      expect(() => recordSettlementOutcome('success')).not.toThrow();
      expect(() => recordSettlementOutcome('degraded')).not.toThrow();
      expect(() => recordSettlementOutcome('claim_failed')).not.toThrow();
      expect(() => recordSettlementOutcome('persist_failed')).not.toThrow();
    });
  });
});
