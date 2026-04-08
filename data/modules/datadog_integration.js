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
var tslib_1 = require("tslib");
var dgram = tslib_1.__importStar(require("dgram"));
var config_1 = require("../config");
var logger_1 = require("../config/logger");
// Default DataDog configuration
var dataDogConfig = {
    enabled: false,
    port: 8125,
    prefix: 'armed_archer',
    tags: {
        environment: 'development',
        service: 'armored-archer-backend',
    },
};
// StatsD-like interface for metrics (simplified implementation)
var DataDogMetricsClient = /** @class */ (function () {
    function DataDogMetricsClient(config) {
        this.socket = null;
        this.enabled = config.enabled;
        this.host = config.host || 'localhost';
        this.port = config.port;
        this.prefix = config.prefix;
        this.defaultTags = Object.entries(config.tags).map(function (_a) {
            var _b = tslib_1.__read(_a, 2), key = _b[0], value = _b[1];
            return "".concat(key, ":").concat(value);
        });
    }
    /**
     * Initialize the UDP socket for sending metrics
     */
    DataDogMetricsClient.prototype.initialize = function () {
        if (!this.enabled) {
            logger_1.logger.info('DataDog metrics disabled');
            return;
        }
        try {
            this.socket = dgram.createSocket('udp4');
            logger_1.logger.info("Initialized DataDog metrics client: ".concat(this.host, ":").concat(this.port));
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize DataDog metrics client:', error);
            this.enabled = false;
        }
    };
    /**
     * Close the UDP socket
     */
    DataDogMetricsClient.prototype.close = function () {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    };
    /**
     * Send a counter metric
     */
    DataDogMetricsClient.prototype.increment = function (metric, value, tags) {
        if (value === void 0) { value = 1; }
        if (!this.enabled || !this.socket)
            return;
        var allTags = tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(this.defaultTags), false), tslib_1.__read(this.formatTags(tags)), false);
        var message = "".concat(this.prefix, ".").concat(metric, ":").concat(value, "|c|").concat(allTags.join(','));
        this.send(message);
    };
    /**
     * Send a gauge metric
     */
    DataDogMetricsClient.prototype.gauge = function (metric, value, tags) {
        if (!this.enabled || !this.socket)
            return;
        var allTags = tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(this.defaultTags), false), tslib_1.__read(this.formatTags(tags)), false);
        var message = "".concat(this.prefix, ".").concat(metric, ":").concat(value, "|g|").concat(allTags.join(','));
        this.send(message);
    };
    /**
     * Send a histogram metric
     */
    DataDogMetricsClient.prototype.histogram = function (metric, value, tags) {
        if (!this.enabled || !this.socket)
            return;
        var allTags = tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(this.defaultTags), false), tslib_1.__read(this.formatTags(tags)), false);
        var message = "".concat(this.prefix, ".").concat(metric, ":").concat(value, "|h|").concat(allTags.join(','));
        this.send(message);
    };
    /**
     * Send a timing metric
     */
    DataDogMetricsClient.prototype.timing = function (metric, value, tags) {
        if (!this.enabled || !this.socket)
            return;
        var allTags = tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(this.defaultTags), false), tslib_1.__read(this.formatTags(tags)), false);
        var message = "".concat(this.prefix, ".").concat(metric, ":").concat(value, "|ms|").concat(allTags.join(','));
        this.send(message);
    };
    /**
     * Format tags for DataDog
     */
    DataDogMetricsClient.prototype.formatTags = function (tags) {
        if (!tags)
            return [];
        return Object.entries(tags).map(function (_a) {
            var _b = tslib_1.__read(_a, 2), key = _b[0], value = _b[1];
            return "".concat(key, ":").concat(value);
        });
    };
    /**
     * Send message via UDP
     */
    DataDogMetricsClient.prototype.send = function (message) {
        if (!this.socket)
            return;
        var buffer = Buffer.from(message);
        this.socket.send(buffer, 0, buffer.length, this.port, this.host, function (err) {
            if (err) {
                logger_1.logger.error('Error sending DataDog metric:', err);
            }
        });
    };
    return DataDogMetricsClient;
}());
// DataDog client instance
var dataDogClient = null;
/**
 * Initialize DataDog integration
 */
function initializeDataDog() {
    var ddConfig = config_1.config.datadog;
    if (!(ddConfig === null || ddConfig === void 0 ? void 0 : ddConfig.enabled)) {
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
        tags: tslib_1.__assign({ environment: config_1.config.environment, service: 'armored-archer-backend' }, ddConfig.tags),
    };
    dataDogClient = new DataDogMetricsClient(dataDogConfig);
    dataDogClient.initialize();
    logger_1.logger.info("DataDog initialized with prefix: ".concat(dataDogConfig.prefix));
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
    var tags = {
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
    var tags = { match_type: matchType };
    dataDogClient.gauge('match.queue_size', queueSize, tags);
    dataDogClient.histogram('match.wait_time', waitTimeMs, tags);
}
/**
 * Send economy metrics to DataDog
 */
function sendEconomyMetricsToDataDog(productType, amount, currency, success) {
    if (!dataDogClient)
        return;
    var tags = {
        product_type: productType,
        currency: currency,
        status: success ? 'success' : 'failure',
    };
    dataDogClient.increment('economy.purchases', 1, tags);
    if (success) {
        dataDogClient.increment('economy.revenue', amount, tslib_1.__assign(tslib_1.__assign({}, tags), { currency: currency }));
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
    return tslib_1.__assign({}, dataDogConfig);
}
