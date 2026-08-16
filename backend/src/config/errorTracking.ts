import * as Sentry from '@sentry/node';
import type { ErrorEvent, EventHint } from '@sentry/node';
import { config } from '../config';
import { logger } from './logger';

/**
 * Configuration for error tracking with Sentry.
 */
export interface ErrorTrackingConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  enabled: boolean;
  /** Include game state context in error events */
  includeGameState: boolean;
  /** Include user session context in error events */
  includeSessionContext: boolean;
}

export const errorTrackingConfig: ErrorTrackingConfig = {
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || config.environment,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
  enabled: process.env.SENTRY_ENABLED === 'true' || config.environment === 'production',
  includeGameState: process.env.SENTRY_INCLUDE_GAME_STATE !== 'false',
  includeSessionContext: process.env.SENTRY_INCLUDE_SESSION_CONTEXT !== 'false',
};

/**
 * Game state context for error tracking.
 * Provides debugging information about player state at time of error.
 */
export interface GameStateContext {
  playerId?: string;
  level?: number;
  xp?: number;
  health?: number;
  maxHealth?: number;
  mana?: number;
  maxMana?: number;
  coins?: number;
  gems?: number;
  currentMatchId?: string;
  matchState?: string;
  seasonId?: string;
  inventorySize?: number;
  equippedItems?: string[];
  stats?: {
    strength?: number;
    dexterity?: number;
    intelligence?: number;
    vitality?: number;
    luck?: number;
  };
}

/**
 * User session context for error tracking.
 * Provides information about the user's session and connection.
 */
export interface SessionContext {
  userId: string;
  username?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  platform?: string;
  appVersion?: string;
  connectionType?: string;
  serverRegion?: string;
}

/**
 * Request context for error tracking.
 * Provides details about the incoming request.
 */
export interface RequestContext {
  rpcName: string;
  requestId?: string;
  method?: string;
  payload?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  serverRegion?: string;
}

/**
 * Extended context for error tracking with all available information.
 */
export interface ExtendedErrorContext {
  userId?: string;
  rpc?: string;
  user?: SessionContext;
  gameState?: GameStateContext;
  request?: RequestContext;
  extra?: Record<string, unknown>;
}

export function initializeSentry(): void {
  if (!errorTrackingConfig.enabled || !errorTrackingConfig.dsn) {
    logger.info('Sentry is disabled - missing DSN or disabled by config');
    return;
  }

  Sentry.init({
    dsn: errorTrackingConfig.dsn,
    environment: errorTrackingConfig.environment,
    tracesSampleRate: errorTrackingConfig.tracesSampleRate,
    beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
      // Remove sensitive headers for privacy
      if (event.request) {
        event.request.headers = undefined;
      }
      // Add environment tag
      if (!event.tags) {
        event.tags = {};
      }
      event.tags.environment = errorTrackingConfig.environment;
      return event;
    },
    // Add release information if available
    release: process.env.APP_VERSION || 'unknown',
  });

  logger.info(`Sentry initialized in ${errorTrackingConfig.environment} environment`);
}

/**
 * Sets persistent context for a user session.
 * This context will be included in all subsequent error events for this scope.
 *
 * @param context - The session context to set
 */
export function setSessionContext(context: SessionContext): void {
  if (!errorTrackingConfig.enabled) {
    return;
  }

  Sentry.setContext('session', {
    userId: context.userId,
    username: context.username,
    sessionId: context.sessionId,
    ipAddress: context.ipAddress,
    platform: context.platform,
    appVersion: context.appVersion,
    connectionType: context.connectionType,
    serverRegion: context.serverRegion,
  });

  // Also set user in Sentry's built-in user context
  Sentry.setUser({
    id: context.userId,
    username: context.username,
    ip_address: context.ipAddress,
  });
}

/**
 * Sets game state context for error tracking.
 * This provides debugging information about player state at time of error.
 *
 * @param gameState - The game state context to set
 */
