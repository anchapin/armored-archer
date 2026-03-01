import { Runtime } from "../types/nakama";
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const register = new Registry();
import { validatePayload, ZodSchemas, createValidationErrorResponse } from "./validation";

collectDefaultMetrics({ register });

const rpcCallsTotal = new Counter({
  name: 'armored_archer_rpc_calls_total',
  help: 'Total number of RPC calls',
  labelNames: ['rpc', 'status'] as const,
  registers: [register]
});

const rpcDurationSeconds = new Histogram({
  name: 'armored_archer_rpc_duration_seconds',
  help: 'RPC call duration in seconds',
  labelNames: ['rpc'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register]
});

const rpcErrorsTotal = new Counter({
  name: 'armored_archer_rpc_errors_total',
  help: 'Total number of RPC errors',
  labelNames: ['rpc', 'error_type'] as const,
  registers: [register]
});

export function registerRpcMetrics(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/metrics", rpcGetMetrics);
}

function rpcGetMetrics(ctx: Runtime.Context, logger: Runtime.Logger, _nk: Runtime.Nakama, payload: string): string {
  logger.info("Metrics endpoint called by user: %s", ctx.userId);

  const validation = validatePayload(ZodSchemas.health_check, payload, "metrics");
  if (!validation.success) {
    return createValidationErrorResponse("metrics", validation.error);
  }

  register.metrics().then(metrics => {
    return metrics;
  });
  return JSON.stringify({ message: "Metrics are being collected asynchronously" });
}

export type RpcHandler = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string;

export function wrapRpcWithMetrics(rpcName: string, handler: RpcHandler): RpcHandler {
  return function(
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): string {
    const endTimer = rpcDurationSeconds.startTimer({ rpc: rpcName });
    
    try {
      const result = handler(ctx, logger, nk, payload);
      rpcCallsTotal.inc({ rpc: rpcName, status: 'success' });
      return result;
    } catch (error) {
      const errorType = error instanceof Error ? error.constructor.name : 'unknown';
      rpcCallsTotal.inc({ rpc: rpcName, status: 'error' });
      rpcErrorsTotal.inc({ rpc: rpcName, error_type: errorType });
      throw error;
    } finally {
      endTimer();
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

export function getMetricsRegistry(): Registry {
  return register;
}
