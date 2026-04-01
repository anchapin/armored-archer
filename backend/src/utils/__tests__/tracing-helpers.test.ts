/**
 * Tests for tracing-helpers utility
 */

import { withSpanAsync, withSpanSync, withActiveSpanAsync, setNakamaContextAttributes } from '../tracing-helpers';

// Mock OpenTelemetry
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn().mockReturnValue({
      startSpan: jest.fn().mockReturnValue({
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
        setAttribute: jest.fn(),
      }),
      startActiveSpan: jest.fn().mockImplementation((_name, fn) => {
        const span = {
          setStatus: jest.fn(),
          recordException: jest.fn(),
          end: jest.fn(),
          setAttribute: jest.fn(),
        };
        return fn(span);
      }),
    }),
  },
  SpanStatusCode: {
    OK: 0,
    ERROR: 1,
  },
  SpanKind: {
    INTERNAL: 1,
    SERVER: 2,
    CLIENT: 3,
  },
}));

jest.mock('../../config', () => ({
  config: {
    tracing: {
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
    },
  },
}));

describe('tracing-helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withSpanAsync', () => {
    it('should execute function and return result', async () => {
      const result = await withSpanAsync('test_span', async () => {
        return 'success';
      });
      expect(result).toBe('success');
    });

    it('should set OK status on success', async () => {
      await withSpanAsync('test_span', async () => 'ok');
    });

    it('should handle errors and set ERROR status', async () => {
      await expect(
        withSpanAsync('test_span', async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });

    it('should handle non-Error thrown values', async () => {
      await expect(
        withSpanAsync('test_span', async () => {
          throw 'string error';
        })
      ).rejects.toBe('string error');
    });

    it('should accept options with attributes', async () => {
      const result = await withSpanAsync(
        'test_span',
        async () => 'result',
        { attributes: { key: 'value' } }
      );
      expect(result).toBe('result');
    });

    it('should accept options with kind', async () => {
      const result = await withSpanAsync(
        'test_span',
        async () => 'result',
        { kind: 2 }
      );
      expect(result).toBe('result');
    });

    it('should accept options with both kind and attributes', async () => {
      const result = await withSpanAsync(
        'test_span',
        async () => 'result',
        { kind: 1, attributes: { foo: 'bar', count: 42, flag: true } }
      );
      expect(result).toBe('result');
    });
  });

  describe('withSpanSync', () => {
    it('should execute sync function and return result', () => {
      const result = withSpanSync('test_span', () => 'sync_result');
      expect(result).toBe('sync_result');
    });

    it('should handle sync errors', () => {
      expect(() =>
        withSpanSync('test_span', () => {
          throw new Error('sync error');
        })
      ).toThrow('sync error');
    });

    it('should handle non-Error thrown values in sync', () => {
      expect(() =>
        withSpanSync('test_span', () => {
          throw 'sync string error';
        })
      ).toThrow('sync string error');
    });

    it('should accept options with kind and attributes', () => {
      const result = withSpanSync(
        'test_span',
        () => 'ok',
        { kind: 3, attributes: { key: 'val' } }
      );
      expect(result).toBe('ok');
    });
  });

  describe('withActiveSpanAsync', () => {
    it('should execute function within active span and return result', async () => {
      const result = await withActiveSpanAsync('active_span', async () => {
        return 'active_result';
      });
      expect(result).toBe('active_result');
    });

    it('should handle errors and set ERROR status', async () => {
      await expect(
        withActiveSpanAsync('active_span', async () => {
          throw new Error('active error');
        })
      ).rejects.toThrow('active error');
    });

    it('should handle non-Error thrown values', async () => {
      await expect(
        withActiveSpanAsync('active_span', async () => {
          throw 42;
        })
      ).rejects.toBe(42);
    });

    it('should pass span to the callback', async () => {
      const result = await withActiveSpanAsync('active_span', async (span) => {
        expect(span).toBeDefined();
        expect(typeof span.setStatus).toBe('function');
        return 'with_span';
      });
      expect(result).toBe('with_span');
    });
  });

  describe('setNakamaContextAttributes', () => {
    it('should set user.id attribute', () => {
      const mockSpan = { setAttribute: jest.fn() } as any;
      setNakamaContextAttributes(mockSpan, { userId: 'user123' });
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('user.id', 'user123');
    });

    it('should set session.id attribute', () => {
      const mockSpan = { setAttribute: jest.fn() } as any;
      setNakamaContextAttributes(mockSpan, { sessionId: 'session456' });
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('session.id', 'session456');
    });

    it('should set match.id attribute', () => {
      const mockSpan = { setAttribute: jest.fn() } as any;
      setNakamaContextAttributes(mockSpan, { matchId: 'match789' });
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('match.id', 'match789');
    });

    it('should skip undefined values', () => {
      const mockSpan = { setAttribute: jest.fn() } as any;
      setNakamaContextAttributes(mockSpan, {});
      expect(mockSpan.setAttribute).not.toHaveBeenCalled();
    });

    it('should set all attributes when provided', () => {
      const mockSpan = { setAttribute: jest.fn() } as any;
      setNakamaContextAttributes(mockSpan, {
        userId: 'user1',
        sessionId: 'sess1',
        matchId: 'match1',
      });
      expect(mockSpan.setAttribute).toHaveBeenCalledTimes(3);
    });
  });
});
