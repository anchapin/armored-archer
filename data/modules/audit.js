"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
var logger_1 = require("../config/logger");
/**
 * Logs an audit event to the audit_logs collection.
 * Logs are immutable once written and are used for security monitoring and compliance.
 *
 * @param nk - Nakama server interface
 * @param userId - User ID performing the action
 * @param ipAddress - IP address of the request (from ctx.ipAddress)
 * @param action - Action performed (e.g., 'gain_xp', 'equip_gear')
 * @param resource - Resource affected (e.g., 'player_stats', 'gear')
 * @param details - Additional context about the action
 * @param result - Outcome of the action
 * @param error - Optional error message if result is 'failure'
 */
function logAudit(nk, userId, ipAddress, action, resource, details, result, error) {
    var auditEntry = {
        timestamp: Date.now(),
        user_id: userId,
        ip_address: ipAddress,
        action: action,
        resource: resource,
        details: details,
        result: result,
        error: error,
    };
    try {
        nk.storageWrite([
            {
                collection: 'audit_logs',
                key: "audit_".concat(Date.now(), "_").concat(userId, "_").concat(Math.random().toString(36).substring(7)),
                userId: userId,
                value: JSON.stringify(auditEntry),
            },
        ]);
    }
    catch (err) {
        // Audit failures should not disrupt the main operation
        logger_1.logger.error('Failed to write audit log:', err);
    }
}
