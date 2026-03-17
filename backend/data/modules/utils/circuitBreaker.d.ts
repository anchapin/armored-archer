/**
 * Circuit Breaker Utility
 *
 * Provides circuit breaker pattern implementation for external service calls.
 * Prevents cascading failures when downstream services become unavailable.
 */
import CircuitBreaker from 'opossum';
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
 * Creates a circuit breaker for a given service
 *
 * @param serviceName - The name of the service to protect
 * @param options - Custom circuit breaker options
 * @returns The circuit breaker instance
 */
export declare function createCircuitBreaker(serviceName: ServiceName, options?: CircuitBreakerOptions): CircuitBreaker;
/**
 * Gets or creates a circuit breaker for a service
 *
 * @param serviceName - The service name
 * @param options - Options (only used if creating new circuit)
 * @returns The circuit breaker instance
 */
export declare function getCircuitBreaker(serviceName: ServiceName, options?: CircuitBreakerOptions): CircuitBreaker;
/**
 * Executes a function with circuit breaker protection
 *
 * @param serviceName - The service to call
 * @param fn - The function to execute
 * @param fallback - Optional fallback function if circuit is open
 * @param options - Circuit breaker options (only used if creating new circuit)
 * @returns Result of the function or fallback
 */
export declare function withCircuitBreaker<T>(serviceName: ServiceName, fn: () => Promise<T>, fallback?: () => Promise<T>, options?: CircuitBreakerOptions): Promise<T>;
/**
 * Gets the current state of a circuit breaker
 *
 * @param serviceName - The service name
 * @returns Current circuit state or null if not found
 */
export declare function getCircuitState(serviceName: ServiceName): CircuitState | null;
/**
 * Gets statistics for a circuit breaker
 *
 * @param serviceName - The service name
 * @returns Statistics or null if not found
 */
export declare function getCircuitStats(serviceName: ServiceName): CircuitBreakerInstance['stats'] | null;
/**
 * Gets all circuit breaker states
 *
 * @returns Map of service names to their states
 */
export declare function getAllCircuitStates(): Map<ServiceName, CircuitState>;
/**
 * Manually opens a circuit breaker (for testing or emergency use)
 *
 * @param serviceName - The service name
 */
export declare function openCircuit(serviceName: ServiceName): boolean;
/**
 * Manually closes a circuit breaker (for testing or recovery)
 *
 * @param serviceName - The service name
 */
export declare function closeCircuit(serviceName: ServiceName): boolean;
/**
 * Gets all circuit breaker information
 *
 * @returns Array of circuit breaker details
 */
export declare function getAllCircuitInfo(): Array<{
    serviceName: ServiceName;
    state: CircuitState;
    stats: CircuitBreakerInstance['stats'];
    options: CircuitBreakerInstance['options'];
}>;
export {};
