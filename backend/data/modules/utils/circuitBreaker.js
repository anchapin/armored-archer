"use strict";
/**
 * Circuit Breaker Utility
 *
 * Provides circuit breaker pattern implementation for external service calls.
 * Prevents cascading failures when downstream services become unavailable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCircuitBreaker = createCircuitBreaker;
exports.getCircuitBreaker = getCircuitBreaker;
exports.withCircuitBreaker = withCircuitBreaker;
exports.getCircuitState = getCircuitState;
exports.getCircuitStats = getCircuitStats;
exports.getAllCircuitStates = getAllCircuitStates;
exports.openCircuit = openCircuit;
exports.closeCircuit = closeCircuit;
exports.getAllCircuitInfo = getAllCircuitInfo;
var tslib_1 = require("tslib");
var opossum_1 = tslib_1.__importDefault(require("opossum"));
var logger_1 = require("../config/logger");
/**
 * Registered circuit breakers
 */
var circuits = new Map();
/**
 * Default circuit breaker options
 */
var DEFAULT_OPTIONS = {
    timeout: 5000, // 5 seconds
    errorThresholdPercentage: 50, // 50% failure rate
    volumeThreshold: 3, // At least 3 requests before evaluating
    resetTimeout: 30000, // 30 seconds
};
/**
 * Logger instance for circuit breaker events
 */
var cbLogger = {
    warn: function (msg) { return logger_1.logger.warn(msg); },
    info: function (msg) { return logger_1.logger.info(msg); },
    debug: function (msg) { return logger_1.logger.debug(msg); },
    error: function (msg) { return logger_1.logger.error(msg); },
};
/**
 * Creates a circuit breaker for a given service
 *
 * @param serviceName - The name of the service to protect
 * @param options - Custom circuit breaker options
 * @returns The circuit breaker instance
 */
function createCircuitBreaker(serviceName, options) {
    var _this = this;
    if (options === void 0) { options = {}; }
    // If circuit already exists, return existing instance
    if (circuits.has(serviceName)) {
        cbLogger.warn('Circuit breaker already exists for ' + serviceName + ', returning existing instance');
        return circuits.get(serviceName).breaker;
    }
    var mergedOptions = tslib_1.__assign(tslib_1.__assign({}, DEFAULT_OPTIONS), options);
    var breaker = new opossum_1.default(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            // Placeholder - actual function will be passed when calling fire()
            throw new Error('Circuit breaker called without function');
        });
    }); }, {
        timeout: mergedOptions.timeout,
        errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
        volumeThreshold: mergedOptions.volumeThreshold,
        resetTimeout: mergedOptions.resetTimeout,
    });
    var instance = {
        breaker: breaker,
        serviceName: serviceName,
        options: mergedOptions,
        stats: {
            failures: 0,
            successes: 0,
            rejects: 0,
            lastFailure: null,
        },
    };
    // Set up event handlers
    breaker.on('open', function () {
        cbLogger.warn('Circuit breaker OPEN for ' + serviceName);
    });
    breaker.on('close', function () {
        cbLogger.info('Circuit breaker CLOSED for ' + serviceName);
    });
    breaker.on('halfOpen', function () {
        cbLogger.info('Circuit breaker HALF_OPEN for ' + serviceName);
    });
    breaker.on('success', function (result, latency) {
        instance.stats.successes++;
        cbLogger.debug('Request succeeded for ' + serviceName + ' (latency: ' + latency + 'ms)');
    });
    breaker.on('failure', function (error, latency) {
        instance.stats.failures++;
        instance.stats.lastFailure = new Date();
        cbLogger.error('Request failed for ' +
            serviceName +
            ' (error: ' +
            error.message +
            ', latency: ' +
            latency +
            'ms)');
    });
    breaker.on('reject', function () {
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
function getCircuitBreaker(serviceName, options) {
    var existing = circuits.get(serviceName);
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
function withCircuitBreaker(serviceName, fn, fallback, options) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var breaker, result, error_1;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    breaker = getCircuitBreaker(serviceName, options);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, breaker.fire(fn)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result];
                case 3:
                    error_1 = _a.sent();
                    // If circuit is open and fallback provided, use fallback
                    if (breaker.opened && fallback) {
                        cbLogger.info('Using fallback due to open circuit for ' + serviceName);
                        return [2 /*return*/, fallback()];
                    }
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Gets the current state of a circuit breaker
 *
 * @param serviceName - The service name
 * @returns Current circuit state or null if not found
 */
function getCircuitState(serviceName) {
    var instance = circuits.get(serviceName);
    if (!instance) {
        return null;
    }
    if (instance.breaker.opened)
        return 'OPEN';
    if (instance.breaker.halfOpen)
        return 'HALF_OPEN';
    return 'CLOSED';
}
/**
 * Gets statistics for a circuit breaker
 *
 * @param serviceName - The service name
 * @returns Statistics or null if not found
 */
function getCircuitStats(serviceName) {
    var instance = circuits.get(serviceName);
    return instance ? tslib_1.__assign({}, instance.stats) : null;
}
/**
 * Gets all circuit breaker states
 *
 * @returns Map of service names to their states
 */
function getAllCircuitStates() {
    var states = new Map();
    Array.from(circuits.entries()).forEach(function (_a) {
        var _b = tslib_1.__read(_a, 2), name = _b[0], instance = _b[1];
        var state = 'CLOSED';
        if (instance.breaker.opened)
            state = 'OPEN';
        else if (instance.breaker.halfOpen)
            state = 'HALF_OPEN';
        states.set(name, state);
    });
    return states;
}
/**
 * Manually opens a circuit breaker (for testing or emergency use)
 *
 * @param serviceName - The service name
 */
function openCircuit(serviceName) {
    var instance = circuits.get(serviceName);
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
function closeCircuit(serviceName) {
    var instance = circuits.get(serviceName);
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
function getAllCircuitInfo() {
    var info = [];
    Array.from(circuits.entries()).forEach(function (_a) {
        var _b = tslib_1.__read(_a, 2), name = _b[0], instance = _b[1];
        var state = 'CLOSED';
        if (instance.breaker.opened)
            state = 'OPEN';
        else if (instance.breaker.halfOpen)
            state = 'HALF_OPEN';
        info.push({
            serviceName: name,
            state: state,
            stats: tslib_1.__assign({}, instance.stats),
            options: tslib_1.__assign({}, instance.options),
        });
    });
    return info;
}
