/**
 * Tests for logger module helper functions
 */

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setContext: jest.fn(),
  setUser: jest.fn(),
  flush: jest.fn(),
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  process.env = originalEnv;
});

describe('logger helpers', () => {
  describe('createRpcMetadata', () => {
    it('creates metadata with rpcName only', () => {
      const { createRpcMetadata } = require('../logger');
      const metadata = createRpcMetadata({ rpcName: 'test_rpc' });
      expect(metadata).toEqual({ rpcName: 'test_rpc' });
    });

    it('includes userId when provided', () => {
      const { createRpcMetadata } = require('../logger');
      const metadata = createRpcMetadata({ rpcName: 'test_rpc', userId: 'user-123' });
      expect(metadata.userId).toBe('user-123');
    });

    it('includes requestId when provided', () => {
      const { createRpcMetadata } = require('../logger');
      const metadata = createRpcMetadata({ rpcName: 'test_rpc', requestId: 'req-456' });
      expect(metadata.requestId).toBe('req-456');
    });

    it('stringifies object payload', () => {
      const { createRpcMetadata } = require('../logger');
      const metadata = createRpcMetadata({ rpcName: 'test_rpc', payload: { key: 'value' } });
      expect(metadata.payload).toBe('{"key":"value"}');
    });

    it('passes through string payload', () => {
      const { createRpcMetadata } = require('../logger');
      const metadata = createRpcMetadata({ rpcName: 'test_rpc', payload: 'raw string' });
      expect(metadata.payload).toBe('raw string');
    });

    it('excludes payload when not provided', () => {
      const { createRpcMetadata } = require('../logger');
      const metadata = createRpcMetadata({ rpcName: 'test_rpc' });
      expect(metadata.payload).toBeUndefined();
    });

    it('includes all fields when provided', () => {
      const { createRpcMetadata } = require('../logger');
      const metadata = createRpcMetadata({
        rpcName: 'test_rpc',
        userId: 'user-1',
        requestId: 'req-1',
        payload: { data: 'test' },
      });
      expect(metadata.rpcName).toBe('test_rpc');
      expect(metadata.userId).toBe('user-1');
      expect(metadata.requestId).toBe('req-1');
      expect(metadata.payload).toBe('{"data":"test"}');
    });
  });

  describe('createSystemEventMetadata', () => {
    it('creates metadata with event name', () => {
      const { createSystemEventMetadata } = require('../logger');
      const metadata = createSystemEventMetadata('server_start');
      expect(metadata).toEqual({ event: 'server_start' });
    });

    it('merges additional data', () => {
      const { createSystemEventMetadata } = require('../logger');
      const metadata = createSystemEventMetadata('config_change', { key: 'value', count: 42 });
      expect(metadata.event).toBe('config_change');
      expect(metadata.key).toBe('value');
      expect(metadata.count).toBe(42);
    });

    it('handles empty data object', () => {
      const { createSystemEventMetadata } = require('../logger');
      const metadata = createSystemEventMetadata('heartbeat', {});
      expect(metadata.event).toBe('heartbeat');
      expect(Object.keys(metadata).length).toBe(1);
    });
  });

  describe('logRpcEntry', () => {
    it('logs RPC entry with payload', () => {
      const { logRpcEntry } = require('../logger');
      expect(() => logRpcEntry('get_stats', 'user-1', 'req-1', { stat: 'xp' })).not.toThrow();
    });

    it('logs RPC entry without payload', () => {
      const { logRpcEntry } = require('../logger');
      expect(() => logRpcEntry('get_stats', 'user-1', 'req-1')).not.toThrow();
    });

    it('logs RPC entry with string payload', () => {
      const { logRpcEntry } = require('../logger');
      expect(() => logRpcEntry('get_stats', 'user-1', 'req-1', '{"stat":"xp"}')).not.toThrow();
    });

    it('logs RPC entry with null payload', () => {
      const { logRpcEntry } = require('../logger');
      expect(() => logRpcEntry('get_stats', 'user-1', 'req-1', null)).not.toThrow();
    });
  });

  describe('logRpcExit', () => {
    it('logs RPC exit with duration', () => {
      const { logRpcExit } = require('../logger');
      expect(() => logRpcExit('get_stats', 'user-1', 'req-1', 150)).not.toThrow();
    });

    it('logs RPC exit with zero duration', () => {
      const { logRpcExit } = require('../logger');
      expect(() => logRpcExit('get_stats', 'user-1', 'req-1', 0)).not.toThrow();
    });
  });

  describe('logRpcError', () => {
    it('logs RPC error with message', () => {
      const { logRpcError } = require('../logger');
      const error = new Error('Database timeout');
      expect(() => logRpcError('get_stats', 'user-1', 'req-1', error, 5000)).not.toThrow();
    });

    it('logs RPC error with empty message', () => {
      const { logRpcError } = require('../logger');
      const error = new Error('');
      expect(() => logRpcError('get_stats', 'user-1', 'req-1', error, 100)).not.toThrow();
    });

    it('logs RPC error with stack trace', () => {
      const { logRpcError } = require('../logger');
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.ts:1:1';
      expect(() => logRpcError('get_stats', 'user-1', 'req-1', error, 50)).not.toThrow();
    });
  });

  describe('logSystemEvent', () => {
    it('logs system event at info level', () => {
      const { logSystemEvent } = require('../logger');
      expect(() => logSystemEvent('info', 'server_start', { version: '1.0' })).not.toThrow();
    });

    it('logs system event at warn level', () => {
      const { logSystemEvent } = require('../logger');
      expect(() => logSystemEvent('warn', 'config_deprecated', { key: 'old_key' })).not.toThrow();
    });

    it('logs system event at error level', () => {
      const { logSystemEvent } = require('../logger');
      expect(() => logSystemEvent('error', 'db_connection_failed', { host: 'localhost' })).not.toThrow();
    });

    it('logs system event at debug level', () => {
      const { logSystemEvent } = require('../logger');
      expect(() => logSystemEvent('debug', 'cache_init', { size: 100 })).not.toThrow();
    });

    it('logs system event without data', () => {
      const { logSystemEvent } = require('../logger');
      expect(() => logSystemEvent('info', 'heartbeat')).not.toThrow();
    });
  });

  describe('logCacheOperation', () => {
    it('logs cache hit', () => {
      const { logCacheOperation } = require('../logger');
      expect(() => logCacheOperation('hit', 'player_cache', 'player:123')).not.toThrow();
    });

    it('logs cache miss', () => {
      const { logCacheOperation } = require('../logger');
      expect(() => logCacheOperation('miss', 'player_cache', 'player:456')).not.toThrow();
    });

    it('logs cache set with metadata', () => {
      const { logCacheOperation } = require('../logger');
      expect(() => logCacheOperation('set', 'player_cache', 'player:789', { ttl: 300 })).not.toThrow();
    });

    it('logs cache delete', () => {
      const { logCacheOperation } = require('../logger');
      expect(() => logCacheOperation('delete', 'player_cache', 'player:999')).not.toThrow();
    });

    it('logs cache clear', () => {
      const { logCacheOperation } = require('../logger');
      expect(() => logCacheOperation('clear', 'session_cache', 'all')).not.toThrow();
    });

    it('logs cache destroy', () => {
      const { logCacheOperation } = require('../logger');
      expect(() => logCacheOperation('destroy', 'temp_cache', 'all')).not.toThrow();
    });
  });

  describe('logDatabaseOperation', () => {
    it('logs database read', () => {
      const { logDatabaseOperation } = require('../logger');
      expect(() => logDatabaseOperation('read', 'players', { count: 10 })).not.toThrow();
    });

    it('logs database write', () => {
      const { logDatabaseOperation } = require('../logger');
      expect(() => logDatabaseOperation('write', 'players', { id: '123' })).not.toThrow();
    });

    it('logs database delete', () => {
      const { logDatabaseOperation } = require('../logger');
      expect(() => logDatabaseOperation('delete', 'players', { id: '456' })).not.toThrow();
    });

    it('logs database list', () => {
      const { logDatabaseOperation } = require('../logger');
      expect(() => logDatabaseOperation('list', 'players', { limit: 100 })).not.toThrow();
    });

    it('logs database operation without metadata', () => {
      const { logDatabaseOperation } = require('../logger');
      expect(() => logDatabaseOperation('read', 'players')).not.toThrow();
    });
  });

  describe('captureRpcErrorWithContext', () => {
    it('captures RPC error with full context', () => {
      const { captureRpcErrorWithContext } = require('../logger');
      const error = new Error('Test error');
      expect(() =>
        captureRpcErrorWithContext(
          'submit_combat',
          'user-1',
          'req-1',
          error,
          200,
          '{"action":"attack"}',
          { userId: 'user-1', sessionId: 'sess-1' },
          { level: 5, health: 100 }
        )
      ).not.toThrow();
    });

    it('captures RPC error without optional context', () => {
      const { captureRpcErrorWithContext } = require('../logger');
      const error = new Error('Test error');
      expect(() =>
        captureRpcErrorWithContext('submit_combat', 'user-1', 'req-1', error, 200)
      ).not.toThrow();
    });

    it('captures RPC error with only session context', () => {
      const { captureRpcErrorWithContext } = require('../logger');
      const error = new Error('Test error');
      expect(() =>
        captureRpcErrorWithContext(
          'submit_combat',
          'user-1',
          'req-1',
          error,
          200,
          undefined,
          { userId: 'user-1', sessionId: 'sess-1' }
        )
      ).not.toThrow();
    });
  });
});
