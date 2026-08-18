/**
 * Stage Tracking module (read side).
 * @fileoverview Read RPCs for PvE campaign progression: completed stages
 * and derived campaign progress. All progression WRITES were consolidated
 * into the single `armored_archer/stage_complete` RPC (gear_system.ts) in
 * issue #1069; the persistence layer itself lives in stage_progression.ts.
 */

import { Runtime } from '../types/nakama';
import { getDefeatedBossesFromDB } from './gear_db';
import { readStageCompletionStorage } from './stage_progression';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

/**
 * Request payload for getting all stage completions.
 */
export interface GetAllStageCompletionsRequest {
  stage_prefix?: string;
}

/**
 * DECOMMISSIONED (issue #1069): `armored_archer/complete_stage`
 * (`rpcCompleteStage` + `registerRpcCompleteStage`) was removed.
 *
 * It duplicated `armored_archer/stage_complete` and had no production
 * client caller (RPC_MAP.md wrongly attributed CampaignManager to it — the
 * real call is `stage_complete` from autoloads/CampaignManager.gd). Its
 * unique capabilities were migrated into the survivor:
 * - stars/score best-of persistence → `stage_progression.applyStageCompletion`
 *   (invoked by `rpcStageComplete`, clamps preserved from issue #1068)
 * - loot processing → the survivor's DB-backed path (insertGearItem /
 *   gear_db.ts). The orphaned `player_inventory` Nakama-storage write was
 *   deleted; loot now persists through the same layer the inventory read
 *   path (`getFullInventoryFromDB`) uses.
 *
 * Migration note for API consumers: send `stage_complete` payloads with
 * optional `stars_earned` / `score` / `stage_prefix` fields; the response
 * now echoes `stars_earned`, `score`, `is_new_completion` and
 * `previous_best`. Historic `stage_completion` storage records remain
 * readable unchanged via `get_completed_stages` / `get_campaign_progress`.
 * No SQL migration is required — no schema changed.
 */

/**
 * Registers the get_completed_stages RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetCompletedStages(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_completed_stages', rpcGetCompletedStages);
}

/**
 * Registers the get_campaign_progress RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetCampaignProgress(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_campaign_progress', rpcGetCampaignProgress);
}

/**
 * Handles requests to get completed stages for a player.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing optional filters
 * @returns JSON string with completed stages
 */
