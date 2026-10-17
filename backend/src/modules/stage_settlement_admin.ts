/**
 * Issue #1558 Stage 4 - retention sweep and support tooling for the stage
 * settlement journal (design docs/STAGE_SETTLEMENT_RECOVERY.md sections 4-5).
 *
 * Three admin-gated endpoints (same ADMIN_USER_IDS allowlist as the other
 * operator RPCs, via withAdminGuard):
 *   - armored_archer/admin_list_failed_stage_settlements: the support queue -
 *     every player's failed settlements, newest first.
 *   - armored_archer/admin_settle_stage_settlement: manual re-drive of one
 *     failed settlement by user id + stage id, reusing the Stage 3 recovery
 *     legs (original grant IDs, single-winner OCC transitions).
 *   - armored_archer/admin_cleanup_stage_settlements: retention sweep -
 *     settled settlements older than the retention window (default 30 days)
 *     are deleted; failed settlements NEVER expire (they are the support
 *     queue) and pending settlements are left alone.
 */

import { Runtime } from '../types/nakama';
import { createErrorResponse } from '../utils/safeParse';
import { getStorageRawValue, normalizeStorageList } from '../utils/storage-helpers';
import { withAdminGuard } from './admin_auth';
import { logAudit } from './audit';
import { recoverFailedStageSettlementForUser } from './gear_system';
import {
  STAGE_SETTLEMENT_COLLECTION,
  SettlementState,
  StageSettlement,
  SettlementEffect,
  SettlementEffectStatus,
  readStageSettlement,
} from './stage_settlement';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

/** Settled settlements are retained for 30 days, then eligible for cleanup. */
export const STAGE_SETTLEMENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const LIST_RPC_ID = 'armored_archer/admin_list_failed_stage_settlements';
const SETTLE_RPC_ID = 'armored_archer/admin_settle_stage_settlement';
const CLEANUP_RPC_ID = 'armored_archer/admin_cleanup_stage_settlements';

/** Bounded cross-owner scan: 10 pages of 100 rows per invocation. */
const SCAN_PAGE_SIZE = 100;
const SCAN_MAX_PAGES = 10;

interface AdminFailedSettlement {
  user_id: string;
  stage_id: string;
  attempt_id?: string;
  state: SettlementState;
  effects: Record<SettlementEffect, SettlementEffectStatus>;
  intended_xp?: number;
  claimed_at: number;
  updated_at: number;
}

