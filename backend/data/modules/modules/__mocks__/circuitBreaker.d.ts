/**
 * Mock for circuit breaker utility
 */
export declare const withCircuitBreaker: jest.Mock<Promise<any>, [_serviceName: string, fn: () => Promise<any>], any>;
export declare const getCircuitBreakerStats: jest.Mock<any, any, any>;
export declare const resetCircuitBreaker: jest.Mock<any, any, any>;
