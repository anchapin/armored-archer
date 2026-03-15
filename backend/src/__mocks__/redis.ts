import Redis from 'ioredis';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  sadd: jest.fn(),
  sismember: jest.fn(),
  expire: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

export const getRedis = jest.fn(() => mockRedis);
export const closeRedis = jest.fn(async () => {});

export default Redis;
