/**
 * Shared admin authorization guard (issue #1075, hardened in #1155).
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
 * parsed once on first use and frozen — see #1155 for the rationale. Per-call
 * re-parsing was a TOCTOU surface (a hot-reload, test fixture, or stray
 * `process.env.ADMIN_USER_IDS = …` mutation could flip the gate between
 * requests without any operator action). The parser also rejects malformed
 * entries (whitespace, commas, oversized strings, non-canonical characters)
 * and normalizes case to lowercase so an admin allowlist entry written as
 * `ABC-123` matches a `ctx.userId` of `abc-123` — a case mismatch previously
 * bricked the deployment silently.
 *
 * Fail-closed semantics: an unset, blank, or empty `ADMIN_USER_IDS` rejects
 * every caller (the resolved Set is empty). Calls that carry no userId
 * (e.g. raw server-key invocations; the server key ships inside client
 * binaries) are never treated as admin.
 *
 * The resolved count and a SHA-prefix of each id are logged once at first
 * parse for rotation auditability — operators can prove the deployed
 * allowlist without printing the raw ids.
 *
 * `resetAdminAllowlistCache()` is exported for tests that mutate
 * `process.env.ADMIN_USER_IDS` between cases; production code should never
 * call it. `reloadAdminAllowlist()` is the explicit operator-facing path for
 * mid-flight rotation if a future need arises.
 *
 * Every rejection is recorded in the caller's own audit trail via
 * `logAudit` (which never throws) and logged through both the runtime
 * logger and the winston application logger. Since issue #1141 every
 * rejection also increments the `armored_archer_admin_rpc_access_denied_total`
 * counter and every allowlist (re)resolution sets the
 * `armored_archer_admin_allowlist_size` gauge — both via sinks injected by
 * `metrics.ts` through `setAdminGuardMetricsCallbacks()` (this module cannot
 * import metrics.ts directly without an import cycle). Like `logAudit`, the
 * metric sinks swallow their own failures so a broken metrics registry can
 * never turn into an availability or gate-bypass issue.
 */

