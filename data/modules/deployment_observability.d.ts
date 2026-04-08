/**
 * Deployment Observability Module
 *
 * This module provides deployment tracking and observability features:
 * - Deployment event recording
 * - Deployment metrics (count, status, duration)
 * - Health check integration
 * - Deployment history tracking
 */
import { Registry } from 'prom-client';
import { Runtime } from '../types/nakama';
export type DeploymentStatus = 'started' | 'success' | 'failed' | 'rollback';
/**
 * Get deployment registry for metrics collection
 */
export declare function getDeploymentRegistry(): Registry;
/**
 * Record a deployment event
 */
export declare function recordDeployment(environment: string, version: string, status: DeploymentStatus, _metadata?: Record<string, string>): void;
/**
 * Record deployment duration
 */
export declare function recordDeploymentDuration(environment: string, status: DeploymentStatus, durationSeconds: number): void;
/**
 * Update deployment health status
 */
export declare function updateDeploymentHealth(environment: string, component: string, isHealthy: boolean): void;
/**
 * Register RPC handlers for deployment observability
 */
export declare function registerDeploymentObservability(initializer: Runtime.Initializer): void;
/**
 * Initialize deployment observability
 * Called during server startup to set initial state
 */
export declare function initializeDeploymentObservability(logger: Runtime.Logger): void;
/**
 * Get current deployment state
 */
export declare function getDeploymentState(): {
    environment: string;
    version: string;
    activeDeployments: number;
};