/** Parse one raw storage row into a settlement; null when malformed. */
function parseSettlementRow(rawValue: unknown): StageSettlement | null {
  try {
    const parsed = JSON.parse(getStorageRawValue(rawValue) ?? '') as StageSettlement;
    if (!parsed || typeof parsed !== 'object' || !parsed.effects || !parsed.stage_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** One bounded cross-owner page scan of the settlement collection. */
function scanSettlements(
  nk: Runtime.Nakama,
  cursor: string
): { rows: Runtime.StorageObject[]; cursor: string; truncated: boolean } {
  const result = nk.storageList(undefined, STAGE_SETTLEMENT_COLLECTION, SCAN_PAGE_SIZE, cursor);
  const nextCursor = (result as { cursor?: string }).cursor;
  return {
    rows: normalizeStorageList(result),
    cursor: nextCursor && nextCursor !== cursor ? nextCursor : '',
    truncated: !!nextCursor && nextCursor !== cursor,
  };
}

/** RPC handler shape shared by the Stage 4 admin endpoints. */
type StageSettlementAdminRpc = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string;

/** Shared validate-or-respond prologue for the admin handlers. */
function validateOrRespond<T>(
  schema: Parameters<typeof validatePayload>[0],
  payload: string,
  rpcName: string
): { data: T } | { response: string } {
  const validation = validatePayload(schema, payload, rpcName);
  if (!validation.success) {
    return { response: createValidationErrorResponse(rpcName, validation.error) };
  }
  return { data: validation.data as T };
}

/**
 * Lists every player's failed settlements (newest first) - the support queue.
 */
export const rpcAdminListFailedStageSettlements: StageSettlementAdminRpc = (
  ctx,
  logger,
  nk,
  payload
) => {
  const checked = validateOrRespond<{ limit?: number; cursor?: string } | undefined>(
    ZodSchemas.admin_list_failed_stage_settlements,
    payload,
    'admin_list_failed_stage_settlements'
  );
  if ('response' in checked) return checked.response;
  const request = checked.data ?? {};
  const limit = request.limit ?? 50;
  let cursor = request.cursor ?? '';

  try {
    const failed: AdminFailedSettlement[] = [];
    let truncated = false;
    for (let page = 0; page < SCAN_MAX_PAGES; page++) {
      const pageCursor = cursor;
      const scan = scanSettlements(nk, pageCursor);
      for (const row of scan.rows) {
        if (failed.length >= limit) break;
        const parsed = parseSettlementRow(row.value);
        if (!parsed || parsed.state !== 'failed') continue;
        failed.push({
          user_id: row.userId,
          stage_id: parsed.stage_id,
          attempt_id: parsed.attempt_id,
          state: parsed.state,
          effects: parsed.effects,
          intended_xp: parsed.intended_xp,
          claimed_at: parsed.claimed_at,
          updated_at: parsed.updated_at,
        });
      }
      if (failed.length >= limit) {
        // Stopped mid-page: re-scan this page next call so no failed row is skipped.
        cursor = pageCursor;
        truncated = true;
        break;
      }
      cursor = scan.cursor;
      truncated = scan.truncated;
      if (!scan.truncated) break;
    }
    failed.sort((a, b) => b.updated_at - a.updated_at);
    return JSON.stringify({
      success: true,
      settlements: failed,
      cursor: truncated ? cursor : '',
      truncated,
    });
  } catch (error) {
    logger.error('admin_list_failed_stage_settlements failed: %v', error);
    return createErrorResponse('DATABASE_ERROR', 'Failed to list failed stage settlements');
  }
};

/**
 * Manually re-drives one failed settlement by user id + stage id, granting
 * its recorded intended loot/XP exactly once (original grant IDs, OCC-gated).
 */
export const rpcAdminSettleStageSettlement: StageSettlementAdminRpc = (
  ctx,
  logger,
  nk,
  payload
) => {
  const checked = validateOrRespond<{ user_id: string; stage_id: string }>(
    ZodSchemas.admin_settle_stage_settlement,
    payload,
    'admin_settle_stage_settlement'
  );
  if ('response' in checked) return checked.response;
  const request = checked.data;

  const settlement = readStageSettlement(nk, request.user_id, request.stage_id);
  if (!settlement) {
    return createErrorResponse('NOT_FOUND', 'No stage settlement found for that user and stage');
  }
  if (settlement.state !== 'failed') {
    return createErrorResponse(
      'INVALID_STATE',
      `Settlement is ${settlement.state}, not failed - nothing to settle`
    );
  }

  try {
    const outcome = recoverFailedStageSettlementForUser(
      nk,
      ctx,
      logger,
      request.user_id,
      request.stage_id
    );
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'admin',
      'stage_settlement_manual_settle',
      {
        target_user_id: request.user_id,
        stage_id: request.stage_id,
        attempt_id: settlement.attempt_id,
        recovered: outcome.recovered,
        loot_recovered: outcome.loot_recovered,
        xp_recovered: outcome.xp_recovered,
      },
      outcome.recovered ? 'success' : 'failure',
      outcome.recovered
        ? 'Operator manually settled a failed stage settlement'
        : 'Manual settle found a failed settlement but nothing was recoverable'
    );
    return JSON.stringify({
      success: true,
      user_id: request.user_id,
      stage_id: request.stage_id,
      recovered: outcome.recovered,
      loot_recovered: outcome.loot_recovered,
      xp_recovered: outcome.xp_recovered,
    });
  } catch (error) {
    logger.error('admin_settle_stage_settlement failed: %v', error);
    return createErrorResponse('DATABASE_ERROR', 'Failed to settle the stage settlement');
  }
};

/**
 * Retention sweep: deletes settled settlements older than the retention
 * window (default 30 days). Failed settlements never expire; pending rows
 * are left alone. Bounded to one bounded scan per call - re-invoke with the
 * returned cursor while truncated is true.
 */
export const rpcAdminCleanupStageSettlements: StageSettlementAdminRpc = (
  ctx,
  logger,
  nk,
  payload
) => {
  const checked = validateOrRespond<{ older_than_ms?: number } | undefined>(
    ZodSchemas.admin_cleanup_stage_settlements,
    payload,
    'admin_cleanup_stage_settlements'
  );
  if ('response' in checked) return checked.response;
  const request = checked.data ?? {};
  const retentionMs = request.older_than_ms ?? STAGE_SETTLEMENT_RETENTION_MS;
  const cutoff = Date.now() - retentionMs;

  let scanned = 0;
  let deleted = 0;
  let cursor = '';
  let truncated = false;
  try {
    for (let page = 0; page < SCAN_MAX_PAGES; page++) {
      const scan = scanSettlements(nk, cursor);
      scanned += scan.rows.length;
      for (const row of scan.rows) {
        const parsed = parseSettlementRow(row.value);
        if (!parsed) continue;
        if (parsed.state !== 'settled' || parsed.updated_at >= cutoff) continue;
        nk.storageDelete([
          { collection: STAGE_SETTLEMENT_COLLECTION, key: row.key, userId: row.userId },
        ]);
        deleted++;
      }
      cursor = scan.cursor;
      truncated = scan.truncated;
      if (!scan.truncated) break;
    }
  } catch (error) {
    logger.error('admin_cleanup_stage_settlements failed: %v', error);
    return createErrorResponse('DATABASE_ERROR', 'Stage settlement cleanup failed');
  }

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'admin',
    'stage_settlement_cleanup',
    { scanned, deleted, retention_ms: retentionMs, cutoff, truncated },
    'success',
    'Stage settlement retention sweep (settled rows older than the retention window)'
  );
  return JSON.stringify({
    success: true,
    scanned,
    deleted,
    cutoff,
    cursor: truncated ? cursor : '',
    truncated,
  });
};

/**
 * Registers the Stage 4 admin endpoints behind the shared admin guard.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerStageSettlementAdminEndpoints(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    LIST_RPC_ID,
    withAdminGuard(LIST_RPC_ID, rpcAdminListFailedStageSettlements)
  );
  initializer.registerRpc(
    SETTLE_RPC_ID,
    withAdminGuard(SETTLE_RPC_ID, rpcAdminSettleStageSettlement)
  );
  initializer.registerRpc(
    CLEANUP_RPC_ID,
    withAdminGuard(CLEANUP_RPC_ID, rpcAdminCleanupStageSettlements)
  );
}
