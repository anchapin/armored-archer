/**
 * Stage grant idempotency (reward integration contract).
 *
 * Per-effect grant IDs make a retried stage completion resumable instead of
 * a choice between double-granting and losing effects. The claim marker
 * (`stage_completion_claims`) records the attempt; this module records the
 * terminal outcome of an attempt so a replayed request can be answered from
 * the record, and supplies the deterministic grant keys each storage domain
 * enforces on its own:
 * - gear (SQL): `inventory_items.grant_id` unique index, insert-once.
 * - XP (Nakama OCC): `player_stats.applied_stage_grants` written atomically
 *   with the XP mutation.
 *
 * Grant IDs are idempotency keys, not authorization tokens. Trust comes from
 * the server session (and, later, the stage_start challenge), not from the
 * key's secrecy.
 */

import { Runtime } from '../types/nakama';
import { toStorageValue, getStorageRawValue } from '../utils/storage-helpers';

/** Storage collection holding one terminal outcome record per attempt. */
export const STAGE_OUTCOME_COLLECTION = 'stage_completion_outcomes';

/**
 * Derives the deterministic grant ID for one effect of one attempt.
 * Effect kinds: 'gear:0', 'gear:1', 'xp', 'coins'.
 */
export function makeStageGrantId(
  userId: string,
  stageId: string,
  attemptId: string,
  effectKind: string
): string {
  return `${userId}:${stageId}:${attemptId}:${effectKind}`;
}

/**
 * Terminal outcome of a stage-completion attempt, stored once the attempt
 * completes so a replayed request (same attempt_id) is answered from the
 * record without re-applying any effect.
 */
export interface StageCompletionOutcome {
  user_id: string;
  stage_id: string;
  attempt_id: string;
  completed_at: string;
  response: Record<string, unknown>;
}

function outcomeKey(stageId: string, attemptId: string): string {
  return `${stageId}:${attemptId}`;
}

/**
 * Reads the recorded outcome for an attempt.
 *
 * Fails closed: a storage error throws, so the caller returns INTERNAL_ERROR
 * and the client retries, rather than risking a duplicate grant on a
 * misread "no outcome".
 */
export function readStageOutcome(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  attemptId: string
): { outcome?: StageCompletionOutcome; version?: string } {
  const [stored] = nk.storageRead([
    {
      collection: STAGE_OUTCOME_COLLECTION,
      key: outcomeKey(stageId, attemptId),
      userId,
    },
  ]);
  if (!stored || !stored.value) return {};
  return {
    outcome: JSON.parse(getStorageRawValue(stored.value) ?? '') as StageCompletionOutcome,
    version: stored.version,
  };
}

/**
 * Writes the terminal outcome record for an attempt (versioned OCC).
 */
export function writeStageOutcome(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  attemptId: string,
  response: Record<string, unknown>,
  version?: string
): void {
  const outcome: StageCompletionOutcome = {
    user_id: userId,
    stage_id: stageId,
    attempt_id: attemptId,
    completed_at: new Date().toISOString(),
    response,
  };
  nk.storageWrite([
    {
      collection: STAGE_OUTCOME_COLLECTION,
      key: outcomeKey(stageId, attemptId),
      userId,
      value: toStorageValue(outcome),
      version: version ?? '*',
    },
  ]);
}
