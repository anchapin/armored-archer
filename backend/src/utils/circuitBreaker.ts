/**
 * Circuit Breaker Utility
 * 
 * Provides circuit breaker pattern implementation for external service calls.
 * Prevents cascading failures when downstream services become unavailable.
 */

import CircuitBreaker from 'opossum';
import { logger } from '../config/logger';

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerOptions {
  /** Time in ms to wait before attempting to close an open circuit */
  timeout?: number;
  /** Percentage of failures required to open the circuit (0-100) */
  errorThresholdPercentage?: number;
  /** Number of requests required before evaluating failure rate */
  volumeThreshold?: number;
  /** Time in ms to wait before considering a request successful after circuit closes */
  resetTimeout?: number;
}

/**
 * Service identifier for circuit breaker instances
 */
export type ServiceName = 'postgres' | 'nakama' | 'revenuecat' | 'mixpanel' | 'amplitude' | 'segment' | 'external_api' | 'slack' | 'pagerduty' | 'alerting_webhook';

/**
 * Circuit breaker states
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Internal circuit breaker instance with metadata
 */
interface CircuitBreakerInstance {
  breaker: CircuitBreaker;
  serviceName: ServiceName;
  options: Required<CircuitBreakerOptions>;
  stats: {
    failures: number;
    successes: number;
    rejects: number;
    lastFailure: Date | null;
  };
}

/**
 * Registered circuit breakers
 */
const circuits: Map<ServiceName, CircuitBreakerInstance> = new Map();

/**
 * Default circuit breaker options
 */
const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  timeout: 5000, // 5 seconds
  errorThresholdPercentage: 50, // 50% failure rate
  volumeThreshold: 3, // At least 3 requests before evaluating
  resetTimeout: 30000, // 30 seconds
};

/**
 * Logger instance for circuit breaker events
 */
const cbLogger = {
  warn: (msg: string) => logger.warn(msg),
  info: (msg: string) => logger.info(msg),
  debug: (msg: string) => logger.debug(msg),
  error: (msg: string) => logger.error(msg),
};

/**
 * Creates a circuit breaker for a given service
 * 
 * @param serviceName - The name of the service to protect
 * @param options - Custom circuit breaker options
 * @returns The circuit breaker instance
 */
export function createCircuitBreaker(
  serviceName: ServiceName,
  options: CircuitBreakerOptions = {}
): CircuitBreaker {
  // If circuit already exists, return existing instance
  if (circuits.has(serviceName)) {
    cbLogger.warn('Circuit breaker already exists for ' + serviceName + ', returning existing instance');
    return circuits.get(serviceName)!.breaker;
  }

  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const breaker = new CircuitBreaker(async () => {
    // Placeholder - actual function will be passed when calling fire()
    throw new Error('Circuit breaker called without function');
  }, {
    timeout: mergedOptions.timeout,
    errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
    volumeThreshold: mergedOptions.volumeThreshold,
    resetTimeout: mergedOptions.resetTimeout,
  });

  const instance: CircuitBreakerInstance = {
    breaker,
    serviceName,
    options: mergedOptions,
    stats: {
      failures: 0,
      successes: 0,
      rejects: 0,
      lastFailure: null,
    },
  };

  // Set up event handlers
  breaker.on('open', () => {
    cbLogger.warn('Circuit breaker OPEN for ' + serviceName);
  });

  breaker.on('close', () => {
    cbLogger.info('Circuit breaker CLOSED for ' + serviceName);
  });

  breaker.on('halfOpen', () => {
    cbLogger.info('Circuit breaker HALF_OPEN for ' + serviceName);
  });

  breaker.on('success', (result: unknown, latency: number) => {
    instance.stats.successes++;
    cbLogger.debug('Request succeeded for ' + serviceName + ' (latency: ' + latency + 'ms)');
  });

  breaker.on('failure', (error: Error, latency: number) => {
    instance.stats.failures++;
    instance.stats.lastFailure = new Date();
    cbLogger.error('Request failed for ' + serviceName + ' (error: ' + error.message + ', latency: ' + latency + 'ms)');
  });

  breaker.on('reject', () => {
    instance.stats.rejects++;
    cbLogger.warn('Request rejected for ' + serviceName + ' - circuit is open');
  });

  circuits.set(serviceName, instance);
  
  cbLogger.info('Circuit breaker created for ' + serviceName);

  return breaker;
}

/**
 * Gets or creates a circuit breaker for a service
 * 
 * @param serviceName - The service name
 * @param options - Options (only used if creating new circuit)
 * @returns The circuit breaker instance
 */
