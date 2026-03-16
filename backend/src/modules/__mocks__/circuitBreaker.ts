/**
 * Mock for circuit breaker utility
 */

// Use jest.doMock for proper hoisting
export const withCircuitBreaker = jest.fn(async (_serviceName: string, fn: () => Promise<any>) => {
  return fn();
});

export const getCircuitBreakerStats = jest.fn();
export const resetCircuitBreaker = jest.fn();
