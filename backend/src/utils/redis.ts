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
        // Fallback to basic logging when no logger provided
        // In Nakama runtime, this will use the default logger
        const defaultLogger = {
          error: (msg: string, ...args: unknown[]) => {
            // eslint-disable-next-line no-console
            console.error(msg, ...args);
          },
          warn: (msg: string, ...args: unknown[]) => {
            // eslint-disable-next-line no-console
            console.warn(msg, ...args);
          },
          info: (msg: string, ...args: unknown[]) => {
            // eslint-disable-next-line no-console
            console.info(msg, ...args);
          },
          debug: (msg: string, ...args: unknown[]) => {
            // eslint-disable-next-line no-console
            console.debug(msg, ...args);
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
