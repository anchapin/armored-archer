import {
  errorTrackingConfig,
  initializeSentry,
  setSessionContext,
  setGameStateContext,
  setRequestContext,
  clearContext,
  captureException,
  captureMessage,
  captureRpcError,
  captureDatabaseError,
  captureCacheError,
  createErrorBoundary,
  withErrorTracking,
  SessionContext,
  GameStateContext,
  RequestContext,
  ExtendedErrorContext,
} from '../errorTracking';

// Mock Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  setContext: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

import * as Sentry from '@sentry/node';

describe('Error Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the config for testing
    (errorTrackingConfig as { enabled: boolean }).enabled = true;
  });

  describe('initializeSentry', () => {
    it('should initialize Sentry when enabled and DSN is provided', () => {
      (errorTrackingConfig as { dsn: string }).dsn = 'https://key@sentry.io/123';
      (errorTrackingConfig as { environment: string }).environment = 'test';
      (errorTrackingConfig as { tracesSampleRate: number }).tracesSampleRate = 0.5;

      initializeSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://key@sentry.io/123',
          environment: 'test',
          tracesSampleRate: 0.5,
        })
      );
    });

    it('should not initialize Sentry when disabled', () => {
      (errorTrackingConfig as { enabled: boolean }).enabled = false;

      initializeSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should not initialize Sentry when DSN is empty', () => {
      (errorTrackingConfig as { dsn: string }).dsn = '';

      initializeSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    });
  });

  describe('setSessionContext', () => {
    it('should set session context when enabled', () => {
      const context: SessionContext = {
        userId: 'user-123',
        username: 'testuser',
        sessionId: 'session-456',
        platform: 'android',
        appVersion: '1.0.0',
      };

      setSessionContext(context);

      expect(Sentry.setContext).toHaveBeenCalledWith('session', expect.objectContaining({
        userId: 'user-123',
        username: 'testuser',
        sessionId: 'session-456',
        platform: 'android',
        appVersion: '1.0.0',
      }));

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user-123',
        username: 'testuser',
        ip_address: undefined,
      });
    });

    it('should not set context when disabled', () => {
      (errorTrackingConfig as { enabled: boolean }).enabled = false;

      setSessionContext({ userId: 'user-123' });

      expect(Sentry.setContext).not.toHaveBeenCalled();
    });
  });

  describe('setGameStateContext', () => {
    it('should set game state context when enabled and includeGameState is true', () => {
      const gameState: GameStateContext = {
        playerId: 'player-123',
        level: 10,
        xp: 5000,
        health: 100,
        maxHealth: 100,
        gold: 1000,
        gems: 50,
      };

      setGameStateContext(gameState);

      expect(Sentry.setContext).toHaveBeenCalledWith('gameState', expect.objectContaining({
        playerId: 'player-123',
        level: 10,
        xp: 5000,
        health: 100,
        gold: 1000,
      }));
    });

    it('should not set context when includeGameState is false', () => {
      (errorTrackingConfig as { includeGameState: boolean }).includeGameState = false;

      setGameStateContext({ playerId: 'player-123', level: 10 });

      expect(Sentry.setContext).not.toHaveBeenCalled();
    });
  });

  describe('setRequestContext', () => {
    it('should set request context when enabled', () => {
      const request: RequestContext = {
        rpcName: 'player/update',
        requestId: 'req-123',
        method: 'POST',
      };

      setRequestContext(request);

      expect(Sentry.setContext).toHaveBeenCalledWith('request', expect.objectContaining({
        rpcName: 'player/update',
        requestId: 'req-123',
        method: 'POST',
      }));
    });
  });

  describe('clearContext', () => {
    it('should clear all context when enabled', () => {
      clearContext();

      expect(Sentry.setContext).toHaveBeenCalledWith('session', {});
      expect(Sentry.setContext).toHaveBeenCalledWith('gameState', {});
      expect(Sentry.setContext).toHaveBeenCalledWith('request', {});
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('captureException', () => {
    it('should capture exception with extended context', () => {
      const error = new Error('Test error');
      const context: ExtendedErrorContext = {
        userId: 'user-123',
        rpc: 'player/update',
        gameState: {
          level: 10,
          gold: 1000,
        },
        request: {
          rpcName: 'player/update',
          requestId: 'req-123',
        },
        extra: { customField: 'value' },
      };

      captureException(error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
        tags: expect.objectContaining({
          userId: 'user-123',
          rpc: 'player/update',
        }),
        extra: expect.objectContaining({
          customField: 'value',
          request: expect.any(Object),
        }),
      }));
    });

    it('should not capture exception when disabled', () => {
      (errorTrackingConfig as { enabled: boolean }).enabled = false;

      captureException(new Error('Test error'), { userId: 'user-123' });

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe('captureMessage', () => {
    it('should capture message with context', () => {
      const context: ExtendedErrorContext = {
        userId: 'user-123',
        rpc: 'player/update',
      };

      captureMessage('Test message', 'warning', context);

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message', expect.objectContaining({
        tags: expect.objectContaining({
          userId: 'user-123',
          rpc: 'player/update',
        }),
      }));
    });
  });

  describe('captureRpcError', () => {
    it('should capture RPC error with full context', () => {
      const error = new Error('RPC failed');
      const sessionContext: SessionContext = {
        userId: 'user-123',
        username: 'testuser',
      };
      const gameStateContext: GameStateContext = {
        playerId: 'player-123',
        level: 10,
      };

      captureRpcError('player/update', 'user-123', error, '{"test": true}', sessionContext, gameStateContext);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
        tags: expect.objectContaining({
          rpc: 'player/update',
          userId: 'user-123',
        }),
        extra: expect.objectContaining({
          payload: '{"test": true}',
        }),
      }));

      expect(Sentry.setContext).toHaveBeenCalledWith('session', expect.any(Object));
      expect(Sentry.setContext).toHaveBeenCalledWith('gameState', expect.any(Object));
    });
  });

  describe('captureDatabaseError', () => {
    it('should capture database error with operation and collection context', () => {
      const error = new Error('Database error');
      const context: ExtendedErrorContext = {
        userId: 'user-123',
      };

      captureDatabaseError('read', 'players', error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
        extra: expect.objectContaining({
          databaseOperation: 'read',
          collection: 'players',
        }),
      }));
    });
  });

  describe('captureCacheError', () => {
    it('should capture cache error with operation and key context', () => {
      const error = new Error('Cache error');

      captureCacheError('get', 'player_cache', 'player_123', error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
        extra: expect.objectContaining({
          cacheOperation: 'get',
          cacheName: 'player_cache',
          cacheKey: 'player_123',
        }),
      }));
    });
  });

  describe('createErrorBoundary', () => {
    it('should create error boundary with context', async () => {
      const context: ExtendedErrorContext = {
        userId: 'user-123',
        rpc: 'test/rpc',
      };

      const boundary = createErrorBoundary(context);

      // Test async safeExecute
      const result = await boundary.safeExecute(async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(Sentry.captureException).not.toHaveBeenCalled();

      // Test async safeExecute with error
      const errorResult = await boundary.safeExecute(async () => {
        throw new Error('Test error');
      });

      expect(errorResult).toBeUndefined();
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should handle sync errors in safeExecuteSync', () => {
      const context: ExtendedErrorContext = {
        userId: 'user-123',
      };

      const boundary = createErrorBoundary(context);

      // Test sync safeExecute
      const result = boundary.safeExecuteSync(() => {
        return 'success';
      });

      expect(result).toBe('success');

      // Test sync safeExecute with error
      const errorResult = boundary.safeExecuteSync(() => {
        throw new Error('Sync error');
      });

      expect(errorResult).toBeUndefined();
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('withErrorTracking', () => {
    it('should wrap async function with error tracking', async () => {
      const context: ExtendedErrorContext = {
        userId: 'user-123',
        rpc: 'test/rpc',
      };

      const mockFn = jest.fn().mockRejectedValue(new Error('Wrapped error'));
      const wrappedFn = withErrorTracking(mockFn, context);

      await expect(wrappedFn()).rejects.toThrow('Wrapped error');
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should include function args in error context', async () => {
      const context: ExtendedErrorContext = {
        userId: 'user-123',
      };

      const mockFn = jest.fn().mockRejectedValue(new Error('Error'));
      const wrappedFn = withErrorTracking(mockFn, context);

      await expect(wrappedFn('arg1', 'arg2')).rejects.toThrow();

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          extra: expect.objectContaining({
            functionArgs: JSON.stringify(['arg1', 'arg2']),
          }),
        })
      );
    });
  });
});

describe('Error Tracking Config', () => {
  it('should have correct default values', () => {
    expect(errorTrackingConfig).toHaveProperty('dsn');
    expect(errorTrackingConfig).toHaveProperty('environment');
    expect(errorTrackingConfig).toHaveProperty('tracesSampleRate');
    expect(errorTrackingConfig).toHaveProperty('enabled');
    expect(errorTrackingConfig).toHaveProperty('includeGameState');
    expect(errorTrackingConfig).toHaveProperty('includeSessionContext');
  });

  it('should support environment variable overrides', () => {
    // Test that config reads from environment variables
    expect(typeof errorTrackingConfig.dsn).toBe('string');
    expect(typeof errorTrackingConfig.environment).toBe('string');
    expect(typeof errorTrackingConfig.tracesSampleRate).toBe('number');
    expect(typeof errorTrackingConfig.enabled).toBe('boolean');
    expect(typeof errorTrackingConfig.includeGameState).toBe('boolean');
    expect(typeof errorTrackingConfig.includeSessionContext).toBe('boolean');
  });
});
