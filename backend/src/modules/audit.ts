import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

/**
 * Audit log entry details.
 */
export interface AuditLogDetails {
  timestamp: number;
  user_id: string;
  ip_address: string | null;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  result: 'success' | 'failure';
  error?: string;
}

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
export function logAudit(
  nk: Runtime.Nakama,
  userId: string,
  ipAddress: string | null,
  action: string,
  resource: string,
  details: Record<string, unknown>,
  result: 'success' | 'failure',
  error?: string
): void {
  const auditEntry: AuditLogDetails = {
    timestamp: Date.now(),
    user_id: userId,
    ip_address: ipAddress,
    action,
    resource,
    details,
    result,
    error,
  };

  try {
    nk.storageWrite([
      {
        collection: 'audit_logs',
        key: `audit_${Date.now()}_${userId}_${Math.random().toString(36).substring(7)}`,
        userId,
        value: JSON.stringify(auditEntry),
      },
    ]);
  } catch (err) {
    // Audit failures should not disrupt the main operation
    logger.error('Failed to write audit log:', err);
  }
}

/**
 * Query audit logs with optional filters.
 * Supports filtering by user_id, action, result, and date range.
 *
 * @param ctx - Nakama runtime context
 * @param loggerParam - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string with query parameters
 * @returns JSON string with matching audit log entries
 */
export function rpcQueryAuditLogs(
  ctx: Runtime.Context,
  loggerParam: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  loggerParam.info('Querying audit logs');

  const validation = validatePayload(ZodSchemas.query_audit_logs, payload, 'query_audit_logs');
  if (!validation.success) {
    return createValidationErrorResponse('query_audit_logs', validation.error);
  }

  const {
    user_id,
    action,
    result,
    from_timestamp,
    to_timestamp,
    limit = 50,
    cursor = '',
  } = validation.data;

  try {
    const storageObjects = nk.storageList(user_id || '', 'audit_logs', limit, cursor || '', '');

    const logs = filterAuditEntries(
      storageObjects,
      action,
      result,
      from_timestamp,
      to_timestamp,
      loggerParam
    );

    const nextCursor =
      storageObjects.length >= limit
        ? storageObjects[storageObjects.length - 1]?.key || null
        : null;

    return JSON.stringify({ success: true, logs, cursor: nextCursor, count: logs.length });
  } catch (err) {
    loggerParam.error('Failed to query audit logs:', err);
    return JSON.stringify({
      success: false,
      error: 'Failed to query audit logs',
      logs: [],
      count: 0,
    });
  }
}

/** Apply client-side filters to audit log entries returned by storageList. */
function filterAuditEntries(
  storageObjects: Runtime.StorageObject[],
  action: string | undefined,
  result: string | undefined,
  fromTimestamp: number | undefined,
  toTimestamp: number | undefined,
  loggerParam: Runtime.Logger
): AuditLogDetails[] {
  const logs: AuditLogDetails[] = [];

  for (const obj of storageObjects) {
    try {
      const entry = JSON.parse(obj.value) as AuditLogDetails;

      if (action && entry.action !== action) continue;
      if (result && entry.result !== result) continue;
      if (fromTimestamp && entry.timestamp < fromTimestamp) continue;
      if (toTimestamp && entry.timestamp > toTimestamp) continue;

      logs.push(entry);
    } catch {
      loggerParam.warn('Failed to parse audit log entry: %s', obj.key);
    }
  }

  return logs;
}

/** Register the query_audit_logs RPC endpoint. */
export function registerRpcQueryAuditLogs(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/query_audit_logs', rpcQueryAuditLogs);
}
