/**
 * Mock for Redis client
 */
export declare const createRedisMock: () => {
    exists: jest.Mock<any, any, any>;
    setEx: jest.Mock<any, any, any>;
    del: jest.Mock<any, any, any>;
    quit: jest.Mock<any, any, any>;
};
export declare const getRedisClient: jest.Mock<{
    exists: jest.Mock<any, any, any>;
    setEx: jest.Mock<any, any, any>;
    del: jest.Mock<any, any, any>;
    quit: jest.Mock<any, any, any>;
}, [], any>;
