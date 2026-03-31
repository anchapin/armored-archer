"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeParse = safeParse;
exports.safeParsePayload = safeParsePayload;
exports.createErrorResponse = createErrorResponse;
function safeParse(jsonString, context, logger, operation) {
    try {
        if (!jsonString) {
            return { success: false };
        }
        var data = JSON.parse(jsonString);
        return { success: true, data: data };
    }
    catch (error) {
        if (logger) {
            logger.error('Failed to parse JSON for %s: %s', operation, error);
        }
        return { success: false };
    }
}
function safeParsePayload(payload, logger, operation) {
    try {
        if (!payload) {
            return null;
        }
        return JSON.parse(payload);
    }
    catch (error) {
        if (logger) {
            logger.error('Failed to parse JSON payload for %s: %s', operation, error);
        }
        return null;
    }
}
function createErrorResponse(code, message) {
    return JSON.stringify({
        error: message,
        error_code: code,
    });
}
