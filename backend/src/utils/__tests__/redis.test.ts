/**
 * Tests for redis utility
 */

import { getRedisClient, getRedis, closeRedisConnection, closeRedis } from '../redis';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockRedis = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
  return mockRedis;
});

// Mock config - must be before redis import
jest.mock('../../config', () => ({
  config: {
    redis: {
      enabled: true,
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0,
    },
  },
}));

describe('redis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRedisClient', () => {
    it('should return a Redis client when enabled', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };
      const client = getRedisClient(mockLogger as any);
      expect(client).toBeDefined();
    });

    it('should return a client instance', () => {
      const client = getRedisClient();
      expect(client).toBeDefined();
      expect(client).not.toBeNull();
    });
  });

  describe('getRedis', () => {
    it('should be an alias for getRedisClient', () => {
      const client = getRedis();
      expect(client).toBeDefined();
    });
  });

  describe('closeRedisConnection', () => {
    it('should close the connection', async () => {
      getRedisClient();
      await closeRedisConnection();
    });

    it('should handle when no client exists', async () => {
      await expect(closeRedisConnection()).resolves.not.toThrow();
    });
  });

  describe('closeRedis', () => {
    it('should be an alias for closeRedisConnection', async () => {
      await expect(closeRedis()).resolves.not.toThrow();
    });
  });
});
