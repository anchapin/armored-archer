/**
 * Shared tracing utilities for consistent span handling across the codebase.
 * This module extracts common patterns for async operations with OpenTelemetry spans.
 */

import { Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { config } from '../config';

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
 * Get the tracer instance for manual instrumentation.
 * This is a local copy to avoid circular imports.
 */
function getTracingTracer() {
  return trace.getTracer(config.tracing.serviceName, config.tracing.serviceVersion);
}

/**
 * Handle span error state consistently.
 */
function setSpanError(span: Span, error: unknown): void {
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error),
  });
  span.recordException(error instanceof Error ? error : new Error(String(error)));
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
export async function withSpanAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: WithSpanOptions
): Promise<T> {
  const tracer = getTracingTracer();
  const span = tracer.startSpan(name, {
    kind: options?.kind,
    attributes: options?.attributes,
  });

  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    setSpanError(span, error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Execute a synchronous function within a traced span with consistent error handling.
 *
 * @param name - The name of the span
 * @param fn - The function to execute within the span
 * @param options - Optional span configuration
 * @returns The result of the function
 */
export function withSpanSync<T>(name: string, fn: (span: Span) => T, options?: WithSpanOptions): T {
  const tracer = getTracingTracer();
  const span = tracer.startSpan(name, {
    kind: options?.kind,
    attributes: options?.attributes,
  });

  try {
    const result = fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    setSpanError(span, error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Create a span with active tracking using startActiveSpan.
 * This is useful for operations that need automatic child span creation.
 *
 * @param name - The name of the span
 * @param fn - The async function to execute within the span
 * @returns The result of the async function
 */
export async function withActiveSpanAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracingTracer();

  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      setSpanError(span, error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Set standard span attributes from Nakama runtime context.
 *
 * @param span - The span to set attributes on
 * @param context - The Nakama runtime context
 */
export function setNakamaContextAttributes(
  span: Span,
  context: { userId?: string; sessionId?: string; matchId?: string }
): void {
  if (context.userId) {
    span.setAttribute('user.id', context.userId);
  }
  if (context.sessionId) {
    span.setAttribute('session.id', context.sessionId);
  }
  if (context.matchId) {
    span.setAttribute('match.id', context.matchId);
  }
}
