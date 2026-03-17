"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapRpc = wrapRpc;
exports.createErrorResponse = createErrorResponse;
exports.createSuccessResponse = createSuccessResponse;
var errorTracking_1 = require("../config/errorTracking");
var logger_1 = require("../config/logger");
function wrapRpc(handler, options) {
    return function (ctx, loggerParam, nk, payload) {
        var startTime = Date.now();
        var requestId = generateRequestId();
        try {
            var parsedPayload = undefined;
            if (payload) {
                try {
                    parsedPayload = JSON.parse(payload);
                    if (options.validatePayload && !options.validatePayload(parsedPayload)) {
                        throw new Error('Invalid payload');
                    }
                }
                catch (parseError) {
                    var error = parseError;
                    (0, logger_1.logRpcError)(options.name, ctx.userId, requestId, error, Date.now() - startTime);
                    (0, errorTracking_1.captureRpcError)(options.name, ctx.userId, error, payload);
                    return JSON.stringify({
                        success: false,
                        error: {
                            code: 'INVALID_PAYLOAD',
                            message: 'Invalid request payload',
                        },
                    });
                }
            }
            (0, logger_1.logRpcEntry)(options.name, ctx.userId, requestId, parsedPayload);
            var result = handler(ctx, loggerParam, nk, payload);
            var durationMs = Date.now() - startTime;
            (0, logger_1.logRpcExit)(options.name, ctx.userId, requestId, durationMs);
            return result;
        }
        catch (error) {
            var durationMs = Date.now() - startTime;
            var err = error;
            (0, logger_1.logRpcError)(options.name, ctx.userId, requestId, err, durationMs);
            (0, errorTracking_1.captureRpcError)(options.name, ctx.userId, err, payload);
            return JSON.stringify({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: err.message || 'An unexpected error occurred',
                },
            });
        }
    };
}
function generateRequestId() {
    return "".concat(Date.now(), "-").concat(Math.random().toString(36).substring(2, 11));
}
function createErrorResponse(code, message) {
    return JSON.stringify({
        success: false,
        error: {
            code: code,
            message: message,
        },
    });
}
function createSuccessResponse(data) {
    return JSON.stringify({
        success: true,
        data: data,
    });
}