import { createHash } from 'crypto';
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
 * Canonical Nakama user-id format used for admin allowlist validation.
 *
 * Accepts both the server-generated 32-hex-char form (e.g. Nakama's own
 * internal IDs) and the conventional UUID form with dashes. Whitespace,
 * commas, and other punctuation are rejected to catch operator typos
 * (issue #1155). The maximum length is generous — Nakama's longest canonical
 * user id is 40 chars with dashes — but capped to prevent a runaway env var
 * from inflating the parse.
 */
const VALID_USER_ID = /^[a-zA-Z0-9-]{1,128}$/;

/** Internal shape of the cached allowlist. Frozen so callers cannot mutate it. */
interface ResolvedAllowlist {
  readonly ids: ReadonlySet<string>;
  readonly count: number;
  readonly fingerprints: readonly string[];
}

let cachedAllowlist: ResolvedAllowlist | null = null;

// ---- Metric sinks (issue #1141) ----
// Wired by metrics.ts via setAdminGuardMetricsCallbacks() at module load.
// Kept optional + failure-swallowing so a missing or broken metrics
// registry can never affect the gate's authorization decision.

/**
 * Why a guard call was rejected. Also the `reason` label value on the
 * `armored_archer_admin_rpc_access_denied_total` counter and in the audit
 * entry details, so metrics, logs, and the audit trail share one vocabulary.
 */
export type AdminAccessDeniedReason = 'caller_not_in_admin_allowlist' | 'caller_id_missing';

/** Sink shape for the access-denied counter increment. */
type AccessDeniedMetricSink = (rpcId: string, reason: AdminAccessDeniedReason) => void;

/** Sink shape for the allowlist-size gauge update. */
type AllowlistSizeMetricSink = (count: number) => void;

let accessDeniedMetricSink: AccessDeniedMetricSink | null = null;
let allowlistSizeMetricSink: AllowlistSizeMetricSink | null = null;

/**
 * Inject the metric sinks used by the guard (issue #1141). Called once by
 * metrics.ts at module load — the same dependency-injection pattern the
 * rate limiter uses — because a direct metrics.ts import from here would
 * create an import cycle (metrics.ts imports withAdminGuard).
 */
export function setAdminGuardMetricsCallbacks(
  onAccessDenied: AccessDeniedMetricSink,
  onAllowlistResolved: AllowlistSizeMetricSink
): void {
  accessDeniedMetricSink = onAccessDenied;
  allowlistSizeMetricSink = onAllowlistResolved;
}

/** Increment the rejection counter; never throws (mirrors logAudit). */
function emitAccessDeniedMetric(rpcId: string, reason: AdminAccessDeniedReason): void {
  if (accessDeniedMetricSink === null) {
    return;
  }
  try {
    accessDeniedMetricSink(rpcId, reason);
  } catch (err) {
    winstonLogger.warn('Failed to emit admin access-denied metric', {
      rpc_id: rpcId,
      reason,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Update the allowlist-size gauge; never throws (mirrors logAudit). */
function emitAllowlistSizeMetric(count: number): void {
  if (allowlistSizeMetricSink === null) {
    return;
  }
  try {
    allowlistSizeMetricSink(count);
  } catch (err) {
    winstonLogger.warn('Failed to emit admin allowlist-size metric', {
      count,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Validate, normalize, and fingerprint the ADMIN_USER_IDS env var.
 *
 * Parsing rules:
 *  - Split on comma, trim each entry, drop empty segments.
 *  - Reject any entry that contains whitespace, a comma, or any character
 *    outside `[a-zA-Z0-9-]` (operator typos). When the env var is unset or
 *    blank the resolved set is empty — which is the fail-closed default.
 *  - Normalize to lowercase so that `ctx.userId=ABC-123` matches an env
 *    entry of `abc-123`.
 *  - SHA-256 prefix is logged per id for rotation auditability.
 *
 * @throws if any entry is malformed; the process is expected to crash
 *         immediately on startup rather than run with a silently-broken gate.
 */
function parseAndValidate(raw: string | undefined): ResolvedAllowlist {
  const entries = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (entries.length === 0) {
    winstonLogger.info(
      'Admin allowlist is empty (ADMIN_USER_IDS unset or blank); all admin RPCs will reject every caller (fail-closed)'
    );
    return { ids: new Set(), count: 0, fingerprints: [] };
  }

  const normalized = new Set<string>();
  const fingerprints: string[] = [];
  for (const id of entries) {
    if (!VALID_USER_ID.test(id)) {
      throw new Error(
        `ADMIN_USER_IDS contains malformed entry ${JSON.stringify(id)}: must match ${VALID_USER_ID} (alphanumeric + dash, 1-128 chars). Fix the env var and restart.`
      );
    }
    const lower = id.toLowerCase();
    if (normalized.has(lower)) {
      winstonLogger.warn(
        'Admin allowlist contains duplicate entry (after case normalization); ignoring duplicate',
        {
          duplicate_id: lower,
        }
      );
      continue;
    }
    normalized.add(lower);
    fingerprints.push(createHash('sha256').update(lower).digest('hex').slice(0, 8));
  }

  const resolved: ResolvedAllowlist = {
    ids: normalized,
    count: normalized.size,
    fingerprints,
  };
  winstonLogger.info('Admin allowlist parsed', {
    count: resolved.count,
    fingerprints: resolved.fingerprints,
  });
  return resolved;
}

/**
 * Lazily parse, validate, and cache the ADMIN_USER_IDS allowlist.
 *
 * The first call resolves the env var; subsequent calls return the same
 * frozen Set so a TOCTOU mutation of `process.env.ADMIN_USER_IDS` cannot
 * flip the gate between requests (issue #1155). Tests that mutate the env
 * var explicitly call `resetAdminAllowlistCache()` to invalidate the cache.
 *
 * @returns Frozen Set of allowlisted (lowercase) user ids; empty (never
 *         undefined) when the variable is unset or blank, which makes every
 *         admin RPC reject everyone.
 */
export function getAdminUserIds(): ReadonlySet<string> {
  if (cachedAllowlist === null) {
    cachedAllowlist = parseAndValidate(process.env.ADMIN_USER_IDS);
    emitAllowlistSizeMetric(cachedAllowlist.count);
  }
  return cachedAllowlist.ids;
}

/**
 * Invalidate the cached allowlist so the next `getAdminUserIds()` call
 * re-parses `process.env.ADMIN_USER_IDS`.
 *
 * Production code must NOT call this — the cached-once semantics is the
 * whole point of #1155's hardening. Only test code that mutates the env
 * between cases should invoke it.
 */
export function resetAdminAllowlistCache(): void {
  cachedAllowlist = null;
}

/**
 * Explicit, audited reload of the admin allowlist.
 *
 * Reserved for the case where mid-flight rotation is genuinely needed (e.g.
 * an incident-response RPC). Re-reads the env var, validates it, and
 * replaces the cached Set atomically. Returns the new count so callers can
 * log the rotation.
 *
 * A malformed env var does NOT throw — it leaves the existing cache intact
 * and surfaces the error to the caller, so a broken rotation does not
 * disable the gate.
 */
export function reloadAdminAllowlist(): number {
  const next = parseAndValidate(process.env.ADMIN_USER_IDS);
  cachedAllowlist = next;
  emitAllowlistSizeMetric(next.count);
  return next.count;
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
  return getAdminUserIds().has(userId.toLowerCase());
}

/**
 * Wrap an RPC handler with the shared admin gate.
 *
 * Rejections return a generic `{ success: false, error: 'Not authorized' }`
 * payload — no internals are leaked to the caller — after writing an
 * `admin_rpc_access_denied` audit entry against the calling user and
 * incrementing the `armored_archer_admin_rpc_access_denied_total` counter
 * (issue #1141). A call with no userId (server-key invocation) is rejected
 * with reason `caller_id_missing`; a userId that is merely not allowlisted
 * is rejected with reason `caller_not_in_admin_allowlist`. The same reason
 * string is recorded in the audit entry details so metrics and the audit
 * trail stay joinable.
 *
 * @param rpcId - Full RPC id (e.g. 'armored_archer/rollout_create_flag'),
 *                used in audit records, logs, and metric labels.
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
    const reason: AdminAccessDeniedReason = ctx.userId
      ? 'caller_not_in_admin_allowlist'
      : 'caller_id_missing';

    // Security-monitoring trail entry. logAudit swallows its own failures,
    // so a broken audit sink can never turn into an availability issue.
    logAudit(
      nk,
      callerId,
      ctx.ipAddress ?? null,
      'admin_rpc_access_denied',
      rpcId,
      { rpc_id: rpcId, reason },
      'failure',
      'caller is not an allowlisted admin'
    );

    // Prometheus counter (issue #1141) — fail-closed observability with the
    // same swallow-failure guarantee as the audit sink above.
    emitAccessDeniedMetric(rpcId, reason);

    logger.warn(
      'Admin RPC %s rejected (%s): caller %s is not an allowlisted admin',
      rpcId,
      reason,
      callerId
    );
    winstonLogger.warn('Admin RPC rejected: caller is not an allowlisted admin', {
      rpc_id: rpcId,
      reason,
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
