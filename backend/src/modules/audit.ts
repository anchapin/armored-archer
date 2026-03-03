import { Runtime } from '../types/nakama';

/**
 * Audit log entry details.
 */
export interface AuditLogDetails {
  timestamp: number;
  user_id: string;
  ip_address: string | null;
  action: string;
  resource: string;
  details: Record<string, any>;
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
  details: Record<string, any>,
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
  }
}
