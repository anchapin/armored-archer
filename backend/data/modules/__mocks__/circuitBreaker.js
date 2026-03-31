"use strict";
/**
 * Mock for circuit breaker utility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetCircuitBreaker = exports.getCircuitBreakerStats = exports.withCircuitBreaker = void 0;
// Use jest.doMock for proper hoisting
exports.withCircuitBreaker = jest.fn(async (_serviceName, fn) => {
    return fn();
});
exports.getCircuitBreakerStats = jest.fn();
exports.resetCircuitBreaker = jest.fn();
