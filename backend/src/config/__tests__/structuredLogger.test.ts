/**
 * StructuredLogger Unit Tests
 */

import { StructuredLogger, createRpcContext, createSystemEventContext, LogLevel } from '../structuredLogger';
import { LogScrubber } from '../logScrubber';

// Mock Runtime.Logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Disabled scrubber for testing the scrub bypass branch
const disabledScrubber = new LogScrubber({ enabled: false });

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

describe('StructuredLogger with disabled scrubber', () => {
  let logger: StructuredLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new StructuredLogger(
      mockLogger as any,
      'test-service',
      { defaultKey: 'defaultValue' },
      disabledScrubber
    );
  });

  it('should log info without scrubbing when scrubber is disabled', () => {
    logger.info('Sensitive info', { password: 'secret123' });
    expect(mockLogger.info).toHaveBeenCalled();
    const logged = JSON.parse(mockLogger.info.mock.calls[0][0]);
    expect(logged.message).toBe('Sensitive info');
  });

  it('should log warn without scrubbing when scrubber is disabled', () => {
    logger.warn('Warning', { token: 'abc' });
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should log error without scrubbing when scrubber is disabled', () => {
    logger.error('Error', { apiKey: 'key123' });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should log debug without scrubbing when scrubber is disabled', () => {
    logger.debug('Debug', { secret: 'value' });
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should create child logger that inherits disabled scrubber', () => {
    const childLogger = logger.child({ childKey: 'childValue' });
    childLogger.info('Child message', { password: 'secret' });
    expect(mockLogger.info).toHaveBeenCalled();
  });
});

describe('StructuredLogger default parameter branches', () => {
  let logger: StructuredLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new StructuredLogger(mockLogger as any, 'test-service');
  });

  it('should use default empty context for info()', () => {
    logger.info('No context arg');
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('should use default empty context for warn()', () => {
    logger.warn('No context arg');
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should use default empty context for error() without context and error', () => {
    logger.error('No context or error');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should use default empty context for debug()', () => {
    logger.debug('No context arg');
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should use default empty context for logSystemEvent()', () => {
    logger.logSystemEvent('info', 'test_event');
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('should call logRpcEntry without payload to use default', () => {
    logger.logRpcEntry('rpc', 'user1', 'req1');
    expect(mockLogger.info).toHaveBeenCalled();
  });
});

describe('StructuredLogger error with stack trace', () => {
  let logger: StructuredLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new StructuredLogger(mockLogger as any, 'test-service');
  });

  it('should include stack trace in error log entry', () => {
    const error = new Error('Something failed');
    logger.error('Error with stack', { context: 'test' }, error);
    expect(mockLogger.error).toHaveBeenCalled();
    const logged = JSON.parse(mockLogger.error.mock.calls[0][0]);
    expect(logged.stack).toBeDefined();
    expect(logged.stack).toContain('Error: Something failed');
  });

  it('should not include stack trace when no error provided', () => {
    logger.error('Error without stack', { context: 'test' });
    expect(mockLogger.error).toHaveBeenCalled();
    const logged = JSON.parse(mockLogger.error.mock.calls[0][0]);
    expect(logged.stack).toBeUndefined();
  });
});

describe('createRpcContext branch coverage', () => {
  it('should include all optional fields when provided', () => {
    const context = createRpcContext({
      rpcName: 'testRpc',
      userId: 'user123',
      requestId: 'req456',
      payload: { data: 'test' },
    });
    expect(context.rpcName).toBe('testRpc');
    expect(context.userId).toBe('user123');
    expect(context.requestId).toBe('req456');
    expect(context.payload).toBe('{"data":"test"}');
  });

  it('should exclude userId when not provided', () => {
    const context = createRpcContext({ rpcName: 'testRpc', requestId: 'req456' });
    expect(context.userId).toBeUndefined();
    expect(context.requestId).toBe('req456');
  });

  it('should exclude requestId when not provided', () => {
    const context = createRpcContext({ rpcName: 'testRpc', userId: 'user123' });
    expect(context.requestId).toBeUndefined();
    expect(context.userId).toBe('user123');
  });

  it('should exclude payload when not provided', () => {
    const context = createRpcContext({ rpcName: 'testRpc' });
    expect(context.payload).toBeUndefined();
  });

  it('should handle string payload', () => {
    const context = createRpcContext({ rpcName: 'testRpc', payload: 'raw-string' });
    expect(context.payload).toBe('raw-string');
  });
});
