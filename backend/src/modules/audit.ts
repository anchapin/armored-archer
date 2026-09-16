import { Counter } from 'prom-client';
import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { toStorageValue, getStorageRawValue } from '../utils/storage-helpers';
import { isAdminUser } from './admin_auth';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

// Issue #1133: audit-log persistence side channel.
//
// Why this counter lives here and NOT in metrics.ts:
// `metrics.ts` already imports `setAdminGuardMetricsCallbacks` from
// `admin_auth.ts`, and `admin_auth.ts` imports `logAudit` from this module.
// Adding a third hop (`audit.ts → metrics.ts → admin_auth.ts → audit.ts`)
// closes the cycle and races the `accessDeniedMetricSink` `let` initializer
// in admin_auth.ts (TDZ violation on module load — see metrics.ts's
// module-level `setAdminGuardMetricsCallbacks(...)` call). Declaring the
// counter locally keeps the side-channel observability without dragging
// this file into the cycle. The counter registers against prom-client's
// default registry; a follow-up can fold it into the project's custom
// registry via the existing `setAdminGuardMetricsCallbacks`-style injection
// pattern if ops need it on the same scrape endpoint as the rest of the
// metrics family.
const auditLogsPersistFailedTotal = new Counter({
  name: 'armored_archer_audit_logs_persist_failed_total',
  help:
    'Total audit_logs storageWrite failures (issue #1133). Each drop is a ' +
    'potentially-lost reconciliation signal; alert when the rate is non-zero.',
});

/**
 * Side-channel increment for dropped audit-log writes (issue #1133). Called
 * from `logAudit` whenever the underlying `storageWrite` throws, so ops can
 * alert on audit persistence failures even at non-critical call sites that
 * discard logAudit's boolean return.
 */
export function recordAuditLogPersistFailure(): void {
  auditLogsPersistFailedTotal.inc();
}

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
 * Persist-failure semantics (issue #1133): the audit collection write can
 * itself fail (storage outage, quota, etc.). Historically we swallowed the
 * error so the caller never knew the audit was dropped, which is fine for
 * best-effort audit-on-the-side calls but is catastrophic for ops-visible
 * reconciliation signals — most importantly the PvP `settlement_degraded`
 * channel (issue #1078), whose `logAudit` write is the SOLE durable
 * record that a match was partially applied. The function now returns
 * `true` when the entry landed and `false` when the underlying
 * `storageWrite` threw, and increments the
 * `armored_archer_audit_logs_persist_failed_total` counter on every drop
 * so ops can see the failure mode even from non-critical call sites that
 * discard the boolean. The void→boolean signature change is
 * backward-compatible for the 180 callers that ignore the return value.
 *
 * @param nk - Nakama server interface
 * @param userId - User ID performing the action
 * @param ipAddress - IP address of the request (from ctx.ipAddress)
 * @param action - Action performed (e.g., 'gain_xp', 'equip_gear')
 * @param resource - Resource affected (e.g., 'player_stats', 'gear')
 * @param details - Additional context about the action
 * @param result - Outcome of the action
 * @param error - Optional error message if result is 'failure'
 * @returns `true` when the audit entry was persisted, `false` when the
 *   `storageWrite` call threw and the entry was dropped
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
): boolean {
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
        value: toStorageValue(auditEntry),
      },
    ]);
    return true;
  } catch (err) {
    // Audit failures must not disrupt the main operation, but ops-visible
    // callers (issue #1133) need to know the entry was dropped. The counter
    // is the side-channel so non-critical callers that discard the return
    // value still leave a paper trail; the boolean return lets the one
    // critical caller (matchmaker settlement_degraded) escalate.
    logger.error('Failed to write audit log:', err);
    recordAuditLogPersistFailure();
    return false;
  }
}

/**
 * Query audit logs with optional filters.
 * Supports filtering by user_id, action, result, and date range.
 *
 * Reads are hard-scoped to the calling user (issue #1077): audit entries embed
 * PII (IP addresses, purchase events, gem balances, moderation reasons), so a
 * player may only ever list their own audit trail.
 *
 * Scoping decision: a payload user_id that differs from ctx.userId is REJECTED
 * with a generic error rather than silently clamped, so impersonation attempts
 * surface as failures and are recorded via logAudit in the caller's own audit
 * trail for security monitoring. The victim's data is never read or logged.
 *
 * Admin override (issue #1075): callers allowlisted via the shared admin gate
 * (ADMIN_USER_IDS) may query any user's audit trail — without this, operators
 * could not investigate the admin_rpc_access_denied entries the gate itself
 * writes against rejected callers. Non-admins remain hard-scoped to their own
 * entries.
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

  const callerIsAdmin = isAdminUser(ctx.userId);

  // Payload user_id is advisory only for players: it must either match the
  // caller or be absent. A mismatch is a cross-user read attempt — reject and
  // audit-log it against the caller (logAudit never throws, so this path
  // stays safe). Allowlisted admins may target any user (issue #1075).
  if (user_id !== undefined && user_id !== ctx.userId && !callerIsAdmin) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'query_audit_logs',
      'audit_logs',
      { requested_user_id: user_id, reason: 'cross_user_access_denied' },
      'failure',
      'requested user_id does not match the authenticated caller'
    );
    loggerParam.warn('query_audit_logs: rejected cross-user read attempt by caller %s', ctx.userId);
    return JSON.stringify({
      success: false,
      error: 'Not permitted to query audit logs for another user',
      logs: [],
      count: 0,
    });
  }

  // Missing user_id defaults to the caller; a matching user_id is redundant.
  // Allowlisted admins may read any player's trail; players only their own.
  const effectiveUserId: string = callerIsAdmin && user_id !== undefined ? user_id : ctx.userId;

  try {
    const storageObjects = nk.storageList(effectiveUserId, 'audit_logs', limit, cursor || '', '');

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
      const entry = JSON.parse(getStorageRawValue(obj.value) ?? '') as AuditLogDetails;

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
