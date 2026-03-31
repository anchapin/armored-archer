import Redis from 'ioredis';
import { config } from '../config';
import { Runtime } from '../types/nakama';

let redisClient: Redis | null = null;

/**
 * Gets or initializes the Redis client.
 * Returns null if Redis is not enabled or fails to connect.
 *
 * @param logger - Optional Nakama logger
 * @returns Redis client or null
 */
export function getRedisClient(logger?: Runtime.Logger): Redis | null {
  if (!config.redis.enabled) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err) => {
      if (logger) {
        logger.error('Redis error: %s', err.message);
      } else {
        // Fallback to silent logger when no logger provided in Nakama runtime
        // Console logging is not available in Nakama runtime
        const defaultLogger = {
          error: (_msg: string, ..._args: unknown[]) => {
            /* silent */
          },
          warn: (_msg: string, ..._args: unknown[]) => {
            /* silent */
          },
          info: (_msg: string, ..._args: unknown[]) => {
            /* silent */
          },
          debug: (_msg: string, ..._args: unknown[]) => {
            /* silent */
          },
        };
        defaultLogger.error('Redis error: %s', err.message);
      }
    });

    redisClient.on('connect', () => {
      if (logger) {
        logger.info('Connected to Redis');
      }
    });

    return redisClient;
  } catch (error) {
    if (logger) {
      logger.error('Failed to initialize Redis client: %s', error);
    }
    return null;
  }
}

/**
 * Legacy alias for getRedisClient.
 */
export function getRedis(logger?: Runtime.Logger): Redis | null {
  return getRedisClient(logger);
}

/**
 * Close the Redis connection.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Legacy alias for closeRedisConnection.
 */
export async function closeRedis(): Promise<void> {
  await closeRedisConnection();
}