export function setGameStateContext(gameState: GameStateContext): void {
  if (!errorTrackingConfig.enabled || !errorTrackingConfig.includeGameState) {
    return;
  }

  Sentry.setContext('gameState', {
    playerId: gameState.playerId,
    level: gameState.level,
    xp: gameState.xp,
    health: gameState.health,
    maxHealth: gameState.maxHealth,
    mana: gameState.mana,
    maxMana: gameState.maxMana,
    coins: gameState.coins,
    gems: gameState.gems,
    currentMatchId: gameState.currentMatchId,
    matchState: gameState.matchState,
    seasonId: gameState.seasonId,
    inventorySize: gameState.inventorySize,
    equippedItems: gameState.equippedItems,
    stats: gameState.stats,
  });
}

/**
 * Clears all custom context.
 * Use this to prevent context leakage between requests.
 */
export function clearContext(): void {
  if (!errorTrackingConfig.enabled) {
    return;
  }

  Sentry.setContext('session', {});
  Sentry.setContext('gameState', {});
  Sentry.setContext('request', {});
  Sentry.setUser(null);
}

/**
 * Sets request context for error tracking.
 *
 * @param request - The request context to set
 */
export function setRequestContext(request: RequestContext): void {
  if (!errorTrackingConfig.enabled) {
    return;
  }

  Sentry.setContext('request', {
    rpcName: request.rpcName,
    requestId: request.requestId,
    method: request.method,
    payload: request.payload,
    serverRegion: request.serverRegion,
  });
}

/**
 * Captures an exception with extended context information.
 *
 * @param error - The error to capture
 * @param context - Extended context with user, game state, and request info
 */
export function captureException(error: Error, context: ExtendedErrorContext = {}): void {
  if (!errorTrackingConfig.enabled) {
    return;
  }

  const tags: Record<string, string> = {};
  if (context.userId) {
    tags.userId = context.userId;
  }
  if (context.rpc) {
    tags.rpc = context.rpc;
  }

  const extra: Record<string, unknown> = {
    ...context.extra,
    timestamp: new Date().toISOString(),
  };

  // Add game state if provided
  if (context.gameState && errorTrackingConfig.includeGameState) {
    extra.gameState = context.gameState;
  }

  // Add request info if provided
  if (context.request) {
    extra.request = {
      rpcName: context.request.rpcName,
      requestId: context.request.requestId,
      payload: context.request.payload,
    };
  }

  Sentry.captureException(error, {
    tags,
    extra,
    // Ensure user context is set
    user: context.user?.userId
      ? {
          id: context.user.userId,
          username: context.user.username,
        }
      : undefined,
  });
}

/**
 * Captures a message with extended context information.
 *
 * @param message - The message to capture
 * @param level - Severity level
 * @param context - Extended context with user, game state, and request info
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context: ExtendedErrorContext = {}
): void {
  if (!errorTrackingConfig.enabled) {
    return;
  }

  const tags: Record<string, string> = {};
  if (context.userId) {
    tags.userId = context.userId;
  }
  if (context.rpc) {
    tags.rpc = context.rpc;
  }

  const extra: Record<string, unknown> = {
    ...context.extra,
    timestamp: new Date().toISOString(),
  };

  // Add game state if provided
  if (context.gameState && errorTrackingConfig.includeGameState) {
    extra.gameState = context.gameState;
  }

  // Add request info if provided
  if (context.request) {
    extra.request = {
      rpcName: context.request.rpcName,
      requestId: context.request.requestId,
      payload: context.request.payload,
    };
  }

  Sentry.captureMessage(message, {
    level,
    tags,
    extra,
    user: context.user?.userId
      ? {
          id: context.user.userId,
          username: context.user.username,
        }
      : undefined,
  });
}

/**
 * Captures an RPC error with full context.
 * This is the recommended way to capture RPC errors.
 *
 * @param rpcName - Name of the RPC
 * @param userId - User ID making the request
 * @param error - The error that occurred
 * @param payload - Optional payload for debugging
 * @param sessionContext - Optional session context
 * @param gameStateContext - Optional game state context
 */
