/**
 * Stage Progression module.
 * @fileoverview Owns PvE stage-progression persistence shared by the
 * consolidated stage-completion RPC (`stage_complete` in gear_system.ts)
 * and the campaign read RPCs (stage_tracking.ts).
 *
 * Holds two storage concerns, extracted in issue #1069:
 * - Best-of completion records (`stage_completion` collection): per-stage
 *   stars/score high-water marks, versioned on write.
 * - The claim-first dedup marker (`stage_completion_claims` collection):
 *   written BEFORE any loot/XP/stars are granted so a retry (or a request
 *   replayed after a mid-sequence failure) no-ops instead of double-granting.
 *
 * This module deliberately imports nothing from gear_system/stage_tracking
 * so both can depend on it without a module cycle.
 */

import { Runtime } from '../types/nakama';
import { MAX_STAGE_SCORE } from './validation';

/**
 * Stage completion record stored per user.
 */
export interface StageCompletion {
  id: string;
  user_id: string;
  stage_id: string;
  stage_prefix: string;
  stars_earned: number;
  score: number;
  completed_at: string;
  updated_at: string;
}

/**
 * Storage record for stage completions (stored per user, keyed by stage).
 */
export interface StageCompletionStorage {
  user_id: string;
  completions: Record<
    string,
    {
      stage_id: string;
      stage_prefix: string;
      stars_earned: number;
      score: number;
      completed_at: string;
      updated_at: string;
    }
  >;
}

/**
 * Storage record type (without id and user_id).
 */
export type StageCompletionRecord = {
  stage_id: string;
  stage_prefix: string;
  stars_earned: number;
  score: number;
  completed_at: string;
  updated_at: string;
};

/**
 * Storage collection names for stage progression persistence.
 */
export const STAGE_COMPLETION_COLLECTION = 'stage_completion';
export const STAGE_COMPLETION_CLAIM_COLLECTION = 'stage_completion_claims';

/**
 * Cooldown window during which a replayed stage completion is rejected as a
 * duplicate. Claim-first ordering (issue #1069) means the claim is written
 * before rewards are granted, so any retry inside this window no-ops rather
 * than re-rolling loot or XP.
 */
export const STAGE_COMPLETION_CLAIM_COOLDOWN_MS = 300000; // 5 minutes

/**
 * Clamps client-claimed completion values (issue #1068 defense-in-depth).
 *
 * The valibot schema already rejects out-of-range payloads; these clamps
 * bound what is persisted even if the schema is loosened later.
 *
 * @param starsEarned - Client-claimed star count
 * @param score - Client-claimed score
 * @returns The clamped stars/score values to persist and echo
 */
export function clampCompletionClaims(
  starsEarned: number,
  score: number
): { safeStars: number; safeScore: number } {
  return {
    safeStars: Math.min(3, Math.max(0, starsEarned)),
    safeScore: Math.min(MAX_STAGE_SCORE, Math.max(0, score)),
  };
}

/**
 * Checks the claim marker for a stage completion.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param stageId - ID of the completed stage
 * @param logger - Nakama logger instance
 * @returns Error response string if a fresh claim exists, or the claim's
 *          current storage version for the versioned claim write
 */
export function checkStageCompletionClaim(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  logger: Runtime.Logger
): { error?: string; claimVersion?: string } {
  const claimKey = `${userId}:${stageId}`;
  let existingClaims: { value?: string; version?: string; collection?: string }[] = [];
  try {
    existingClaims = nk.storageRead([
      { collection: STAGE_COMPLETION_CLAIM_COLLECTION, key: claimKey, userId },
    ]);
  } catch {
    // Storage error during dedup check - proceed with completion
  }
  if (existingClaims.length > 0 && existingClaims[0].value) {
    try {
      const claim = JSON.parse(existingClaims[0].value);
      if (claim && claim.claimed_at) {
        const timeSinceClaim = Date.now() - claim.claimed_at;
        if (timeSinceClaim < STAGE_COMPLETION_CLAIM_COOLDOWN_MS) {
          logger.warn('Duplicate stage completion rejected for user %s stage %s', userId, stageId);
          return {
            error: JSON.stringify({
              success: false,
              error: 'Stage completion already processed',
              error_code: 'DUPLICATE_COMPLETION',
              retry_after_ms: STAGE_COMPLETION_CLAIM_COOLDOWN_MS - timeSinceClaim,
            }),
          };
        }
      }
    } catch {
      // Corrupted claim data - allow the completion to proceed
    }
  }
  const claimVersion =
    existingClaims.length > 0 &&
    existingClaims[0].collection === STAGE_COMPLETION_CLAIM_COLLECTION &&
    existingClaims[0].version
      ? existingClaims[0].version
      : undefined;
  return { claimVersion };
}

/**
 * Writes the claim marker for a stage completion (versioned, OCC-checked).
 *
 * Issue #1069 claim-first atomicity: callers must invoke this BEFORE
 * granting any loot/XP/stars. If a later write in the sequence fails, the
 * claim persists and a retry is rejected as a duplicate for the cooldown
 * window, so rewards can never be double-granted.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param stageId - ID of the completed stage
 * @param claimVersion - Version read by `checkStageCompletionClaim`, if any
 */
