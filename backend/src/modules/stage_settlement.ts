/**
 * Stage completion settlement journal (issue #1558, Stage 1).
 *
 * Design: docs/STAGE_SETTLEMENT_RECOVERY.md. A settlement row is written
 * atomically with the stage-completion claim (one storageWrite batch), so
 * there is no window where a claim exists without its settlement. Stage 1
 * is record-only: it journals the request snapshot, each reward effect's
 * status, and the intended loot as it is rolled. No completion behavior
 * changes in this stage — every journal write is best-effort and a journal
 * failure never fails the completion path. Gating effects on settlement
 * state, exactly-once XP, and the recovery entry points arrive in Stages
 * 2-4.
 *
 * Key choice (deviation from the design doc, recorded in the PR): the
 * settlement shares the claim's `${userId}:${stageId}` key instead of a
 * per-attempt key, so its lifecycle matches the claim exactly (overwritten
 * after cooldown). Per-attempt history lives in the audit log.
 */
import { Runtime } from '../types/nakama';
import { toStorageValue, getStorageRawValue, normalizeStorageList } from '../utils/storage-helpers';
import { buildStageCompletionClaimWrite } from './stage_progression';

export const STAGE_SETTLEMENT_COLLECTION = 'stage_settlements';

export type SettlementEffect = 'best_of' | 'boss_defeat' | 'modifier_pool' | 'loot' | 'xp';
export type SettlementEffectStatus = 'pending' | 'settled' | 'failed';
export type SettlementState = 'pending' | 'settled' | 'failed';

export interface StageSettlementRequest {
  difficulty?: string;
  stars_earned: number;
  score: number;
  boss_defeated?: boolean;
  enemy_type?: string;
  challenge_id?: string;
}

/** Recorded when the loot roll happens; recovery never rerolls. */
export interface IntendedLoot {
  gear: unknown;
  grant_id?: string;
  drop_rate: number;
  roll: number;
}

export interface StageSettlement {
  stage_id: string;
  attempt_id?: string;
  claimed_at: number;
  request: StageSettlementRequest;
  intended_loot?: IntendedLoot;
  /** XP amount owed to the attempt; recorded before the gated grant (#1558 Stage 3). */
  intended_xp?: number;
  effects: Record<SettlementEffect, SettlementEffectStatus>;
  state: SettlementState;
  updated_at: number;
}

export function settlementKey(userId: string, stageId: string): string {
  return `${userId}:${stageId}`;
}

function freshEffects(): Record<SettlementEffect, SettlementEffectStatus> {
  return {
    best_of: 'pending',
    boss_defeat: 'pending',
    modifier_pool: 'pending',
    loot: 'pending',
    xp: 'pending',
  };
}

export function computeSettlementState(
  effects: Record<SettlementEffect, SettlementEffectStatus>
): SettlementState {
  const statuses = Object.values(effects);
  if (statuses.every((s) => s === 'settled')) return 'settled';
  if (statuses.some((s) => s === 'failed')) return 'failed';
  return 'pending';
}

export function buildStageSettlement(
  stageId: string,
  attemptId: string | undefined,
  request: StageSettlementRequest
): StageSettlement {
  const now = Date.now();
  return {
    stage_id: stageId,
    attempt_id: attemptId,
    claimed_at: now,
    request,
    effects: freshEffects(),
    state: 'pending',
    updated_at: now,
  };
}

/**
 * Writes the claim marker and the settlement row in ONE storageWrite batch
 * (atomic: both land or neither does). Replaces the lone claim write on the
 * completion path; the claim object is byte-identical to the previous
 * writeStageCompletionClaim payload.
 */
export function writeClaimAndSettlement(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  claimVersion: string | undefined,
  attemptId: string | undefined,
  settlement: StageSettlement
): void {
  nk.storageWrite([
    buildStageCompletionClaimWrite(userId, stageId, claimVersion, attemptId),
    {
      collection: STAGE_SETTLEMENT_COLLECTION,
      key: settlementKey(userId, stageId),
      userId,
      value: toStorageValue(settlement),
      // Unconditional (version omitted): mirrors the claim's post-cooldown
      // overwrite. Nakama '*' means create-only-if-absent, which would
      // reject this write on every post-cooldown replay.
    },
  ]);
}

