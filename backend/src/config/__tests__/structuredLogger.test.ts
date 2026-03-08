/**
 * StructuredLogger Unit Tests
 */

import { StructuredLogger, createRpcContext, createSystemEventContext, LogLevel } from '../structuredLogger';

// Mock Runtime.Logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('StructuredLogger', () => {
  let logger: StructuredLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new StructuredLogger(mockLogger as any, 'test-service', { defaultKey: 'defaultValue' });
  });

  describe('constructor', () => {
    it('should create a logger with custom service name', () => {
      const customLogger = new StructuredLogger(mockLogger as any, 'custom-service');
      expect(customLogger).toBeDefined();
    });

    it('should create a logger with default context', () => {
      const customLogger = new StructuredLogger(mockLogger as any, 'test', { contextKey: 'contextValue' });
      expect(customLogger).toBeDefined();
    });
  });

  describe('child', () => {
    it('should create a child logger with merged context', () => {
      const childLogger = logger.child({ childKey: 'childValue' });
      expect(childLogger).toBeDefined();
      expect(childLogger).toBeInstanceOf(StructuredLogger);
    });
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test info message', { key: 'value' });
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log warn messages', () => {
      logger.warn('Test warn message', { key: 'value' });
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Test error message', { key: 'value' });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should include error stack trace when provided', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', { key: 'value' }, error);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should log debug messages', () => {
      logger.debug('Test debug message', { key: 'value' });
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('logRpcEntry', () => {
    it('should log RPC entry with context', () => {
      logger.logRpcEntry('testRpc', 'user123', 'req456', { payload: 'test' });
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log RPC entry without payload', () => {
      logger.logRpcEntry('testRpc', 'user123', 'req456');
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('logRpcExit', () => {
    it('should log RPC exit with duration', () => {
      logger.logRpcExit('testRpc', 'user123', 'req456', 150);
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('logRpcError', () => {
    it('should log RPC error with error details', () => {
      const error = new Error('RPC failed');
      logger.logRpcError('testRpc', 'user123', 'req456', error, 100);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('logSystemEvent', () => {
    it('should log system event with info level', () => {
      logger.logSystemEvent('info', 'system_init', { version: '1.0' });
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log system event with warn level', () => {
      logger.logSystemEvent('warn', 'config_changed', { key: 'value' });
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should log system event with error level', () => {
      logger.logSystemEvent('error', 'system_error', { code: 500 });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log system event with debug level', () => {
      logger.logSystemEvent('debug', 'debug_info', { data: 'test' });
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('logCacheOperation', () => {
    it('should log cache hit', () => {
      logger.logCacheOperation('hit', 'player-cache', 'player:123');
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log cache miss', () => {
      logger.logCacheOperation('miss', 'player-cache', 'player:456');
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log cache set', () => {
      logger.logCacheOperation('set', 'player-cache', 'player:789', { ttl: 300 });
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log cache delete', () => {
      logger.logCacheOperation('delete', 'player-cache', 'player:999');
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log cache clear', () => {
      logger.logCacheOperation('clear', 'player-cache', 'all');
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('logDatabaseOperation', () => {
    it('should log database read', () => {
      logger.logDatabaseOperation('read', 'players', { count: 10 });
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log database write', () => {
      logger.logDatabaseOperation('write', 'players', { id: '123' });
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log database delete', () => {
      logger.logDatabaseOperation('delete', 'players', { id: '456' });
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log database list', () => {
      logger.logDatabaseOperation('list', 'players', { limit: 100 });
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});

describe('createRpcContext', () => {
  it('should create RPC context with required fields', () => {
    const context = createRpcContext({ rpcName: 'testRpc' });
    expect(context.rpcName).toBe('testRpc');
  });

  it('should include userId when provided', () => {
    const context = createRpcContext({ rpcName: 'testRpc', userId: 'user123' });
    expect(context.userId).toBe('user123');
  });

  it('should include requestId when provided', () => {
    const context = createRpcContext({ rpcName: 'testRpc', requestId: 'req456' });
    expect(context.requestId).toBe('req456');
  });

  it('should stringify object payload', () => {
    const context = createRpcContext({ rpcName: 'testRpc', payload: { key: 'value' } });
    expect(context.payload).toBe('{"key":"value"}');
  });

  it('should pass through string payload', () => {
    const context = createRpcContext({ rpcName: 'testRpc', payload: 'string payload' });
    expect(context.payload).toBe('string payload');
  });
});

describe('createSystemEventContext', () => {
  it('should create system event context', () => {
    const context = createSystemEventContext('event_name', { key: 'value' });
    expect(context.event).toBe('event_name');
    expect(context.key).toBe('value');
  });

  it('should create system event context with empty data', () => {
    const context = createSystemEventContext('event_name');
    expect(context.event).toBe('event_name');
  });
});
