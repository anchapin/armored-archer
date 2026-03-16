"use strict";
/**
 * Mock for Redis client
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = exports.createRedisMock = void 0;
const createRedisMock = () => ({
    exists: jest.fn().mockResolvedValue(0), // 0 = key doesn't exist
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
});
exports.createRedisMock = createRedisMock;
const redisMock = (0, exports.createRedisMock)();
exports.getRedisClient = jest.fn(() => redisMock);
