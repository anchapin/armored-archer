import { Context, Span, SpanKind, trace } from '@opentelemetry/api';
/**
 * Configuration for distributed tracing.
 */
export interface TracingConfig {
    enabled: boolean;
    serviceName: string;
    serviceVersion: string;
    exporter: 'jaeger' | 'zipkin' | 'otlp' | 'none';
    sampleRate: number;
    jaegerEndpoint?: string;
    zipkinEndpoint?: string;
    otlpEndpoint?: string;
    autoInstrumentations: boolean;
    instrumentations: string[];
}
/**
 * Trace context carrier for propagating trace information across service boundaries.
 */
export interface TraceContext {
    traceId?: string;
    spanId?: string;
    traceFlags?: number;
    traceState?: string;
}
/**
 * Options for creating a traced function wrapper.
 */
export interface TracedFunctionOptions {
    name: string;
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
}
/**
 * Get the OpenTelemetry tracer instance.
 * Creates a new tracer if tracing is enabled, otherwise returns a no-op tracer.
 */
export declare function getTracer(): ReturnType<typeof trace.getTracer>;
/**
 * Extract trace context from HTTP headers (W3C Trace Context format).
 * This enables distributed trace context propagation across service calls.
 */
export declare function extractTraceContext(headers: Record<string, string | string[] | undefined>): {
    extractedContext: Context;
};
/**
 * Inject current trace context into headers for outgoing requests.
 * Uses W3C Trace Context format for standardized propagation.
 */
export declare function injectTraceContext(headers: Record<string, string>): void;
/**
 * Start a new span with optional parent context.
 */
export declare function startSpan(name: string, options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
}): Span;
/**
 * Execute a function within a traced span.
 * Automatically handles span creation, status, and end.
 */
export declare function traceAsync<T>(name: string, fn: (span: Span) => Promise<T>, options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
}): Promise<T>;
/**
 * Execute a synchronous function within a traced span.
 */
export declare function traceSync<T>(name: string, fn: (span: Span) => T, options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
}): T;
/**
 * Add event to current span.
 */
export declare function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void;
/**
 * Set attribute on current span.
 */
export declare function setSpanAttribute(key: string, value: string | number | boolean): void;
/**
 * Wrap an RPC handler with tracing.
 * Automatically creates spans with relevant Nakama context information.
 */
export declare function wrapRpcHandler<T>(handlerName: string, handler: (ctx: unknown, logger: unknown, nk: unknown, payload: string) => Promise<T> | T): (ctx: unknown, logger: unknown, nk: unknown, payload: string) => Promise<T> | T;
/**
 * Initialize the OpenTelemetry tracing SDK.
 */
export declare function initializeTracing(): void;
/**
 * Get the current tracing configuration.
 */
export declare function getTracingConfig(): TracingConfig;
/**
 * Check if tracing is enabled.
 */
export declare function isTracingEnabled(): boolean;
/**
 * Shutdown the tracing SDK.
 */
export declare function shutdownTracing(): Promise<void>;
