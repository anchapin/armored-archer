import { Counter, Histogram, Registry, collectDefaultMetrics, Gauge } from 'prom-client';
import { config } from '../config';
import { Runtime } from '../types/nakama';
import * as rateLimiter from '../utils/rateLimiter';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import {
  captureRpcError,
  setSessionContext,
  clearContext,
  SessionContext,
  GameStateContext,
  errorTrackingConfig,
} from '../config/errorTracking';

const register = new Registry();

collectDefaultMetrics({ register });

const rpcCallsTotal = new Counter({
  name: 'armored_archer_rpc_calls_total',
  help: 'Total number of RPC calls',
  labelNames: ['rpc', 'status'] as const,
  registers: [register],
});

const rpcDurationSeconds = new Histogram({
  name: 'armored_archer_rpc_duration_seconds',
  help: 'RPC call duration in seconds',
  labelNames: ['rpc'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const rpcErrorsTotal = new Counter({
  name: 'armored_archer_rpc_errors_total',
  help: 'Total number of RPC errors',
  labelNames: ['rpc', 'error_type'] as const,
  registers: [register],
});

const rateLimitViolationsTotal = new Counter({
  name: 'armored_archer_rate_limit_violations_total',
  help: 'Total number of rate limit violations',
  labelNames: ['rpc'] as const,
  registers: [register],
});

const rateLimitActiveUsers = new Gauge({
  name: 'armored_archer_rate_limit_active_users',
  help: 'Number of users currently being rate limited',
  registers: [register],
});

rateLimiter.setMetricsCallbacks(recordRateLimitViolation, updateActiveUsersCount);

export function registerRpcMetrics(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/metrics', rpcGetMetrics);
}

async function rpcGetMetrics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Metrics endpoint called by user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.health_check, payload, 'metrics');
  if (!validation.success) {
    return createValidationErrorResponse('metrics', validation.error);
  }

  // Get metrics in Prometheus text format
  const metrics = await register.metrics();

  return metrics;
}

export type RpcHandler = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string | Promise<string>;

export function wrapRpcWithMetrics(rpcName: string, handler: RpcHandler): RpcHandler {
  return async function (
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): Promise<string> {
    const endTimer = rpcDurationSeconds.startTimer({ rpc: rpcName });

    // Set up session context for error tracking if enabled
    let sessionContext: SessionContext | undefined;
    if (errorTrackingConfig.enabled && errorTrackingConfig.includeSessionContext) {
      const userId = ctx.userId || 'anonymous';
      sessionContext = {
        userId,
        sessionId: ctx.sessionExpiry ? `expiry:${ctx.sessionExpiry}` : undefined,
        serverRegion: typeof ctx.env === 'string' ? ctx.env : JSON.stringify(ctx.env),
      };
      // Only set context if we have valid userId
      if (userId && userId !== 'anonymous') {
        setSessionContext(sessionContext);
      }
    }

    try {
      const result = await handler(ctx, logger, nk, payload);
      rpcCallsTotal.inc({ rpc: rpcName, status: 'success' });
      return result;
    } catch (error) {
      const errorType = error instanceof Error ? error.constructor.name : 'unknown';
      rpcCallsTotal.inc({ rpc: rpcName, status: 'error' });
      rpcErrorsTotal.inc({ rpc: rpcName, error_type: errorType });

      // Capture error with contextual information for debugging
      if (error instanceof Error && errorTrackingConfig.enabled) {
        captureRpcError(
          rpcName,
          ctx.userId || 'anonymous',
          error,
          payload,
          sessionContext,
          undefined // gameStateContext would need to be fetched separately
        );
      }

      throw error;
    } finally {
      endTimer();
      // Clear context to prevent leakage between requests
      if (errorTrackingConfig.enabled) {
        clearContext();
      }
    }
  };
}

export function registerRpcWithMetrics(
  initializer: Runtime.Initializer,
  rpcId: string,
  rpcName: string,
  handler: RpcHandler
): void {
  const wrappedHandler = wrapRpcWithMetrics(rpcName, handler);
  initializer.registerRpc(rpcId, wrappedHandler);
}

export function registerRpcWithRateLimit(
  initializer: Runtime.Initializer,
  rpcId: string,
  rpcName: string,
  handler: RpcHandler
): void {
  if (!config.rateLimit.enabled) {
    registerRpcWithMetrics(initializer, rpcId, rpcName, handler);
    return;
  }

  const endpointConfig = config.rateLimit.endpoints[rpcName];
  if (endpointConfig) {
    rateLimiter.setEndpointRateLimit(rpcName, endpointConfig);
  }

  const wrappedWithRateLimit = rateLimiter.createRateLimitedRpcHandler(rpcName, handler);
  const wrappedWithMetrics = wrapRpcWithMetrics(rpcName, wrappedWithRateLimit);

  initializer.registerRpc(rpcId, wrappedWithMetrics);
}

export function getMetricsRegistry(): Registry {
  return register;
}

export function recordRateLimitViolation(rpcName: string): void {
  rateLimitViolationsTotal.inc({ rpc: rpcName });
}

export function updateActiveUsersCount(count: number): void {
  rateLimitActiveUsers.set(count);
}
