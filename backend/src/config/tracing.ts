import {
  Context,
  Span,
  SpanKind,
  SpanStatusCode,
  trace,
  context,
  propagation,
} from '@opentelemetry/api';
import { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

import { config } from '../config';
import { logger } from './logger';

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

let tracingInitialized = false;
let sdk: NodeSDK | null = null;
let tracer: ReturnType<typeof trace.getTracer> | null = null;

/**
 * Get the OpenTelemetry tracer instance.
 * Creates a new tracer if tracing is enabled, otherwise returns a no-op tracer.
 */
export function getTracer(): ReturnType<typeof trace.getTracer> {
  if (!tracer) {
    tracer = trace.getTracer(config.tracing.serviceName, config.tracing.serviceVersion);
  }
  return tracer;
}

/**
 * Extract trace context from HTTP headers (W3C Trace Context format).
 * This enables distributed trace context propagation across service calls.
 */
export function extractTraceContext(headers: Record<string, string | string[] | undefined>): {
  extractedContext: Context;
} {
  try {
    // Use OpenTelemetry's built-in W3C Trace Context propagation
    const carrier: Record<string, string> = {};

    // Convert headers to simple string record
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        carrier[key] = value[0];
      } else if (value) {
        carrier[key] = value;
      }
    }

    const extracted = propagation.extract(context.active(), carrier);
    return { extractedContext: extracted };
  } catch (error) {
    logger.warn('[Tracing] Failed to extract trace context', { error });
    return { extractedContext: context.active() };
  }
}

/**
 * Inject current trace context into headers for outgoing requests.
 * Uses W3C Trace Context format for standardized propagation.
 */
export function injectTraceContext(headers: Record<string, string>): void {
  try {
    propagation.inject(context.active(), headers);
  } catch (error) {
    logger.warn('[Tracing] Failed to inject trace context', { error });
  }
}

/**
 * Start a new span with optional parent context.
 */
export function startSpan(
  name: string,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): Span {
  const tracer = getTracer();

  return tracer.startSpan(name, {
    kind: options?.kind || SpanKind.INTERNAL,
    attributes: options?.attributes || {},
  });
}

/**
 * Execute a function within a traced span.
 * Automatically handles span creation, status, and end.
 */
export async function traceAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const span = startSpan(name, options);

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
 * Execute a synchronous function within a traced span.
 */
export function traceSync<T>(
  name: string,
  fn: (span: Span) => T,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): T {
  const span = startSpan(name, options);

  try {
    const result = fn(span);
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
 * Add event to current span.
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) {
    activeSpan.addEvent(name, attributes);
  }
}

/**
 * Set attribute on current span.
 */
export function setSpanAttribute(key: string, value: string | number | boolean): void {
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) {
    activeSpan.setAttribute(key, value);
  }
}

/**
 * Wrap an RPC handler with tracing.
 * Automatically creates spans with relevant Nakama context information.
 */
export function wrapRpcHandler<T>(
  handlerName: string,
  handler: (ctx: unknown, logger: unknown, nk: unknown, payload: string) => Promise<T> | T
): (ctx: unknown, logger: unknown, nk: unknown, payload: string) => Promise<T> | T {
  return async (ctx: unknown, logger: unknown, nk: unknown, payload: string) => {
    const span = startSpan(`rpc.${handlerName}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'rpc.system': 'nakama',
        'rpc.method': handlerName,
        'deployment.environment': config.environment,
      },
    });

    // Add context attributes if available
    const nakamaCtx = ctx as { userId?: string; sessionId?: string; matchId?: string } | null;
    if (nakamaCtx?.userId) {
      span.setAttribute('user.id', nakamaCtx.userId);
    }
    if (nakamaCtx?.sessionId) {
      span.setAttribute('session.id', nakamaCtx.sessionId);
    }
    if (nakamaCtx?.matchId) {
      span.setAttribute('match.id', nakamaCtx.matchId);
    }

    try {
      const result = await handler(ctx, logger, nk, payload);
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
  };
}

/**
 * Initialize the OpenTelemetry tracing SDK.
 */
export function initializeTracing(): void {
  const tracingConfig = config.tracing;

  if (!tracingConfig.enabled) {
    logger.info('[Tracing] Distributed tracing is disabled');
    return;
  }

  if (tracingInitialized) {
    logger.warn('[Tracing] Tracing already initialized');
    return;
  }

  try {
    // Create resource with service information
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: tracingConfig.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: tracingConfig.serviceVersion,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.environment,
    });

    // Set up exporters based on configuration
    let exporter;
    switch (tracingConfig.exporter) {
      case 'jaeger':
        exporter = new JaegerExporter({
          endpoint: tracingConfig.jaegerEndpoint || 'http://localhost:14268',
        });
        logger.info(`[Tracing] Jaeger exporter configured: ${tracingConfig.jaegerEndpoint}`);
        break;
      case 'zipkin':
        exporter = new ZipkinExporter({
          url: tracingConfig.zipkinEndpoint || 'http://localhost:9411',
        });
        logger.info(`[Tracing] Zipkin exporter configured: ${tracingConfig.zipkinEndpoint}`);
        break;
      case 'otlp':
        exporter = new OTLPTraceExporter({
          url: tracingConfig.otlpEndpoint || 'http://localhost:4318',
        });
        logger.info(`[Tracing] OTLP exporter configured: ${tracingConfig.otlpEndpoint}`);
        break;
      case 'none':
        logger.info('[Tracing] Tracing initialized without exporter (for development)');
        break;
      default:
        logger.warn(`[Tracing] Unknown exporter type: ${tracingConfig.exporter}`);
        break;
    }

    // Build instrumentations list
    let instrumentations: unknown[] = [];

    if (tracingConfig.autoInstrumentations) {
      const autoInst = getNodeAutoInstrumentations({
        // Only enable specified instrumentations
        '@opentelemetry/instrumentation-http': {
          enabled: tracingConfig.instrumentations.includes('http'),
        },
        '@opentelemetry/instrumentation-express': {
          enabled: tracingConfig.instrumentations.includes('express'),
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: tracingConfig.instrumentations.includes('pg'),
        },
      });
      // getNodeAutoInstrumentations returns an array
      instrumentations = autoInst as unknown[];
    }

    // Create and start the SDK
    // Note: Type assertion needed due to version mismatch between exporters in dependency tree
    sdk = new NodeSDK({
      resource,
      traceExporter: exporter as any,
      instrumentations: instrumentations as never[],
      serviceName: tracingConfig.serviceName,
    });

    // Start the SDK
    sdk.start();
    logger.info(
      `[Tracing] OpenTelemetry SDK started - service: ${tracingConfig.serviceName}, environment: ${config.environment}`
    );

    tracingInitialized = true;

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('[Tracing] Shutting down OpenTelemetry SDK');
      sdk?.shutdown().catch((err) => {
        logger.error('[Tracing] Error shutting down SDK', err);
      });
    });
  } catch (error) {
    logger.error('[Tracing] Failed to initialize tracing', error);
  }
}

/**
 * Get the current tracing configuration.
 */
export function getTracingConfig(): TracingConfig {
  return config.tracing;
}

/**
 * Check if tracing is enabled.
 */
export function isTracingEnabled(): boolean {
  return config.tracing.enabled && tracingInitialized;
}

/**
 * Shutdown the tracing SDK.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    tracingInitialized = false;
    logger.info('[Tracing] Tracing SDK shut down');
  }
}
