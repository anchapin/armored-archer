"use strict";
/**
 * DataDog Integration Module
 *
 * This module provides integration with DataDog for metrics and APM:
 * - DogStatsD client for metrics
 * - Trace export for APM
 * - Custom event forwarding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDataDog = initializeDataDog;
exports.getDataDogClient = getDataDogClient;
exports.sendRpcMetricsToDataDog = sendRpcMetricsToDataDog;
exports.sendPlayerMetricsToDataDog = sendPlayerMetricsToDataDog;
exports.sendMatchMetricsToDataDog = sendMatchMetricsToDataDog;
exports.sendEconomyMetricsToDataDog = sendEconomyMetricsToDataDog;
exports.sendHealthMetricsToDataDog = sendHealthMetricsToDataDog;
exports.isDataDogEnabled = isDataDogEnabled;
exports.getDataDogConfig = getDataDogConfig;
const tslib_1 = require("tslib");
const dgram = tslib_1.__importStar(require("dgram"));
const config_1 = require("../config");
const logger_1 = require("../config/logger");
// Default DataDog configuration
let dataDogConfig = {
    enabled: false,
    port: 8125,
    prefix: 'armed_archer',
    tags: {
        environment: 'development',
        service: 'armored-archer-backend',
    },
};
// StatsD-like interface for metrics (simplified implementation)
class DataDogMetricsClient {
    constructor(config) {
        this.socket = null;
        this.enabled = config.enabled;
        this.host = config.host || 'localhost';
        this.port = config.port;
        this.prefix = config.prefix;
        this.defaultTags = Object.entries(config.tags).map(([key, value]) => `${key}:${value}`);
    }
    /**
     * Initialize the UDP socket for sending metrics
     */
    initialize() {
        if (!this.enabled) {
            logger_1.logger.info('DataDog metrics disabled');
            return;
        }
        try {
            this.socket = dgram.createSocket('udp4');
            logger_1.logger.info(`Initialized DataDog metrics client: ${this.host}:${this.port}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize DataDog metrics client:', error);
            this.enabled = false;
        }
    }
    /**
     * Close the UDP socket
     */
    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
    /**
     * Send a counter metric
     */
    increment(metric, value = 1, tags) {
        if (!this.enabled || !this.socket)
            return;
        const allTags = [...this.defaultTags, ...this.formatTags(tags)];
        const message = `${this.prefix}.${metric}:${value}|c|${allTags.join(',')}`;
        this.send(message);
    }
    /**
     * Send a gauge metric
     */
    gauge(metric, value, tags) {
        if (!this.enabled || !this.socket)
            return;
        const allTags = [...this.defaultTags, ...this.formatTags(tags)];
        const message = `${this.prefix}.${metric}:${value}|g|${allTags.join(',')}`;
        this.send(message);
    }
    /**
     * Send a histogram metric
     */
    histogram(metric, value, tags) {
        if (!this.enabled || !this.socket)
            return;
        const allTags = [...this.defaultTags, ...this.formatTags(tags)];
        const message = `${this.prefix}.${metric}:${value}|h|${allTags.join(',')}`;
        this.send(message);
    }
    /**
     * Send a timing metric
     */
    timing(metric, value, tags) {
        if (!this.enabled || !this.socket)
            return;
        const allTags = [...this.defaultTags, ...this.formatTags(tags)];
        const message = `${this.prefix}.${metric}:${value}|ms|${allTags.join(',')}`;
        this.send(message);
    }
    /**
     * Format tags for DataDog
     */
    formatTags(tags) {
        if (!tags)
            return [];
        return Object.entries(tags).map(([key, value]) => `${key}:${value}`);
    }
    /**
     * Send message via UDP
     */
    send(message) {
        if (!this.socket)
            return;
        const buffer = Buffer.from(message);
        this.socket.send(buffer, 0, buffer.length, this.port, this.host, (err) => {
            if (err) {
                logger_1.logger.error('Error sending DataDog metric:', err);
            }
        });
    }
}
// DataDog client instance
let dataDogClient = null;
/**
 * Initialize DataDog integration
 */
function initializeDataDog() {
    const ddConfig = config_1.config.datadog;
    if (!ddConfig?.enabled) {
        logger_1.logger.info('DataDog integration disabled');
        return;
    }
    dataDogConfig = {
        enabled: ddConfig.enabled,
        apiKey: ddConfig.apiKey,
        appKey: ddConfig.appKey,
        host: ddConfig.host,
        port: ddConfig.port || 8125,
        prefix: ddConfig.prefix || 'armed_archer',
        tags: {
            environment: config_1.config.environment,
            service: 'armored-archer-backend',
            ...ddConfig.tags,
        },
    };
    dataDogClient = new DataDogMetricsClient(dataDogConfig);
    dataDogClient.initialize();
    logger_1.logger.info(`DataDog initialized with prefix: ${dataDogConfig.prefix}`);
}
/**
 * Get DataDog client for custom metrics
 */
function getDataDogClient() {
    return dataDogClient;
}
/**
 * Send RPC metrics to DataDog
 */
function sendRpcMetricsToDataDog(rpcName, durationMs, success) {
    if (!dataDogClient)
        return;
    const tags = {
        rpc: rpcName,
        status: success ? 'success' : 'error',
    };
    dataDogClient.increment('rpc.calls', 1, tags);
    dataDogClient.histogram('rpc.duration', durationMs, tags);
}
/**
 * Send player metrics to DataDog
 */
function sendPlayerMetricsToDataDog(activeSessions) {
    if (!dataDogClient)
        return;
    dataDogClient.gauge('player.active_sessions', activeSessions);
}
/**
 * Send match metrics to DataDog
 */
function sendMatchMetricsToDataDog(matchType, queueSize, waitTimeMs) {
    if (!dataDogClient)
        return;
    const tags = { match_type: matchType };
    dataDogClient.gauge('match.queue_size', queueSize, tags);
    dataDogClient.histogram('match.wait_time', waitTimeMs, tags);
}
/**
 * Send economy metrics to DataDog
 */
function sendEconomyMetricsToDataDog(productType, amount, currency, success) {
    if (!dataDogClient)
        return;
    const tags = {
        product_type: productType,
        currency,
        status: success ? 'success' : 'failure',
    };
    dataDogClient.increment('economy.purchases', 1, tags);
    if (success) {
        dataDogClient.increment('economy.revenue', amount, { ...tags, currency });
    }
}
/**
 * Send health metrics to DataDog
 */
function sendHealthMetricsToDataDog(healthy, cpuUsage, memoryUsage) {
    if (!dataDogClient)
        return;
    dataDogClient.gauge('health.status', healthy ? 1 : 0);
    dataDogClient.gauge('health.cpu_percent', cpuUsage);
    dataDogClient.gauge('health.memory_percent', memoryUsage);
}
/**
 * Check if DataDog is enabled
 */
function isDataDogEnabled() {
    return dataDogConfig.enabled;
}
/**
 * Get DataDog configuration
 */
function getDataDogConfig() {
    return { ...dataDogConfig };
}
