/**
 * DataDog Integration Module
 *
 * This module provides integration with DataDog for metrics and APM:
 * - DogStatsD client for metrics
 * - Trace export for APM
 * - Custom event forwarding
 */
interface DataDogConfig {
    enabled: boolean;
    apiKey?: string;
    appKey?: string;
    host?: string;
    port: number;
    prefix: string;
    tags: Record<string, string>;
}
declare class DataDogMetricsClient {
    private host;
    private port;
    private prefix;
    private defaultTags;
    private socket;
    private enabled;
    constructor(config: DataDogConfig);
    /**
     * Initialize the UDP socket for sending metrics
     */
    initialize(): void;
    /**
     * Close the UDP socket
     */
    close(): void;
    /**
     * Send a counter metric
     */
    increment(metric: string, value?: number, tags?: Record<string, string>): void;
    /**
     * Send a gauge metric
     */
    gauge(metric: string, value: number, tags?: Record<string, string>): void;
    /**
     * Send a histogram metric
     */
    histogram(metric: string, value: number, tags?: Record<string, string>): void;
    /**
     * Send a timing metric
     */
    timing(metric: string, value: number, tags?: Record<string, string>): void;
    /**
     * Format tags for DataDog
     */
    private formatTags;
    /**
     * Send message via UDP
     */
    private send;
}
/**
 * Initialize DataDog integration
 */
export declare function initializeDataDog(): void;
/**
 * Get DataDog client for custom metrics
 */
export declare function getDataDogClient(): DataDogMetricsClient | null;
/**
 * Send RPC metrics to DataDog
 */
export declare function sendRpcMetricsToDataDog(rpcName: string, durationMs: number, success: boolean): void;
/**
 * Send player metrics to DataDog
 */
export declare function sendPlayerMetricsToDataDog(activeSessions: number): void;
/**
 * Send match metrics to DataDog
 */
export declare function sendMatchMetricsToDataDog(matchType: string, queueSize: number, waitTimeMs: number): void;
/**
 * Send economy metrics to DataDog
 */
export declare function sendEconomyMetricsToDataDog(productType: string, amount: number, currency: string, success: boolean): void;
/**
 * Send health metrics to DataDog
 */
export declare function sendHealthMetricsToDataDog(healthy: boolean, cpuUsage: number, memoryUsage: number): void;
/**
 * Check if DataDog is enabled
 */
export declare function isDataDogEnabled(): boolean;
/**
 * Get DataDog configuration
 */
export declare function getDataDogConfig(): DataDogConfig;
export {};
