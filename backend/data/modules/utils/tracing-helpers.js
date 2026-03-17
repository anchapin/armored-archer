"use strict";
/**
 * Shared tracing utilities for consistent span handling across the codebase.
 * This module extracts common patterns for async operations with OpenTelemetry spans.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withSpanAsync = withSpanAsync;
exports.withSpanSync = withSpanSync;
exports.withActiveSpanAsync = withActiveSpanAsync;
exports.setNakamaContextAttributes = setNakamaContextAttributes;
var tslib_1 = require("tslib");
var api_1 = require("@opentelemetry/api");
var config_1 = require("../config");
/**
 * Get the tracer instance for manual instrumentation.
 * This is a local copy to avoid circular imports.
 */
function getTracingTracer() {
    return api_1.trace.getTracer(config_1.config.tracing.serviceName, config_1.config.tracing.serviceVersion);
}
/**
 * Execute an async function within a traced span with consistent error handling.
 * This is the shared implementation for tracing async operations.
 *
 * @param name - The name of the span
 * @param fn - The async function to execute within the span
 * @param options - Optional span configuration
 * @returns The result of the async function
 */
function withSpanAsync(name, fn, options) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var tracer, span, result, error_1;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tracer = getTracingTracer();
                    span = tracer.startSpan(name, {
                        kind: options === null || options === void 0 ? void 0 : options.kind,
                        attributes: options === null || options === void 0 ? void 0 : options.attributes,
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, fn(span)];
                case 2:
                    result = _a.sent();
                    span.setStatus({ code: api_1.SpanStatusCode.OK });
                    return [2 /*return*/, result];
                case 3:
                    error_1 = _a.sent();
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: error_1 instanceof Error ? error_1.message : String(error_1),
                    });
                    span.recordException(error_1 instanceof Error ? error_1 : new Error(String(error_1)));
                    throw error_1;
                case 4:
                    span.end();
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Execute a synchronous function within a traced span with consistent error handling.
 *
 * @param name - The name of the span
 * @param fn - The function to execute within the span
 * @param options - Optional span configuration
 * @returns The result of the function
 */
function withSpanSync(name, fn, options) {
    var tracer = getTracingTracer();
    var span = tracer.startSpan(name, {
        kind: options === null || options === void 0 ? void 0 : options.kind,
        attributes: options === null || options === void 0 ? void 0 : options.attributes,
    });
    try {
        var result = fn(span);
        span.setStatus({ code: api_1.SpanStatusCode.OK });
        return result;
    }
    catch (error) {
        span.setStatus({
            code: api_1.SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
    finally {
        span.end();
    }
}
/**
 * Create a span with active tracking using startActiveSpan.
 * This is useful for operations that need automatic child span creation.
 *
 * @param name - The name of the span
 * @param fn - The async function to execute within the span
 * @returns The result of the async function
 */
function withActiveSpanAsync(name, fn) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var tracer;
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            tracer = getTracingTracer();
            return [2 /*return*/, tracer.startActiveSpan(name, function (span) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    var result, error_2;
                    return tslib_1.__generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, 3, 4]);
                                return [4 /*yield*/, fn(span)];
                            case 1:
                                result = _a.sent();
                                span.setStatus({ code: api_1.SpanStatusCode.OK });
                                return [2 /*return*/, result];
                            case 2:
                                error_2 = _a.sent();
                                span.setStatus({
                                    code: api_1.SpanStatusCode.ERROR,
                                    message: error_2 instanceof Error ? error_2.message : String(error_2),
                                });
                                span.recordException(error_2 instanceof Error ? error_2 : new Error(String(error_2)));
                                throw error_2;
                            case 3:
                                span.end();
                                return [7 /*endfinally*/];
                            case 4: return [2 /*return*/];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Set standard span attributes from Nakama runtime context.
 *
 * @param span - The span to set attributes on
 * @param context - The Nakama runtime context
 */
function setNakamaContextAttributes(span, context) {
    if (context.userId) {
        span.setAttribute('user.id', context.userId);
    }
    if (context.sessionId) {
        span.setAttribute('session.id', context.sessionId);
    }
    if (context.matchId) {
        span.setAttribute('match.id', context.matchId);
    }
}
