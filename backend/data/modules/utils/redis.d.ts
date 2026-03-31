import Redis from 'ioredis';
import { Runtime } from '../types/nakama';
/**
 * Gets or initializes the Redis client.
 * Returns null if Redis is not enabled or fails to connect.
 *
 * @param logger - Optional Nakama logger
 * @returns Redis client or null
 */
export declare function getRedisClient(logger?: Runtime.Logger): Redis | null;
/**
 * Legacy alias for getRedisClient.
 */
export declare function getRedis(logger?: Runtime.Logger): Redis | null;
/**
 * Close the Redis connection.
 */
export declare function closeRedisConnection(): Promise<void>;
/**
 * Legacy alias for closeRedisConnection.
 */
export declare function closeRedis(): Promise<void>;
