import {
  logRpcEntry,
  logRpcExit,
  logRpcError,
  logSystemEvent,
  logCacheOperation,
  logDatabaseOperation,
  captureRpcErrorWithContext,
  createRpcMetadata,
  createSystemEventMetadata,
} from '../logger';
import { captureRpcError } from '../errorTracking';

describe('logger branch coverage', () => {
  it('logRpcEntry executes without error', () => {
    expect(() => logRpcEntry('test_rpc', 'user-1', 'req-123', { foo: 'bar' })).not.toThrow();
  });

  it('logRpcEntry with null payload executes without error', () => {
    expect(() => logRpcEntry('test_rpc', 'user-1', 'req-123', null)).not.toThrow();
  });

  it('logRpcEntry with string payload', () => {
    expect(() => logRpcEntry('test_rpc', 'user-1', 'req-123', '{"key":"val"}')).not.toThrow();
  });

  it('logRpcEntry with undefined payload', () => {
    expect(() => logRpcEntry('test_rpc', 'user-1', 'req-123')).not.toThrow();
  });

  it('logRpcExit executes without error', () => {
    expect(() => logRpcExit('test_rpc', 'user-1', 'req-123', 123)).not.toThrow();
  });

  it('logRpcError executes without error', () => {
    const error = new Error('fail');
    expect(() => logRpcError('test_rpc', 'user-1', 'req-123', error, 456)).not.toThrow();
  });

  it('logRpcError with empty message executes without error', () => {
    const error = new Error('');
    expect(() => logRpcError('test_rpc', 'user-1', 'req-123', error, 1)).not.toThrow();
  });

  it('captureRpcError executes without error', () => {
    const error = new Error('test');
    expect(() => captureRpcError('test_rpc', 'user-1', error, '{}')).not.toThrow();
  });

  // --- logSystemEvent branches ---

  it('logSystemEvent at info level', () => {
    expect(() => logSystemEvent('info', 'server_start', { version: '1.0' })).not.toThrow();
  });

  it('logSystemEvent at warn level', () => {
    expect(() => logSystemEvent('warn', 'deprecated_call')).not.toThrow();
  });

  it('logSystemEvent at error level', () => {
    expect(() => logSystemEvent('error', 'db_failure', { host: 'localhost' })).not.toThrow();
  });

  it('logSystemEvent at debug level', () => {
    expect(() => logSystemEvent('debug', 'cache_init')).not.toThrow();
  });

  it('logSystemEvent without data parameter', () => {
    expect(() => logSystemEvent('info', 'heartbeat')).not.toThrow();
  });

  // --- logCacheOperation branches ---

  it('logCacheOperation hit', () => {
    expect(() => logCacheOperation('hit', 'player_cache', 'key-1')).not.toThrow();
  });

  it('logCacheOperation miss', () => {
    expect(() => logCacheOperation('miss', 'player_cache', 'key-2')).not.toThrow();
  });

  it('logCacheOperation set with metadata', () => {
    expect(() => logCacheOperation('set', 'cache', 'k', { ttl: 60 })).not.toThrow();
  });

  it('logCacheOperation delete', () => {
    expect(() => logCacheOperation('delete', 'cache', 'k')).not.toThrow();
  });

  it('logCacheOperation clear', () => {
    expect(() => logCacheOperation('clear', 'cache', '*')).not.toThrow();
  });

  it('logCacheOperation destroy', () => {
    expect(() => logCacheOperation('destroy', 'cache', '*')).not.toThrow();
  });

  // --- logDatabaseOperation branches ---

  it('logDatabaseOperation read', () => {
    expect(() => logDatabaseOperation('read', 'players', { id: '1' })).not.toThrow();
  });

  it('logDatabaseOperation write', () => {
    expect(() => logDatabaseOperation('write', 'players')).not.toThrow();
  });

  it('logDatabaseOperation delete', () => {
    expect(() => logDatabaseOperation('delete', 'players', { id: '2' })).not.toThrow();
  });

  it('logDatabaseOperation list', () => {
    expect(() => logDatabaseOperation('list', 'players')).not.toThrow();
  });

  // --- captureRpcErrorWithContext branches ---

  it('captureRpcErrorWithContext with all optional params', () => {
    const error = new Error('test');
    expect(() =>
      captureRpcErrorWithContext(
        'rpc',
        'user-1',
        'req-1',
        error,
        200,
        '{"data":1}',
        { userId: 'u', sessionId: 's' },
        { level: 5 }
      )
    ).not.toThrow();
  });

  it('captureRpcErrorWithContext without optional params', () => {
    const error = new Error('test');
    expect(() => captureRpcErrorWithContext('rpc', 'user-1', 'req-1', error, 100)).not.toThrow();
  });

  it('captureRpcErrorWithContext with only payload', () => {
    const error = new Error('test');
    expect(() =>
      captureRpcErrorWithContext('rpc', 'user-1', 'req-1', error, 50, '{}')
    ).not.toThrow();
  });

  it('captureRpcErrorWithContext with only session context', () => {
    const error = new Error('test');
    expect(() =>
      captureRpcErrorWithContext('rpc', 'user-1', 'req-1', error, 50, undefined, {
        userId: 'u',
        sessionId: 's',
      })
    ).not.toThrow();
  });

  // --- createRpcMetadata branches ---

  it('createRpcMetadata with all fields', () => {
    const meta = createRpcMetadata({
      rpcName: 'test',
      userId: 'u',
      requestId: 'r',
      payload: { key: 'val' },
    });
    expect(meta.rpcName).toBe('test');
    expect(meta.userId).toBe('u');
    expect(meta.requestId).toBe('r');
    expect(meta.payload).toBe('{"key":"val"}');
  });

  it('createRpcMetadata with string payload', () => {
    const meta = createRpcMetadata({ rpcName: 'test', payload: 'raw' });
    expect(meta.payload).toBe('raw');
  });

  it('createRpcMetadata with no optional fields', () => {
    const meta = createRpcMetadata({ rpcName: 'test' });
    expect(meta.userId).toBeUndefined();
    expect(meta.requestId).toBeUndefined();
    expect(meta.payload).toBeUndefined();
  });

  // --- createSystemEventMetadata branches ---

  it('createSystemEventMetadata with data', () => {
    const meta = createSystemEventMetadata('evt', { a: 1 });
    expect(meta.event).toBe('evt');
    expect(meta.a).toBe(1);
  });

  it('createSystemEventMetadata without data', () => {
    const meta = createSystemEventMetadata('evt');
    expect(meta.event).toBe('evt');
  });

  it('createSystemEventMetadata with empty data', () => {
    const meta = createSystemEventMetadata('evt', {});
    expect(meta.event).toBe('evt');
    expect(Object.keys(meta)).toHaveLength(1);
  });
});
