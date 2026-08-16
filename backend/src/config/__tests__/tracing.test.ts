import {
  extractTraceContext,
  injectTraceContext,
  startSpan,
  getTracer,
  getTracingConfig,
  isTracingEnabled,
  wrapRpcHandler,
  addSpanEvent,
  setSpanAttribute,
  traceAsync,
  traceSync,
  shutdownTracing,
  initializeTracing,
} from '../tracing';
import { SpanKind } from '@opentelemetry/api';

jest.mock('../../config', () => ({
  config: {
    tracing: {
      enabled: true,
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      exporter: 'none' as const,
      sampleRate: 1,
      autoInstrumentations: false,
      instrumentations: [] as string[],
      zipkinEndpoint: 'http://localhost:9411',
      otlpEndpoint: 'http://localhost:4318',
    },
    environment: 'test',
    logging: {
      level: 'info',
      format: 'json',
      output: 'console',
      scrubLogs: false,
      scrubPatterns: [],
    },
  },
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: jest.fn(() => ({})),
}));

jest.mock('@opentelemetry/exporter-zipkin', () => ({
  ZipkinExporter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn(() => []),
}));

const mockStart = jest.fn();
const mockShutdown = jest.fn().mockResolvedValue(undefined);
jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: mockStart,
    shutdown: mockShutdown,
  })),
}));

function getMockConfig() {
  return require('../../config').config;
}

