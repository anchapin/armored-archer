/**
 * Health Monitor Module
 *
 * This module provides continuous health monitoring for the Nakama backend:
 * - System health checks (CPU, memory, disk usage)
 * - Database health monitoring
 * - Custom metric monitoring (active connections, match queue, etc.)
 * - Automatic alerting when thresholds are exceeded
 * - Integration with Prometheus metrics
 */
import { Registry } from 'prom-client';
import { Runtime } from '../types/nakama';
/**
 * Get the health metrics registry
 */
export declare function getHealthRegistry(): Registry;
/**
 * Perform health check and update metrics
 */
export declare function performHealthCheck(): Record<string, number>;
/**
 * Start the health monitoring loop
 */
export declare function startHealthMonitoring(intervalMs?: number): void;
/**
 * Stop the health monitoring loop
 */
export declare function stopHealthMonitoring(): void;
/**
 * Get current health status
 */
export declare function getHealthStatus(): {
    healthy: boolean;
    metrics: Record<string, number>;
    isMonitoring: boolean;
};
/**
 * Initialize health monitoring
 */
export declare function initializeHealthMonitoring(logger: Runtime.Logger): void;
