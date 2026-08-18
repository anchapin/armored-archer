/**
 * Shared admin authorization guard (issue #1075).
 *
 * Every privileged RPC — `admin_*` season tools, the rollout flag mutators,
 * `metrics`/`n_plus_one_report`, `deployment_*`, `error_insights_*`, and the
 * QA replay endpoints — is wrapped with `withAdminGuard` at its registration
 * site inside the owning module. The guard lives in the handler wrapper, not
 * in index.ts registration branches, so no conditional registration path can
 * skip it.
 *
 * Authorization model: allowlisted Nakama user ids supplied via the
 * `ADMIN_USER_IDS` environment variable (comma-separated). The allowlist is
 * parsed per call — a trivial string split, cheap enough to not cache — so
 * operators can rotate the list without a server restart.
 *
 * Fail-closed semantics: an unset or empty `ADMIN_USER_IDS` rejects every
 * caller, and calls that carry no userId (e.g. raw server-key invocations;
 * the server key ships inside client binaries) are never treated as admin.
 *
 * Every rejection is recorded in the caller's own audit trail via
 * `logAudit` (which never throws) and logged through both the runtime
 * logger and the winston application logger.
 */

import { logger as winstonLogger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { logAudit } from './audit';

/** RPC handler shape accepted by the admin guard (matches registerRpc). */
export type AdminGatedRpcHandler = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string | Promise<string>;

/**
 * Parse the ADMIN_USER_IDS allowlist.
 *
 * @returns Set of allowlisted user ids; empty (never undefined) when the
 * variable is unset or blank, which makes every admin RPC reject everyone.
 */
export function getAdminUserIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? '';
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
  );
}

/**
 * Whether the caller is an allowlisted admin.
 *
 * A missing/empty userId is never an admin: the Nakama server key is public
 * (embedded in clients), so server-key invocations must not bypass the gate.
 */
export function isAdminUser(userId: string | undefined | null): boolean {
  if (!userId) {
    return false;
  }
  return getAdminUserIds().has(userId);
}

/**
 * Wrap an RPC handler with the shared admin gate.
 *
 * Rejections return a generic `{ success: false, error: 'Not authorized' }`
 * payload — no internals are leaked to the caller — after writing an
 * `admin_rpc_access_denied` audit entry against the calling user.
 *
 * @param rpcId - Full RPC id (e.g. 'armored_archer/rollout_create_flag'),
 *                used in audit records and logs.
 * @param handler - The privileged RPC handler to wrap.
 * @returns The guarded handler to pass to `initializer.registerRpc`.
 */
export function withAdminGuard(rpcId: string, handler: AdminGatedRpcHandler): AdminGatedRpcHandler {
  return function adminGatedHandler(
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): string | Promise<string> {
    if (isAdminUser(ctx.userId)) {
      return handler(ctx, logger, nk, payload);
    }

    const callerId = ctx.userId || 'unknown';

    // Security-monitoring trail entry. logAudit swallows its own failures,
    // so a broken audit sink can never turn into an availability issue.
    logAudit(
      nk,
      callerId,
      ctx.ipAddress ?? null,
      'admin_rpc_access_denied',
      rpcId,
      { rpc_id: rpcId, reason: 'caller_not_in_admin_allowlist' },
      'failure',
      'caller is not an allowlisted admin'
    );

    logger.warn('Admin RPC %s rejected: caller %s is not an allowlisted admin', rpcId, callerId);
    winstonLogger.warn('Admin RPC rejected: caller is not an allowlisted admin', {
      rpc_id: rpcId,
      user_id: callerId,
      ip_address: ctx.ipAddress ?? null,
    });

    return JSON.stringify({
      success: false,
      error: 'Not authorized',
      rpc: rpcId,
    });
  };
}
