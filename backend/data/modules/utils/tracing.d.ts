/**
 * Tracing utility module for distributed tracing integration.
 * Provides utilities for instrumenting Nakama RPC handlers with OpenTelemetry.
 */
import { Span } from '@opentelemetry/api';
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
export declare function getTracingTracer(): import("@opentelemetry/api").Tracer;
/**
 * Create a traced wrapper for an RPC handler function.
 * This wraps async functions with OpenTelemetry spans for distributed tracing.
 */
export declare function createTracedRpcHandler<TContext extends {
    userId?: string;
    sessionId?: string;
    matchId?: string;
}, TNakama>(handlerName: string, handler: (ctx: TContext, logger: unknown, nk: TNakama, payload: string) => Promise<string> | string, options?: {
    attributes?: Record<string, string | number | boolean>;
}): (ctx: TContext, logger: unknown, nk: TNakama, payload: string) => Promise<string> | string;
/**
 * Execute an async function within a traced span.
 * Provides a simpler API than createTracedRpcHandler for inline usage.
 */
export declare function traceAsync<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
/**
 * Execute a function with tracing for database operations.
 */
export declare function traceDbOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T>;
/**
 * Execute a function with tracing for cache operations.
 */
export declare function traceCacheOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T>;
/**
 * Execute a function with tracing for external service calls.
 */
export declare function traceExternalCall<T>(serviceName: string, operationName: string, operation: () => Promise<T>): Promise<T>;
/**
 * Add custom event to current active span.
 */
export declare function addTracingEvent(eventName: string, attributes?: Record<string, string | number | boolean>): void;
/**
 * Set attribute on current active span.
 */
export declare function setTracingAttribute(key: string, value: string | number | boolean): void;
