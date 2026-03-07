import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
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

let tracingInitialized = false;
let sdk: NodeSDK | null = null;

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
    const resource = resourceFromAttributes({
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
    sdk = new NodeSDK({
      resource,
      traceExporter: exporter,
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
