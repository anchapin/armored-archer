/**
 * Tracing utility module for distributed tracing integration.
 * Provides utilities for instrumenting Nakama RPC handlers with OpenTelemetry.
 */

import { Span, SpanKind, SpanStatusCode, trace, context } from '@opentelemetry/api';
import { config } from '../config';

/**
 * Wrapper options for traced RPC handlers.
 */
export interface TracedRpcOptions {
  /** The name of the RPC method */
  rpcName: string;
  /** Additional attributes to add to the span */
  attributes?: Record<string, string | number | boolean>;
  /** Whether to trace database operations */
  traceDb?: boolean;
  /** Whether to trace cache operations */
  traceCache?: boolean;
}

/**
 * Get the tracer instance for manual instrumentation.
 */
export function getTracingTracer() {
  return trace.getTracer(config.tracing.serviceName, config.tracing.serviceVersion);
}

/**
 * Create a traced wrapper for an RPC handler function.
 * This wraps async functions with OpenTelemetry spans for distributed tracing.
 */
export function createTracedRpcHandler<
  TContext extends { userId?: string; sessionId?: string; matchId?: string },
  TNakama,
>(
  handlerName: string,
  handler: (
    ctx: TContext,
    logger: unknown,
    nk: TNakama,
    payload: string
  ) => Promise<string> | string,
  options?: {
    attributes?: Record<string, string | number | boolean>;
  }
): (ctx: TContext, logger: unknown, nk: TNakama, payload: string) => Promise<string> | string {
  return async (ctx: TContext, logger: unknown, nk: TNakama, payload: string) => {
    const tracer = getTracingTracer();
    const span = tracer.startSpan(`rpc.${handlerName}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'rpc.system': 'nakama',
        'rpc.method': handlerName,
        'deployment.environment': config.environment,
        ...(options?.attributes || {}),
      },
    });

    // Add user context if available
    if (ctx.userId) {
      span.setAttribute('user.id', ctx.userId);
    }
    if (ctx.sessionId) {
      span.setAttribute('session.id', ctx.sessionId);
    }
    if (ctx.matchId) {
      span.setAttribute('match.id', ctx.matchId);
    }

    try {
      const result = await handler(ctx, logger, nk, payload);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  };
}

/**
 * Execute an async function within a traced span.
 * Provides a simpler API than createTracedRpcHandler for inline usage.
 */
export async function traceAsync<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  const tracer = getTracingTracer();
  const span = tracer.startSpan(name);

  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Execute a function with tracing for database operations.
 */
export async function traceDbOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const tracer = getTracingTracer();

  return tracer.startActiveSpan(`db.${operationName}`, async (span) => {
    try {
      span.setAttribute('db.system', 'postgresql');
      span.setAttribute('db.operation', operationName);

      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Execute a function with tracing for cache operations.
 */
export async function traceCacheOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const tracer = getTracingTracer();

  return tracer.startActiveSpan(`cache.${operationName}`, async (span) => {
    try {
      span.setAttribute('cache.system', 'memory');
      span.setAttribute('cache.operation', operationName);

      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Execute a function with tracing for external service calls.
 */
export async function traceExternalCall<T>(
  serviceName: string,
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const tracer = getTracingTracer();

  return tracer.startActiveSpan(`external.${serviceName}.${operationName}`, async (span) => {
    try {
      span.setAttribute('peer.service', serviceName);
      span.setAttribute('http.method', operationName);

      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Add custom event to current active span.
 */
export function addTracingEvent(
  eventName: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) {
    activeSpan.addEvent(eventName, attributes);
  }
}

/**
 * Set attribute on current active span.
 */
export function setTracingAttribute(key: string, value: string | number | boolean): void {
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) {
    activeSpan.setAttribute(key, value);
  }
}
