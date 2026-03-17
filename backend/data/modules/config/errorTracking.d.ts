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
export declare const errorTrackingConfig: ErrorTrackingConfig;
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
    gold?: number;
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
export declare function initializeSentry(): void;
/**
 * Sets persistent context for a user session.
 * This context will be included in all subsequent error events for this scope.
 *
 * @param context - The session context to set
 */
export declare function setSessionContext(context: SessionContext): void;
/**
 * Sets game state context for error tracking.
 * This provides debugging information about player state at time of error.
 *
 * @param gameState - The game state context to set
 */
export declare function setGameStateContext(gameState: GameStateContext): void;
/**
 * Clears all custom context.
 * Use this to prevent context leakage between requests.
 */
export declare function clearContext(): void;
/**
 * Sets request context for error tracking.
 *
 * @param request - The request context to set
 */
export declare function setRequestContext(request: RequestContext): void;
/**
 * Captures an exception with extended context information.
 *
 * @param error - The error to capture
 * @param context - Extended context with user, game state, and request info
 */
export declare function captureException(error: Error, context?: ExtendedErrorContext): void;
/**
 * Captures a message with extended context information.
 *
 * @param message - The message to capture
 * @param level - Severity level
 * @param context - Extended context with user, game state, and request info
 */
export declare function captureMessage(message: string, level?: 'info' | 'warning' | 'error', context?: ExtendedErrorContext): void;
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
export declare function captureRpcError(rpcName: string, userId: string, error: Error, payload?: string, sessionContext?: SessionContext, gameStateContext?: GameStateContext): void;
/**
 * Creates an error boundary for wrapping async operations.
 * Catches errors and sends them to Sentry with proper context.
 *
 * @param context - Error context to include
 * @returns Object with safeExecute method
 */
export declare function createErrorBoundary(context: ExtendedErrorContext): {
    /**
     * Executes a function and captures any errors that occur.
     * @param fn - The function to execute
     * @returns The result of the function, or undefined if error
     */
    safeExecute<T>(fn: () => Promise<T>): Promise<T | undefined>;
    /**
     * Executes a synchronous function and captures any errors that occur.
     * @param fn - The function to execute
     * @returns The result of the function, or undefined if error
     */
    safeExecuteSync<T>(fn: () => T): T | undefined;
};
/**
 * Higher-order function that wraps an async function with error tracking.
 *
 * @param fn - The function to wrap
 * @param context - Error context to include
 * @returns Wrapped function that captures errors
 */
export declare function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, context: ExtendedErrorContext): T;
/**
 * Captures database operation errors with context.
 *
 * @param operation - The database operation (read, write, delete, etc.)
 * @param collection - The collection being operated on
 * @param error - The error that occurred
 * @param context - Additional context
 */
export declare function captureDatabaseError(operation: 'read' | 'write' | 'delete' | 'list' | 'update', collection: string, error: Error, context?: ExtendedErrorContext): void;
/**
 * Captures cache operation errors with context.
 *
 * @param operation - The cache operation (get, set, delete, etc.)
 * @param cacheName - The name of the cache
 * @param key - The cache key
 * @param error - The error that occurred
 * @param context - Additional context
 */
export declare function captureCacheError(operation: 'get' | 'set' | 'delete' | 'clear', cacheName: string, key: string, error: Error, context?: ExtendedErrorContext): void;
