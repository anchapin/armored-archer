/**
 * Tests for tracing utility
 */

import {
  getTracingTracer,
  createTracedRpcHandler,
  traceAsync,
  traceDbOperation,
  traceCacheOperation,
  traceExternalCall,
  addTracingEvent,
  setTracingAttribute,
} from '../tracing';

// Mock OpenTelemetry - must be before imports
jest.mock('@opentelemetry/api', () => {
  const mockSpan = {
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
    addEvent: jest.fn(),
  };

  return {
    trace: {
      getTracer: jest.fn().mockReturnValue({
        startSpan: jest.fn().mockReturnValue(mockSpan),
        startActiveSpan: jest
          .fn()
          .mockImplementation((_name: string, _opts: unknown, fn: unknown) => {
            const callback = typeof _opts === 'function' ? _opts : fn;
            return (callback as (span: typeof mockSpan) => unknown)(mockSpan);
          }),
      }),
      getSpan: jest.fn().mockReturnValue(mockSpan),
    },
    context: {
      active: jest.fn().mockReturnValue({}),
    },
    SpanKind: {
      SERVER: 'SERVER',
    },
    SpanStatusCode: {
      OK: 0,
      ERROR: 1,
    },
  };
});

jest.mock('../../config', () => ({
  config: {
    tracing: {
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
    },
    environment: 'test',
  },
}));

jest.mock('../tracing-helpers', () => {
  const mockSpan = {
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
    addEvent: jest.fn(),
  };
  return {
    withSpanAsync: jest
      .fn()
      .mockImplementation(
        async (_name: string, fn: (span: typeof mockSpan) => Promise<unknown>) => {
          return fn(mockSpan);
        }
      ),
    withActiveSpanAsync: jest
      .fn()
      .mockImplementation(
        async (_name: string, fn: (span: typeof mockSpan) => Promise<unknown>) => {
          return fn(mockSpan);
        }
      ),
  };
});

describe('tracing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTracingTracer', () => {
    it('should return a tracer', () => {
      const tracer = getTracingTracer();
      expect(tracer).toBeDefined();
    });
  });

  describe('createTracedRpcHandler', () => {
    it('should wrap handler and return result', async () => {
      const handler = jest.fn().mockResolvedValue('{"result":"ok"}');
      const wrapped = createTracedRpcHandler('test_method', handler);

      const ctx = { userId: 'user1', sessionId: 'sess1' };
      const result = await wrapped(ctx, {}, {}, '{}');

      expect(result).toBe('{"result":"ok"}');
      expect(handler).toHaveBeenCalled();
    });

    it('should handle errors and set error status', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('handler error'));
      const wrapped = createTracedRpcHandler('failing_method', handler);

      await expect(wrapped({}, {}, {}, '{}')).rejects.toThrow('handler error');
    });

    it('should add user context attributes', async () => {
      const handler = jest.fn().mockResolvedValue('{}');
      const wrapped = createTracedRpcHandler('ctx_method', handler);

      await wrapped({ userId: 'u1', sessionId: 's1', matchId: 'm1' }, {}, {}, '{}');
    });
  });

  describe('traceAsync', () => {
    it('should execute function within span', async () => {
      const result = await traceAsync('test_op', async () => {
        return 'traced_result';
      });
      expect(result).toBe('traced_result');
    });
  });

  describe('traceDbOperation', () => {
    it('should trace database operation', async () => {
      const result = await traceDbOperation('get_user', async () => {
        return { id: 1 };
      });
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('traceCacheOperation', () => {
    it('should trace cache operation', async () => {
      const result = await traceCacheOperation('get_cached', async () => {
        return 'cached_value';
      });
      expect(result).toBe('cached_value');
    });
  });

  describe('traceExternalCall', () => {
    it('should trace external service call', async () => {
      const result = await traceExternalCall('payment_service', 'charge', async () => {
        return { charged: true };
      });
      expect(result).toEqual({ charged: true });
    });
  });

  describe('addTracingEvent', () => {
    it('should add event to active span', () => {
      addTracingEvent('custom_event', { key: 'value' });
    });
  });

  describe('setTracingAttribute', () => {
    it('should set attribute on active span', () => {
      setTracingAttribute('custom.attr', 'custom_value');
    });
  });
});
