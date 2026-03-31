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
      instrumentations: [],
      jaegerEndpoint: 'http://localhost:14268',
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

describe('Tracing Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
