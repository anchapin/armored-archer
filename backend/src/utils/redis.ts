import Redis from 'ioredis';
import { Runtime } from '../types/nakama';

let redisInstance: Redis | null = null;

/**
 * Get or initialize Redis instance.
 *
 * @param logger - Optional Nakama logger instance
 * @returns Redis client instance
 */
export function getRedis(logger?: Runtime.Logger): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  const host = process.env.REDIS_HOST || 'redis';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);

  if (logger) {
    logger.info('Initializing Redis connection: %s:%d', host, port);
  }

  redisInstance = new Redis({
    host,
    port,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redisInstance.on('error', (err) => {
    if (logger) {
      logger.error('Redis error: %s', err.message);
    } else {
      console.error('Redis error:', err);
    }
  });

  redisInstance.on('connect', () => {
    if (logger) {
      logger.info('Redis connected successfully');
    }
  });

  return redisInstance;
}

/**
 * Gracefully disconnect from Redis.
 */
export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
