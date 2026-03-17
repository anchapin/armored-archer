import { Runtime } from '../types/nakama';
export declare function setMetricsCallbacks(recordViolation: (endpoint: string) => void, updateUsers: (count: number) => void): void;
export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}
export interface RateLimitEndpoint {
    endpoint: string;
    config: RateLimitConfig;
}
export interface RateLimitState {
    count: number;
    resetTime: number;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
export declare function setEndpointRateLimit(endpoint: string, config: RateLimitConfig): void;
export declare function getEndpointRateLimit(endpoint: string): RateLimitConfig;
export declare function checkRateLimit(userId: string, endpoint: string): RateLimitResult;
export declare function logRateLimitViolation(endpoint: string, userId: string, retryAfter: number): void;
export declare function resetUserRateLimit(userId: string, endpoint: string): void;
export declare function cleanupExpiredEntries(): void;
export declare function getRateLimitStats(): {
    totalEntries: number;
    endpoints: Array<{
        endpoint: string;
        activeUsers: number;
    }>;
};
export declare function createRateLimitedRpcHandler(endpoint: string, handler: (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => string | Promise<string>): (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => string | Promise<string>;