export function rpcGetCompletedStages(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get completed stages called for user: %s', ctx.userId);

  // Validate authentication
  if (!ctx.userId) {
    logger.warn('get_completed_stages attempted without authentication');
    return JSON.stringify({
      success: false,
      error: 'Authentication required',
      error_code: 'UNAUTHORIZED',
    });
  }

  // Handle empty payload - return all completions
  let request: GetAllStageCompletionsRequest = {};
  if (payload && payload.trim()) {
    const validation = validatePayload(
      ZodSchemas.get_all_stage_completions,
      payload,
      'get_completed_stages'
    );
    if (!validation.success) {
      return createValidationErrorResponse('get_completed_stages', validation.error);
    }
    request = validation.data as GetAllStageCompletionsRequest;
  }

  try {
    // Read stage completions from storage
    const { data: storageData } = readStageCompletionStorage(nk, ctx.userId, logger);

    // Filter completions by prefix if specified
    let completions = Object.values(storageData.completions);

    if (request.stage_prefix) {
      completions = completions.filter((c) => c.stage_prefix === request.stage_prefix);
    }

    // Sort by completion date (most recent first)
    completions.sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );

    logger.info(
      'Retrieved %d completed stages for user: %s (filter: %s)',
      completions.length,
      ctx.userId,
      request.stage_prefix || 'none'
    );

    return JSON.stringify({
      success: true,
      stages: completions.map((c) => ({
        stage_id: c.stage_id,
        stage_prefix: c.stage_prefix,
        stars_earned: c.stars_earned,
        score: c.score,
        completed_at: c.completed_at,
      })),
      count: completions.length,
    });
  } catch (error) {
    logger.error('Error retrieving completed stages: %s', String(error));

    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve completed stages',
      error_code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Derives the next stage ID in sequence.
 * e.g., "1_1" -> "1_2", "2_3" -> "2_4"
 */
function deriveNextStageId(stageId: string): string | null {
  const parts = stageId.split('_');
  if (parts.length !== 2) return null;
  const chapter = parts[0];
  const stageNum = parseInt(parts[1], 10);
  if (isNaN(stageNum)) return null;
  return `${chapter}_${stageNum + 1}`;
}

/**
 * Derives unlocked chapters from completed stages.
 * Chapter unlock requirements:
 * - chapter_1: default (always unlocked)
 * - chapter_2: requires completing 1_4
 * - chapter_3: requires completing 2_4
 */
function deriveUnlockedChapters(completedStages: string[]): string[] {
  const unlockedChapters: string[] = [];
  const chapterUnlockRequirements: Record<string, { type: string; requiredStage: string }> = {
    chapter_1: { type: 'default', requiredStage: '' },
    chapter_2: { type: 'chapter_completion', requiredStage: '1_4' },
    chapter_3: { type: 'chapter_completion', requiredStage: '2_4' },
  };

  for (const [chapterId, req] of Object.entries(chapterUnlockRequirements)) {
    if (req.type === 'default') {
      // Default chapters are always unlocked
      unlockedChapters.push(chapterId);
    } else if (req.type === 'chapter_completion') {
      // Unlock if required stage is completed
      if (completedStages.includes(req.requiredStage)) {
        unlockedChapters.push(chapterId);
      }
    }
  }

  return unlockedChapters;
}

/**
 * Handles requests to get campaign progress for a player.
 * Returns completed stages, unlocked stages, and defeated bosses.
 *
 * Boss defeats are read from the `boss_defeats` table (the same DB layer
 * `stage_complete` writes through since issue #1069). The legacy read of
 * the orphaned `player_inventory` storage collection was removed with that
 * consolidation — it could only ever see data written by the decommissioned
 * duplicate RPC's orphaned loot path.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (empty or unused)
 * @returns JSON string with campaign progress
 */
export function rpcGetCampaignProgress(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  _payload: string
): string {
  logger.info('Get campaign progress called for user: %s', ctx.userId);

  // Validate authentication
  if (!ctx.userId) {
    logger.warn('get_campaign_progress attempted without authentication');
    return JSON.stringify({
      success: false,
      error: 'Authentication required',
      error_code: 'UNAUTHORIZED',
    });
  }

  try {
    // Read stage completions from storage
    const { data: storageData } = readStageCompletionStorage(nk, ctx.userId, logger);

    // Build completed_stages array from completion keys
    const completedStages = Object.keys(storageData.completions);

    // Derive unlocked_stages: for each completed stage, the next stage is unlocked
    const unlockedSet = new Set<string>();
    for (const stageId of completedStages) {
      const nextStage = deriveNextStageId(stageId);
      if (nextStage) {
        unlockedSet.add(nextStage);
      }
    }
    // Always ensure first stage is available
    unlockedSet.add('1_1');
    const unlockedStages = Array.from(unlockedSet);

    // Read bosses defeated from the database (written by stage_complete's
    // recordBossDefeat path)
    const bossesDefeated = getDefeatedBossesFromDB(nk, ctx.userId);

    // Derive unlocked chapters from completed stages
    const unlockedChapters = deriveUnlockedChapters(completedStages);

    logger.info(
      'Campaign progress for user %s: completed=%d, unlocked=%d, bosses=%d, chapters=%d',
      ctx.userId,
      completedStages.length,
      unlockedStages.length,
      bossesDefeated.length,
      unlockedChapters.length
    );

    return JSON.stringify({
      success: true,
      completed_stages: completedStages,
      unlocked_stages: unlockedStages,
      bosses_defeated: bossesDefeated,
      unlocked_chapters: unlockedChapters,
    });
  } catch (error) {
    logger.error('Error retrieving campaign progress: %s', String(error));

    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve campaign progress',
      error_code: 'INTERNAL_ERROR',
    });
  }
}