interface SettlementRow {
  settlement: StageSettlement;
  version?: string;
}

/** Reads the settlement with its OCC version, or undefined when absent/corrupt. */
function readSettlementRow(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string
): SettlementRow | undefined {
  let objects: Runtime.StorageObject[] = [];
  try {
    objects = nk.storageRead([
      { collection: STAGE_SETTLEMENT_COLLECTION, key: settlementKey(userId, stageId), userId },
    ]);
  } catch {
    return undefined;
  }
  if (objects.length === 0 || !objects[0].value) return undefined;
  try {
    const parsed = JSON.parse(getStorageRawValue(objects[0].value) ?? '') as StageSettlement;
    if (!parsed || typeof parsed !== 'object' || !parsed.effects) return undefined;
    return { settlement: parsed, version: objects[0].version };
  } catch {
    return undefined;
  }
}

/** Writes the settlement at the given OCC version (undefined = unconditional). */
function writeSettlementRow(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  settlement: StageSettlement,
  version?: string
): void {
  nk.storageWrite([
    {
      collection: STAGE_SETTLEMENT_COLLECTION,
      key: settlementKey(userId, stageId),
      userId,
      value: toStorageValue(settlement),
      version,
    },
  ]);
}

/** Reads the settlement for a user+stage, or undefined when absent/corrupt. */
export function readStageSettlement(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string
): StageSettlement | undefined {
  return readSettlementRow(nk, userId, stageId)?.settlement;
}

/**
 * Best-effort settlement update: applies `mutate` to the current row and
 * writes it back, recomputing state. Journaling NEVER breaks the completion
 * path — any failure is logged and swallowed.
 */
function updateSettlement(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  logger: Runtime.Logger,
  mutate: (s: StageSettlement) => void
): void {
  try {
    // OCC with the just-read version: a conflicting update is dropped
    // (warned below) rather than clobbering a concurrent effect journal.
    const row = readSettlementRow(nk, userId, stageId);
    if (!row) return;
    mutate(row.settlement);
    row.settlement.state = computeSettlementState(row.settlement.effects);
    row.settlement.updated_at = Date.now();
    writeSettlementRow(nk, userId, stageId, row.settlement, row.version);
  } catch (e) {
    logger.warn(
      'Settlement journal update failed for user %s stage %s: %s',
      userId,
      stageId,
      String(e)
    );
  }
}

const TRANSITION_MAX_ATTEMPTS = 3;

/**
 * #1558 Stage 2 - single-winner effect transition, OCC-checked. Only the
 * caller that moves the effect from pending|failed to `to` gets true; a row
 * already at `to`, missing, or corrupt yields false, so an effect gated on
 * this transition is applied exactly once. settled is terminal: a settled
 * effect never transitions again. Retries version conflicts a bounded
 * number of times, then fails closed (false) with a warning.
 */
function transitionEffect(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  effect: SettlementEffect,
  to: 'settled' | 'failed',
  logger: Runtime.Logger,
  allowFrom: (from: SettlementEffectStatus) => boolean
): boolean {
  for (let attempt = 1; attempt <= TRANSITION_MAX_ATTEMPTS; attempt++) {
    const row = readSettlementRow(nk, userId, stageId);
    if (!row) return false;
    if (!allowFrom(row.settlement.effects[effect])) return false;
    row.settlement.effects[effect] = to;
    row.settlement.state = computeSettlementState(row.settlement.effects);
    row.settlement.updated_at = Date.now();
    try {
      writeSettlementRow(nk, userId, stageId, row.settlement, row.version);
      return true;
    } catch (e) {
      if (attempt === TRANSITION_MAX_ATTEMPTS) {
        logger.warn(
          'Settlement transition failed for user %s stage %s effect %s: %s',
          userId,
          stageId,
          effect,
          String(e)
        );
        return false;
      }
    }
  }
  return false;
}

