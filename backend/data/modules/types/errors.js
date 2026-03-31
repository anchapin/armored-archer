"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = void 0;
exports.createErrorResponse = createErrorResponse;
exports.createSuccessResponse = createSuccessResponse;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["NOT_AUTHENTICATED"] = "NOT_AUTHENTICATED";
    ErrorCode["INVALID_SESSION"] = "INVALID_SESSION";
    ErrorCode["INVALID_JSON"] = "INVALID_JSON";
    ErrorCode["INVALID_XP_AMOUNT"] = "INVALID_XP_AMOUNT";
    ErrorCode["INVALID_STAT_NAME"] = "INVALID_STAT_NAME";
    ErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ErrorCode["INVALID_DATA"] = "INVALID_DATA";
    ErrorCode["INVALID_AMOUNT"] = "INVALID_AMOUNT";
    ErrorCode["INVALID_MATCH_TYPE"] = "INVALID_MATCH_TYPE";
    ErrorCode["INVALID_PRODUCT_ID"] = "INVALID_PRODUCT_ID";
    ErrorCode["INSUFFICIENT_ABILITY_POINTS"] = "INSUFFICIENT_ABILITY_POINTS";
    ErrorCode["INSUFFICIENT_CURRENCY"] = "INSUFFICIENT_CURRENCY";
    ErrorCode["INSUFFICIENT_GEMS"] = "INSUFFICIENT_GEMS";
    ErrorCode["PLAYER_STATS_NOT_FOUND"] = "PLAYER_STATS_NOT_FOUND";
    ErrorCode["MATCH_NOT_FOUND"] = "MATCH_NOT_FOUND";
    ErrorCode["PLAYER_INVENTORY_NOT_FOUND"] = "PLAYER_INVENTORY_NOT_FOUND";
    ErrorCode["GEAR_NOT_FOUND"] = "GEAR_NOT_FOUND";
    ErrorCode["GEAR_TYPE_MISMATCH"] = "GEAR_TYPE_MISMATCH";
    ErrorCode["NO_GEAR_EQUIPPED"] = "NO_GEAR_EQUIPPED";
    ErrorCode["INVALID_INVENTORY_DATA"] = "INVALID_INVENTORY_DATA";
    ErrorCode["MATCH_STATE_NOT_FOUND"] = "MATCH_STATE_NOT_FOUND";
    ErrorCode["TARGET_PLAYER_NOT_FOUND"] = "TARGET_PLAYER_NOT_FOUND";
    ErrorCode["NO_LEADERBOARD_ENTRY"] = "NO_LEADERBOARD_ENTRY";
    ErrorCode["REWARDS_ALREADY_CLAIMED"] = "REWARDS_ALREADY_CLAIMED";
    ErrorCode["NOT_PARTICIPANT"] = "NOT_PARTICIPANT";
    ErrorCode["NOT_YOUR_TURN"] = "NOT_YOUR_TURN";
    ErrorCode["CANNOT_OWN_MATCH"] = "CANNOT_OWN_MATCH";
    ErrorCode["MATCH_NO_LONGER_AVAILABLE"] = "MATCH_NO_LONGER_AVAILABLE";
    ErrorCode["RANK_DIFFERENCE_TOO_LARGE"] = "RANK_DIFFERENCE_TOO_LARGE";
    ErrorCode["INVALID_COMBAT_ACTION"] = "INVALID_COMBAT_ACTION";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["TIMEOUT"] = "TIMEOUT";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/**
 * Creates an error response.
 *
 * @param code - Error code
 * @param message - Error message
 * @param details - Optional error details
 * @returns JSON string with error response
 */
function createErrorResponse(code, message, details) {
    return JSON.stringify({
        success: false,
        error: {
            code: code,
            message: message,
            details: details,
            timestamp: Date.now(),
        },
    });
}
/**
 * Creates a success response.
 *
 * @param data - Response data
 * @returns JSON string with success response
 */
function createSuccessResponse(data) {
    return JSON.stringify({
        success: true,
        data: data,
    });
}