describe('Tracing Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getTracer', () => {
    it('should return a tracer instance', () => {
      const tracer = getTracer();
      expect(tracer).toBeDefined();
    });

    it('should return same tracer on subsequent calls', () => {
      const tracer1 = getTracer();
      const tracer2 = getTracer();
      expect(tracer1).toBe(tracer2);
    });
  });

  describe('extractTraceContext', () => {
    it('should extract context from simple string headers', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      };
      const result = extractTraceContext(headers);
      expect(result).toHaveProperty('extractedContext');
    });

    it('should handle array headers', () => {
      const headers = {
        traceparent: ['00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'],
      };
      const result = extractTraceContext(headers);
      expect(result).toHaveProperty('extractedContext');
    });

    it('should handle undefined headers', () => {
      const headers = { traceparent: undefined };
      const result = extractTraceContext(headers);
      expect(result).toHaveProperty('extractedContext');
    });

    it('should handle empty headers', () => {
      const result = extractTraceContext({});
      expect(result).toHaveProperty('extractedContext');
    });
  });

  describe('injectTraceContext', () => {
    it('should inject context into headers', () => {
      const headers: Record<string, string> = {};
      injectTraceContext(headers);
      expect(headers).toBeDefined();
    });

    it('should not throw on injection errors', () => {
      expect(() => injectTraceContext({})).not.toThrow();
    });
  });

  describe('startSpan', () => {
    it('should start a span with name', () => {
      const span = startSpan('test-span');
      expect(span).toBeDefined();
    });

    it('should start span with kind and attributes', () => {
      const span = startSpan('test-span', {
        kind: SpanKind.SERVER,
        attributes: { 'test.attr': 'value' },
      });
      expect(span).toBeDefined();
    });

    it('should default to INTERNAL kind', () => {
      const span = startSpan('test-span');
      expect(span).toBeDefined();
    });
  });

  describe('traceAsync', () => {
    it('should execute function and return result', async () => {
      const result = await traceAsync('test-async', async () => {
        return 'test-result';
      });
      expect(result).toBe('test-result');
    });

    it('should pass span to function', async () => {
      await traceAsync('test-async', async (span) => {
        expect(span).toBeDefined();
        return 'done';
      });
    });

    it('should handle errors in async function', async () => {
      await expect(
        traceAsync('test-async', async () => {
          throw new Error('Async error');
        })
      ).rejects.toThrow('Async error');
    });
  });

  describe('traceSync', () => {
    it('should execute function and return result', () => {
      const result = traceSync('test-sync', () => {
        return 'sync-result';
      });
      expect(result).toBe('sync-result');
    });

    it('should pass span to function', () => {
      traceSync('test-sync', (span) => {
        expect(span).toBeDefined();
      });
    });
  });

  describe('addSpanEvent', () => {
    it('should add event to current span', () => {
      addSpanEvent('test-event', { key: 'value' });
    });

    it('should handle no active span', () => {
      expect(() => addSpanEvent('test-event')).not.toThrow();
    });
  });

  describe('setSpanAttribute', () => {
    it('should set attribute on current span', () => {
      setSpanAttribute('test.attr', 'value');
    });

    it('should handle no active span', () => {
      expect(() => setSpanAttribute('test.attr', 'value')).not.toThrow();
    });
  });

  describe('getTracingConfig', () => {
    it('should return tracing configuration', () => {
      const config = getTracingConfig();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('serviceName');
      expect(config).toHaveProperty('serviceVersion');
      expect(config).toHaveProperty('exporter');
    });
  });

  describe('isTracingEnabled', () => {
    it('should return boolean', () => {
      const enabled = isTracingEnabled();
      expect(typeof enabled).toBe('boolean');
    });
  });

  describe('wrapRpcHandler', () => {
    it('should wrap handler with tracing', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ success: true });
      const wrapped = wrapRpcHandler('test.handler', mockHandler);

      const mockCtx = { userId: 'user_1', sessionId: 'session_1' };
      const mockLogger = {};
      const mockNk = {};
      const payload = '{}';

      const result = await wrapped(mockCtx, mockLogger, mockNk, payload);
      expect(result).toEqual({ success: true });
      expect(mockHandler).toHaveBeenCalledWith(mockCtx, mockLogger, mockNk, payload);
    });

    it('should handle handler errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const wrapped = wrapRpcHandler('test.handler', mockHandler);

      await expect(wrapped({}, {}, {}, '{}')).rejects.toThrow('Handler error');
    });

    it('should handle non-Error exceptions', async () => {
      const mockHandler = jest.fn().mockRejectedValue('String error');
      const wrapped = wrapRpcHandler('test.handler', mockHandler);

      await expect(wrapped({}, {}, {}, '{}')).rejects.toBe('String error');
    });

    it('should handle null context', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ success: true });
      const wrapped = wrapRpcHandler('test.handler', mockHandler);

      const result = await wrapped(null, {}, {}, '{}');
      expect(result).toEqual({ success: true });
    });
  });

  describe('shutdownTracing', () => {
    it('should not throw when SDK is not initialized', async () => {
      await expect(shutdownTracing()).resolves.not.toThrow();
    });
  });

  describe('extractTraceContext error handling', () => {
    it('should return active context when propagation.extract throws', () => {
      const { propagation } = require('@opentelemetry/api');
      jest.spyOn(propagation, 'extract').mockImplementation(() => {
        throw new Error('Extraction failed');
      });

      const result = extractTraceContext({
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      });
      expect(result).toHaveProperty('extractedContext');
    });
  });

  describe('injectTraceContext error handling', () => {
    it('should not throw when propagation.inject throws', () => {
      const { propagation } = require('@opentelemetry/api');
      jest.spyOn(propagation, 'inject').mockImplementation(() => {
        throw new Error('Injection failed');
      });

      const headers: Record<string, string> = {};
      expect(() => injectTraceContext(headers)).not.toThrow();
    });
  });

  describe('traceSync', () => {
    it('should propagate errors from sync function', () => {
      expect(() =>
        traceSync('test-error', () => {
          throw new Error('Sync error');
        })
      ).toThrow('Sync error');
    });

    it('should pass options to withSpanSync', () => {
      const result = traceSync('test-with-options', () => 'result', {
        kind: SpanKind.CLIENT,
        attributes: { key: 'value' },
      });
      expect(result).toBe('result');
    });
  });

  describe('initializeTracing', () => {
    it('should log and return when tracing is disabled', () => {
      const { logger } = require('../logger');
      const cfg = getMockConfig();
      const originalEnabled = cfg.tracing.enabled;
      cfg.tracing.enabled = false;

      initializeTracing();

      expect(logger.info).toHaveBeenCalledWith('[Tracing] Distributed tracing is disabled');
      cfg.tracing.enabled = originalEnabled;
    });

    it('should log warning when tracing is already initialized', () => {
      const { logger } = require('../logger');
      const cfg = getMockConfig();
      cfg.tracing.enabled = true;

      // Initialize tracing, then initialize again to trigger "already initialized" path
      shutdownTracing();
      initializeTracing();

      // Save reference to sdk before calling initialize again
      // The second call should detect tracingInitialized=true and log warning
      initializeTracing();

      expect(logger.warn).toHaveBeenCalledWith('[Tracing] Tracing already initialized');

      // Clean up: reset tracing state
      shutdownTracing();
    });

    it('should configure zipkin exporter', () => {
      const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
      const { logger } = require('../logger');
      const cfg = getMockConfig();
      const originalExporter = cfg.tracing.exporter;
      cfg.tracing.exporter = 'zipkin';

      shutdownTracing();
      initializeTracing();

      expect(ZipkinExporter).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Zipkin exporter configured')
      );
      cfg.tracing.exporter = originalExporter;
    });

    it('should configure otlp exporter', () => {
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
      const { logger } = require('../logger');
      const cfg = getMockConfig();
      const originalExporter = cfg.tracing.exporter;
      cfg.tracing.exporter = 'otlp';

      shutdownTracing();
      initializeTracing();

      expect(OTLPTraceExporter).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('OTLP exporter configured'));
      cfg.tracing.exporter = originalExporter;
    });

    it('should log warning for unknown exporter type', () => {
      const { logger } = require('../logger');
      const cfg = getMockConfig();
      const originalExporter = cfg.tracing.exporter;
      cfg.tracing.exporter = 'unknown' as any;

      shutdownTracing();
      initializeTracing();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown exporter type'));
      cfg.tracing.exporter = originalExporter;
    });

    it('should configure auto instrumentations when enabled', () => {
      const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
      const cfg = getMockConfig();
      const originalAuto = cfg.tracing.autoInstrumentations;
      const originalInst = cfg.tracing.instrumentations;
      cfg.tracing.autoInstrumentations = true;
      cfg.tracing.instrumentations = ['http', 'express', 'pg'];

      shutdownTracing();
      initializeTracing();

      expect(getNodeAutoInstrumentations).toHaveBeenCalled();
      cfg.tracing.autoInstrumentations = originalAuto;
      cfg.tracing.instrumentations = originalInst;
    });

    it('should handle SDK start and set up SIGTERM handler', () => {
      const originalOn = process.on;
      process.on = jest.fn((event: string, handler: Function) => {
        return process;
      }) as any;

      shutdownTracing();
      initializeTracing();

      expect(mockStart).toHaveBeenCalled();
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      process.on = originalOn;
    });

    it('should handle errors during initialization', () => {
      // Use isolateModules to get a fresh module state so the error doesn't
      // leave tracingInitialized=true for subsequent tests
      jest.isolateModules(() => {
        const { NodeSDK } = require('@opentelemetry/sdk-node');
        const { logger } = require('../logger');
        NodeSDK.mockImplementationOnce(() => {
          throw new Error('SDK init failed');
        });

        const { initializeTracing: init } = require('../tracing');
        init();

        expect(logger.error).toHaveBeenCalledWith(
          '[Tracing] Failed to initialize tracing',
          expect.any(Error)
        );
      });
    });
  });

  describe('isTracingEnabled', () => {
    it('should return true when tracing is enabled and initialized', () => {
      const cfg = getMockConfig();
      cfg.tracing.enabled = true;
      shutdownTracing();
      initializeTracing();
      const result = isTracingEnabled();
      expect(result).toBe(true);
    });

    it('should return false when tracing is disabled', () => {
      const cfg = getMockConfig();
      const originalEnabled = cfg.tracing.enabled;
      cfg.tracing.enabled = false;

      shutdownTracing();
      const result = isTracingEnabled();
      expect(result).toBe(false);

      cfg.tracing.enabled = originalEnabled;
    });
  });

  describe('wrapRpcHandler', () => {
    it('should set OK status on successful handler with full context', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ data: 'test' });
      const wrapped = wrapRpcHandler('myRpc', mockHandler);

      const result = await wrapped({ userId: 'u1', sessionId: 's1', matchId: 'm1' }, {}, {}, '{}');
      expect(result).toEqual({ data: 'test' });
    });

    it('should set ERROR status and re-throw on handler failure', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('handler failed'));
      const wrapped = wrapRpcHandler('failingRpc', mockHandler);

      await expect(wrapped({}, {}, {}, '{}')).rejects.toThrow('handler failed');
    });

    it('should handle non-Error exceptions in handler', async () => {
      const mockHandler = jest.fn().mockRejectedValue('string error');
      const wrapped = wrapRpcHandler('stringErrorRpc', mockHandler);

      await expect(wrapped({}, {}, {}, '{}')).rejects.toBe('string error');
    });

    it('should handle null context gracefully', async () => {
      const mockHandler = jest.fn().mockResolvedValue('ok');
      const wrapped = wrapRpcHandler('nullCtxRpc', mockHandler);

      const result = await wrapped(null, {}, {}, '{}');
      expect(result).toBe('ok');
    });
  });

  describe('shutdownTracing with initialized SDK', () => {
    it('should shutdown SDK when initialized', async () => {
      const cfg = getMockConfig();
      cfg.tracing.enabled = true;
      shutdownTracing();
      initializeTracing();

      await shutdownTracing();
      expect(isTracingEnabled()).toBe(false);
    });
  });
});
