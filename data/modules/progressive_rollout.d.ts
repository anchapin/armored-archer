/**
 * Progressive Rollout Module
 *
 * This module provides progressive rollout capabilities for feature releases:
 * - Percentage-based gradual rollout
 * - Feature flags for canary deployments
 * - Rollback criteria for each phase
 * - Monitoring and metrics for rollout phases
 *
 * Phases: disabled -> canary -> gradual -> full
 */
import { Registry } from 'prom-client';
import { Runtime } from '../types/nakama';
export type RolloutPhase = 'disabled' | 'canary' | 'gradual' | 'full';
export type RolloutStatus = 'active' | 'paused' | 'rolled_back' | 'completed';
export interface FeatureFlag {
    name: string;
    description: string;
    enabled: boolean;
    rolloutPhase: RolloutPhase;
    rolloutPercentage: number;
    canaryUserIds: string[];
    canaryVersionMin?: string;
    canaryVersionMax?: string;
    phases: RolloutPhaseConfig[];
    currentPhaseIndex: number;
    createdAt: number;
    updatedAt: number;
}
export interface RolloutPhaseConfig {
    phase: RolloutPhase;
    percentage: number;
    durationMinutes: number;
    minHealthPercent: number;
    maxErrorRatePercent: number;
    maxLatencyMs: number;
    sampleSize: number;
    autoPromote: boolean;
    rollbackCriteria: {
        errorRateThreshold: number;
        latencyThreshold: number;
        healthCheckFails: number;
        customMetrics?: Record<string, number>;
    };
}
export interface RollbackCriteria {
    errorRateThreshold: number;
    latencyThreshold: number;
    healthCheckFails: number;
    customMetrics?: Record<string, number>;
}
export interface RolloutMetrics {
    featureName: string;
    phase: RolloutPhase;
    totalUsers: number;
    activeUsers: number;
    errorCount: number;
    errorRate: number;
    avgLatencyMs: number;
    p99LatencyMs: number;
    healthCheckPasses: number;
    healthCheckFails: number;
    lastUpdated: number;
}
/**
 * Get feature flag by name
 */
export declare function getFeatureFlag(name: string): FeatureFlag | undefined;
/**
 * Get all feature flags
 */
export declare function getAllFeatureFlags(): FeatureFlag[];
/**
 * Check if a feature is enabled for a specific user
 */
export declare function isFeatureEnabled(featureName: string, userId: string, gameVersion?: string): boolean;
/**
 * Create a new feature flag
 */
export declare function createFeatureFlag(name: string, description: string, phases: RolloutPhaseConfig[]): FeatureFlag;
/**
 * Update feature flag settings
 */
export declare function updateFeatureFlag(name: string, updates: Partial<Omit<FeatureFlag, 'name' | 'createdAt'>>): FeatureFlag | null;
/**
 * Advance to next rollout phase
 */
export declare function advancePhase(featureName: string): FeatureFlag | null;
/**
 * Rollback to previous phase or disable
 */
export declare function rollbackFeature(featureName: string): FeatureFlag | null;
/**
 * Check rollback criteria and auto-rollback if needed
 */
export declare function checkRollbackCriteria(featureName: string): {
    shouldRollback: boolean;
    reason?: string;
};
/**
 * Record rollout metrics for a feature
 */
export declare function recordRolloutMetrics(featureName: string, metrics: Partial<RolloutMetrics>): void;
/**
 * Get rollout registry for metrics collection
 */
export declare function getRolloutRegistry(): Registry;
/**
 * Get rollout metrics for a feature
 */
export declare function getRolloutMetrics(featureName: string): RolloutMetrics | undefined;
/**
 * Get all rollout metrics
 */
export declare function getAllRolloutMetrics(): RolloutMetrics[];
/**
 * Register RPC handlers for progressive rollout
 */
export declare function registerProgressiveRollout(initializer: Runtime.Initializer): void;
/**
 * Initialize progressive rollout with default feature flags
 */
export declare function initializeProgressiveRollout(logger: Runtime.Logger): void;