export function getCircuitBreaker(
  serviceName: ServiceName,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  const existing = circuits.get(serviceName);
  if (existing) {
    return existing.breaker;
  }
  return createCircuitBreaker(serviceName, options);
}

/**
 * Executes a function with circuit breaker protection
 * 
 * @param serviceName - The service to call
 * @param fn - The function to execute
 * @param fallback - Optional fallback function if circuit is open
 * @param options - Circuit breaker options (only used if creating new circuit)
 * @returns Result of the function or fallback
 */
export async function withCircuitBreaker<T>(
  serviceName: ServiceName,
  fn: () => Promise<T>,
  fallback?: () => Promise<T>,
  options?: CircuitBreakerOptions
): Promise<T> {
  const breaker = getCircuitBreaker(serviceName, options);
  
  try {
    // Fire the function through the circuit breaker
    // We need to wrap this because opossum's fire method expects specific usage
    const result = await breaker.fire(fn);
    return result as T;
  } catch (error) {
    // If circuit is open and fallback provided, use fallback
    if (breaker.opened && fallback) {
      cbLogger.info('Using fallback due to open circuit for ' + serviceName);
      return fallback();
    }
    throw error;
  }
}

/**
 * Gets the current state of a circuit breaker
 * 
 * @param serviceName - The service name
 * @returns Current circuit state or null if not found
 */
export function getCircuitState(serviceName: ServiceName): CircuitState | null {
  const instance = circuits.get(serviceName);
  if (!instance) {
    return null;
  }
  if (instance.breaker.opened) return 'OPEN';
  if (instance.breaker.halfOpen) return 'HALF_OPEN';
  return 'CLOSED';
}

/**
 * Gets statistics for a circuit breaker
 * 
 * @param serviceName - The service name
 * @returns Statistics or null if not found
 */
export function getCircuitStats(serviceName: ServiceName): CircuitBreakerInstance['stats'] | null {
  const instance = circuits.get(serviceName);
  return instance ? { ...instance.stats } : null;
}

/**
 * Gets all circuit breaker states
 * 
 * @returns Map of service names to their states
 */
export function getAllCircuitStates(): Map<ServiceName, CircuitState> {
  const states = new Map<ServiceName, CircuitState>();
  Array.from(circuits.entries()).forEach(([name, instance]) => {
    let state: CircuitState = 'CLOSED';
    if (instance.breaker.opened) state = 'OPEN';
    else if (instance.breaker.halfOpen) state = 'HALF_OPEN';
    states.set(name, state);
  });
  return states;
}

/**
 * Manually opens a circuit breaker (for testing or emergency use)
 * 
 * @param serviceName - The service name
 */
export function openCircuit(serviceName: ServiceName): boolean {
  const instance = circuits.get(serviceName);
  if (!instance) {
    cbLogger.warn('Cannot open circuit - not found: ' + serviceName);
    return false;
  }
  
  instance.breaker.open();
  cbLogger.warn('Circuit manually opened for ' + serviceName);
  return true;
}

/**
 * Manually closes a circuit breaker (for testing or recovery)
 * 
 * @param serviceName - The service name
 */
export function closeCircuit(serviceName: ServiceName): boolean {
  const instance = circuits.get(serviceName);
  if (!instance) {
    cbLogger.warn('Cannot close circuit - not found: ' + serviceName);
    return false;
  }
  
  instance.breaker.close();
  cbLogger.info('Circuit manually closed for ' + serviceName);
  return true;
}

/**
 * Gets all circuit breaker information
 * 
 * @returns Array of circuit breaker details
 */
export function getAllCircuitInfo(): Array<{
  serviceName: ServiceName;
  state: CircuitState;
  stats: CircuitBreakerInstance['stats'];
  options: CircuitBreakerInstance['options'];
}> {
  const info: Array<{
    serviceName: ServiceName;
    state: CircuitState;
    stats: CircuitBreakerInstance['stats'];
    options: CircuitBreakerInstance['options'];
  }> = [];

  Array.from(circuits.entries()).forEach(([name, instance]) => {
    let state: CircuitState = 'CLOSED';
    if (instance.breaker.opened) state = 'OPEN';
    else if (instance.breaker.halfOpen) state = 'HALF_OPEN';
    
    info.push({
      serviceName: name,
      state: state,
      stats: { ...instance.stats },
      options: { ...instance.options },
    });
  });

  return info;
}
