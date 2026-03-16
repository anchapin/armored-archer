import Redis from 'ioredis';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  sadd: jest.fn(),
  sismember: jest.fn(),
  expire: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
  exists: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
};

export const getRedis = jest.fn(() => mockRedis);
export const getRedisClient = jest.fn(() => mockRedis);
export const closeRedis = jest.fn(async () => {});
export const closeRedisConnection = jest.fn(async () => {});

export default Redis;