export function writeStageCompletionClaim(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  claimVersion?: string
): void {
  nk.storageWrite([
    {
      collection: STAGE_COMPLETION_CLAIM_COLLECTION,
      key: `${userId}:${stageId}`,
      userId,
      value: JSON.stringify({ claimed_at: Date.now(), stage_id: stageId }),
      version: claimVersion,
    },
  ]);
}

/**
 * Reads and parses the per-user stage completion storage object.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Nakama logger instance
 * @returns The parsed storage data plus the object's current storage version
 */
export function readStageCompletionStorage(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger
): { data: StageCompletionStorage; version?: string } {
  const storageObjects = nk.storageRead([
    {
      collection: STAGE_COMPLETION_COLLECTION,
      key: userId,
      userId,
    },
  ]);

  let storageData: StageCompletionStorage = {
    user_id: userId,
    completions: {},
  };
  let version: string | undefined;

  if (storageObjects.length > 0 && storageObjects[0].value) {
    version = storageObjects[0].version;
    try {
      const parsed = JSON.parse(storageObjects[0].value) as StageCompletionStorage;
      // Shape guard: a value that is not a completions map (corrupt or
      // foreign payload) must not crash the completion path — start fresh.
      if (parsed && typeof parsed === 'object' && parsed.completions) {
        storageData = parsed;
      } else {
        logger.warn('Stage completion storage has an unexpected shape, creating new');
      }
    } catch (e) {
      logger.warn('Failed to parse stage completion storage, creating new: %s', String(e));
    }
  }

  return { data: storageData, version };
}

/**
 * Determines if new completion is better than existing one.
 */
function isBetterCompletion(
  newStars: number,
  newScore: number,
  existingStars: number,
  existingScore: number
): boolean {
  return newStars > existingStars || (newStars === existingStars && newScore > existingScore);
}

/**
 * Creates a new completion record.
 */
function createCompletionRecord(
  stageId: string,
  stagePrefix: string,
  starsEarned: number,
  score: number
): StageCompletionRecord {
  const now = new Date().toISOString();
  return {
    stage_id: stageId,
    stage_prefix: stagePrefix,
    stars_earned: starsEarned,
    score,
    completed_at: now,
    updated_at: now,
  };
}

/**
 * Updates an existing completion record, preserving the original
 * completion date.
 */
function updateCompletionRecord(
  stageId: string,
  stagePrefix: string,
  starsEarned: number,
  score: number,
  existingCompletion: StageCompletionRecord
): StageCompletionRecord {
  return {
    ...existingCompletion,
    stage_id: stageId,
    stage_prefix: stagePrefix,
    stars_earned: starsEarned,
    score,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Result of applying a stage completion to storage.
 */
export interface StageCompletionResult {
  isNewCompletion: boolean;
  noImprovement: boolean;
  previousBest: { stars_earned: number; score: number } | undefined;
  existingCompletion: StageCompletionRecord | undefined;
}

/**
 * Applies a (clamped) completion to the best-of record storage.
 *
 * Allows stage replay: only updates the stored record when the new
 * completion improves on the existing stars/score. The write is versioned
 * (OCC) against the version observed on read.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param stageId - ID of the completed stage
 * @param stagePrefix - Campaign prefix of the stage
 * @param starsEarned - Clamped star count to record
 * @param score - Clamped score to record
 * @param logger - Nakama logger instance
 * @returns Whether this was new/improved/no-improvement plus previous best
 */
export function applyStageCompletion(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  stagePrefix: string,
  starsEarned: number,
  score: number,
  logger: Runtime.Logger
): StageCompletionResult {
  const { data: storageData, version } = readStageCompletionStorage(nk, userId, logger);

  const existingCompletion = storageData.completions[stageId];
  const result: StageCompletionResult = {
    isNewCompletion: true,
    noImprovement: false,
    previousBest: undefined,
    existingCompletion: undefined,
  };

  if (existingCompletion) {
    result.isNewCompletion = false;
    result.previousBest = {
      stars_earned: existingCompletion.stars_earned,
      score: existingCompletion.score,
    };

    // Only update if new completion is better
    if (
      !isBetterCompletion(
        starsEarned,
        score,
        existingCompletion.stars_earned,
        existingCompletion.score
      )
    ) {
      logger.info(
        'Stage replay did not improve: stage=%s new_stars=%d existing_stars=%d new_score=%d existing_score=%d',
        stageId,
        starsEarned,
        existingCompletion.stars_earned,
        score,
        existingCompletion.score
      );

      result.noImprovement = true;
      result.existingCompletion = existingCompletion;
      return result;
    }

    storageData.completions[stageId] = updateCompletionRecord(
      stageId,
      stagePrefix,
      starsEarned,
      score,
      existingCompletion
    );

    logger.info(
      'Updated stage completion: stage=%s stars=%d score=%d',
      stageId,
      starsEarned,
      score
    );
  } else {
    storageData.completions[stageId] = createCompletionRecord(
      stageId,
      stagePrefix,
      starsEarned,
      score
    );

    logger.info(
      'Created new stage completion: stage=%s stars=%d score=%d',
      stageId,
      starsEarned,
      score
    );
  }

  // Write updated completions to storage (versioned for concurrency safety)
  nk.storageWrite([
    {
      collection: STAGE_COMPLETION_COLLECTION,
      key: userId,
      userId,
      value: JSON.stringify(storageData),
      version,
    },
  ]);

  return result;
}
