"use strict";
/**
 * Tracing utility module for distributed tracing integration.
 * Provides utilities for instrumenting Nakama RPC handlers with OpenTelemetry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTracingTracer = getTracingTracer;
exports.createTracedRpcHandler = createTracedRpcHandler;
exports.traceAsync = traceAsync;
exports.traceDbOperation = traceDbOperation;
exports.traceCacheOperation = traceCacheOperation;
exports.traceExternalCall = traceExternalCall;
exports.addTracingEvent = addTracingEvent;
exports.setTracingAttribute = setTracingAttribute;
var tslib_1 = require("tslib");
var api_1 = require("@opentelemetry/api");
var config_1 = require("../config");
var tracing_helpers_1 = require("./tracing-helpers");
/**
 * Get the tracer instance for manual instrumentation.
 */
function getTracingTracer() {
    return api_1.trace.getTracer(config_1.config.tracing.serviceName, config_1.config.tracing.serviceVersion);
}
/**
 * Create a traced wrapper for an RPC handler function.
 * This wraps async functions with OpenTelemetry spans for distributed tracing.
 */
function createTracedRpcHandler(handlerName, handler, options) {
    var _this = this;
    return function (ctx, logger, nk, payload) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var tracer, span, result, error_1, errorMessage;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tracer = getTracingTracer();
                    span = tracer.startSpan("rpc.".concat(handlerName), {
                        kind: api_1.SpanKind.SERVER,
                        attributes: tslib_1.__assign({ 'rpc.system': 'nakama', 'rpc.method': handlerName, 'deployment.environment': config_1.config.environment }, ((options === null || options === void 0 ? void 0 : options.attributes) || {})),
                    });
                    // Add user context if available
                    if (ctx.userId) {
                        span.setAttribute('user.id', ctx.userId);
                    }
                    if (ctx.sessionId) {
                        span.setAttribute('session.id', ctx.sessionId);
                    }
                    if (ctx.matchId) {
                        span.setAttribute('match.id', ctx.matchId);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, handler(ctx, logger, nk, payload)];
                case 2:
                    result = _a.sent();
                    span.setStatus({ code: api_1.SpanStatusCode.OK });
                    return [2 /*return*/, result];
                case 3:
                    error_1 = _a.sent();
                    errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: errorMessage,
                    });
                    span.recordException(error_1 instanceof Error ? error_1 : new Error(String(error_1)));
                    throw error_1;
                case 4:
                    span.end();
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
}
/**
 * Execute an async function within a traced span.
 * Provides a simpler API than createTracedRpcHandler for inline usage.
 */
function traceAsync(name, fn) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, (0, tracing_helpers_1.withSpanAsync)(name, fn)];
        });
    });
}
/**
 * Execute a function with tracing for database operations.
 */
function traceDbOperation(operationName, operation) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, (0, tracing_helpers_1.withActiveSpanAsync)("db.".concat(operationName), function (span) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        span.setAttribute('db.system', 'postgresql');
                        span.setAttribute('db.operation', operationName);
                        return [2 /*return*/, operation()];
                    });
                }); })];
        });
    });
}
/**
 * Execute a function with tracing for cache operations.
 */
function traceCacheOperation(operationName, operation) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, (0, tracing_helpers_1.withActiveSpanAsync)("cache.".concat(operationName), function (span) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        span.setAttribute('cache.system', 'memory');
                        span.setAttribute('cache.operation', operationName);
                        return [2 /*return*/, operation()];
                    });
                }); })];
        });
    });
}
/**
 * Execute a function with tracing for external service calls.
 */
function traceExternalCall(serviceName, operationName, operation) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, (0, tracing_helpers_1.withActiveSpanAsync)("external.".concat(serviceName, ".").concat(operationName), function (span) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        span.setAttribute('peer.service', serviceName);
                        span.setAttribute('http.method', operationName);
                        return [2 /*return*/, operation()];
                    });
                }); })];
        });
    });
}
/**
 * Add custom event to current active span.
 */
function addTracingEvent(eventName, attributes) {
    var activeSpan = api_1.trace.getSpan(api_1.context.active());
    if (activeSpan) {
        activeSpan.addEvent(eventName, attributes);
    }
}
/**
 * Set attribute on current active span.
 */
function setTracingAttribute(key, value) {
    var activeSpan = api_1.trace.getSpan(api_1.context.active());
    if (activeSpan) {
        activeSpan.setAttribute(key, value);
    }
}
