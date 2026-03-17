/**
 * Shared tracing utilities for consistent span handling across the codebase.
 * This module extracts common patterns for async operations with OpenTelemetry spans.
 */
import { Span } from '@opentelemetry/api';
/**
 * Options for withSpanAsync
 */
export interface WithSpanOptions {
    /** Span kind (server, client, internal, etc.) */
    kind?: import('@opentelemetry/api').SpanKind;
    /** Additional attributes to add to the span */
    attributes?: Record<string, string | number | boolean>;
}
/**
 * Execute an async function within a traced span with consistent error handling.
 * This is the shared implementation for tracing async operations.
 *
 * @param name - The name of the span
 * @param fn - The async function to execute within the span
 * @param options - Optional span configuration
 * @returns The result of the async function
 */
export declare function withSpanAsync<T>(name: string, fn: (span: Span) => Promise<T>, options?: WithSpanOptions): Promise<T>;
/**
 * Execute a synchronous function within a traced span with consistent error handling.
 *
 * @param name - The name of the span
 * @param fn - The function to execute within the span
 * @param options - Optional span configuration
 * @returns The result of the function
 */
export declare function withSpanSync<T>(name: string, fn: (span: Span) => T, options?: WithSpanOptions): T;
/**
 * Create a span with active tracking using startActiveSpan.
 * This is useful for operations that need automatic child span creation.
 *
 * @param name - The name of the span
 * @param fn - The async function to execute within the span
 * @returns The result of the async function
 */
export declare function withActiveSpanAsync<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
/**
 * Set standard span attributes from Nakama runtime context.
 *
 * @param span - The span to set attributes on
 * @param context - The Nakama runtime context
 */
export declare function setNakamaContextAttributes(span: Span, context: {
    userId?: string;
    sessionId?: string;
    matchId?: string;
}): void;