export function captureRpcError(
  rpcName: string,
  userId: string,
  error: Error,
  payload?: string,
  sessionContext?: SessionContext,
  gameStateContext?: GameStateContext
): void {
  if (!errorTrackingConfig.enabled) {
    return;
  }

  const tags: Record<string, string> = {
    rpc: rpcName,
  };
  if (userId) {
    tags.userId = userId;
  }

  const extra: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  if (payload) {
    extra.payload = payload;
  }

  // Set contexts if provided
  if (sessionContext) {
    Sentry.setContext('session', {
      userId: sessionContext.userId,
      username: sessionContext.username,
      sessionId: sessionContext.sessionId,
      platform: sessionContext.platform,
      appVersion: sessionContext.appVersion,
    });
    Sentry.setUser({
      id: sessionContext.userId,
      username: sessionContext.username,
    });
  }

  if (gameStateContext && errorTrackingConfig.includeGameState) {
    Sentry.setContext('gameState', gameStateContext as Record<string, unknown>);
    extra.gameState = gameStateContext;
  }

  Sentry.captureException(error, {
    tags,
    extra,
  });

  // Clear context after capturing to prevent leakage
  clearContext();
}

/**
 * Creates an error boundary for wrapping async operations.
 * Catches errors and sends them to Sentry with proper context.
 *
 * @param context - Error context to include
 * @returns Object with safeExecute method
 */
export function createErrorBoundary(context: ExtendedErrorContext) {
  return {
    /**
     * Executes a function and captures any errors that occur.
     * @param fn - The function to execute
     * @returns The result of the function, or undefined if error
     */
    async safeExecute<T>(fn: () => Promise<T>): Promise<T | undefined> {
      try {
        return await fn();
      } catch (error) {
        captureException(error as Error, context);
        return undefined;
      }
    },

    /**
     * Executes a synchronous function and captures any errors that occur.
     * @param fn - The function to execute
     * @returns The result of the function, or undefined if error
     */
    safeExecuteSync<T>(fn: () => T): T | undefined {
      try {
        return fn();
      } catch (error) {
        captureException(error as Error, context);
        return undefined;
      }
    },
  };
}

/**
 * Higher-order function that wraps an async function with error tracking.
 *
 * @param fn - The function to wrap
 * @param context - Error context to include
 * @returns Wrapped function that captures errors
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: ExtendedErrorContext
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error as Error, {
        ...context,
        extra: {
          ...context.extra,
          functionArgs: JSON.stringify(args),
        },
      });
      throw error;
    }
  }) as T;
}

/**
 * Captures database operation errors with context.
 *
 * @param operation - The database operation (read, write, delete, etc.)
 * @param collection - The collection being operated on
 * @param error - The error that occurred
 * @param context - Additional context
 */
export function captureDatabaseError(
  operation: 'read' | 'write' | 'delete' | 'list' | 'update',
  collection: string,
  error: Error,
  context: ExtendedErrorContext = {}
): void {
  captureException(error, {
    ...context,
    extra: {
      ...context.extra,
      databaseOperation: operation,
      collection,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Captures cache operation errors with context.
 *
 * @param operation - The cache operation (get, set, delete, etc.)
 * @param cacheName - The name of the cache
 * @param key - The cache key
 * @param error - The error that occurred
 * @param context - Additional context
 */
export function captureCacheError(
  operation: 'get' | 'set' | 'delete' | 'clear',
  cacheName: string,
  key: string,
  error: Error,
  context: ExtendedErrorContext = {}
): void {
  captureException(error, {
    ...context,
    extra: {
      ...context.extra,
      cacheOperation: operation,
      cacheName,
      cacheKey: key,
      timestamp: new Date().toISOString(),
    },
  });
}