type EffectTransitionFn = (
  runtime: Runtime.Nakama,
  playerId: string,
  stage: string,
  which: SettlementEffect,
  target: 'settled' | 'failed',
  log: Runtime.Logger
) => boolean;

export const tryTransitionEffect: EffectTransitionFn = (nk, userId, stageId, effect, to, logger) =>
  transitionEffect(
    nk,
    userId,
    stageId,
    effect,
    to,
    logger,
    (from) => from !== to && from !== 'settled'
  );

/**
 * Rolls a settled effect marker back to failed when the grant that followed
 * the winning transition did not land (#1558 Stage 3). The grant itself is
 * idempotent under its original grant ID, so a later retry grants exactly
 * once; the rollback only re-opens the journal. Returns false when the
 * effect is no longer settled (already rolled back or re-settled).
 */
export const rollbackEffectToFailed: (
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  effect: SettlementEffect,
  logger: Runtime.Logger
) => boolean = (nk, userId, stageId, effect, logger) =>
  transitionEffect(nk, userId, stageId, effect, 'failed', logger, (from) => from === 'settled');

/** Journals a reward effect's outcome (settled/failed). Best-effort. */
export function markSettlementEffect(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  effect: SettlementEffect,
  status: SettlementEffectStatus,
  logger: Runtime.Logger
): void {
  updateSettlement(nk, userId, stageId, logger, (s) => {
    s.effects[effect] = status;
  });
}

/** Journals the XP amount owed to the attempt, recorded before the grant. Best-effort. */
export function recordIntendedXp(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  intendedXp: number,
  logger: Runtime.Logger
): void {
  updateSettlement(nk, userId, stageId, logger, (s) => {
    s.intended_xp = intendedXp;
  });
}

/** Journals the rolled loot (gear, grant id, drop rate, roll). Best-effort. */
export function recordIntendedLoot(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  intended: IntendedLoot,
  logger: Runtime.Logger
): void {
  updateSettlement(nk, userId, stageId, logger, (s) => {
    s.intended_loot = intended;
  });
}

/** Sanitized settlement entry returned by get_stage_settlements (#1558 Stage 3). */
export interface StageSettlementSummary {
  stage_id: string;
  attempt_id?: string;
  state: SettlementState;
  effects: Record<SettlementEffect, SettlementEffectStatus>;
  intended_loot?: { name?: string; rarity?: string; type?: string };
  intended_xp?: number;
  claimed_at: number;
  updated_at: number;
}

/**
 * Lists the player's settlement journal rows (newest first), sanitized for
 * the client: no request snapshot, no full gear payload - just the item
 * summary a "reward recovered" surface needs.
 */
export function listStageSettlements(
  nk: Runtime.Nakama,
  userId: string,
  limit: number
): { settlements: StageSettlementSummary[] } {
  const rows = normalizeStorageList(nk.storageList(userId, STAGE_SETTLEMENT_COLLECTION, limit, ''));
  const settlements: StageSettlementSummary[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(getStorageRawValue(row.value) ?? '') as StageSettlement;
      if (!parsed || typeof parsed !== 'object' || !parsed.effects) continue;
      const gear = parsed.intended_loot?.gear as
        { name?: string; rarity?: string; type?: string } | undefined;
      settlements.push({
        stage_id: parsed.stage_id,
        attempt_id: parsed.attempt_id,
        state: parsed.state,
        effects: parsed.effects,
        intended_loot: gear ? { name: gear.name, rarity: gear.rarity, type: gear.type } : undefined,
        intended_xp: parsed.intended_xp,
        claimed_at: parsed.claimed_at,
        updated_at: parsed.updated_at,
      });
    } catch {
      continue;
    }
  }
  settlements.sort((a, b) => b.updated_at - a.updated_at);
  return { settlements };
}
