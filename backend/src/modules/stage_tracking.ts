/**
 * Stage Tracking module.
 * @fileoverview Manages PvE stage completion tracking for player progression.
 * Uses Nakama's storage system for data persistence.
 */

import { Runtime } from '../types/nakama';
import { logAudit } from './audit';
import {
  generateGearItem,
  calculateDropRate,
  GearItem,
  getModifiersUnlockedByBoss,
  getPlayerInventory,
  resolveVerifiedDifficulty,
} from './gear_system';
import { checkRateLimit } from './rate_limit';
import {
  validatePayload,
  ZodSchemas,
  createValidationErrorResponse,
  MAX_STAGE_SCORE,
} from './validation';

/**
 * Stage completion record stored in database.
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
 * Storage record for stage completions (stored per user).
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
 * Request payload for completing a stage (with optional loot generation).
 */
export interface CompleteStageRequest {
  stage_id: string;
  stage_prefix: string;
  stars_earned: number;
  score: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'nightmare';
  boss_defeated?: boolean;
  boss_id?: string;
}

/**
 * Loot result from stage completion.
 */
export interface LootResult {
  dropped: boolean;
  gear: GearItem | null;
}

/**
 * Request payload for getting completed stages.
 */
export interface GetStageCompletionRequest {
  stage_id: string;
}

/**
 * Request payload for getting all stage completions.
 */
export interface GetAllStageCompletionsRequest {
  stage_prefix?: string;
}

/**
 * Response for stage completion (with optional loot).
 */
export interface StageCompletionResponse {
  success: boolean;
  stage_id: string;
  stars_earned: number;
  score: number;
  is_new_completion: boolean;
  previous_best?: {
    stars_earned: number;
    score: number;
  };
  loot?: LootResult;
  drop_rate?: number;
  unlocked_modifier_pools?: string[];
}

/**
 * Storage collection name for stage completions.
 */
const STAGE_COMPLETION_COLLECTION = 'stage_completion';

/**
 * Registers the complete_stage RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcCompleteStage(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/complete_stage', rpcCompleteStage);
}

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
 * Determines if new completion is better than existing one
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
 * Creates a new completion record
 */
function createCompletionRecord(
  stageId: string,
  stagePrefix: string,
  starsEarned: number,
  score: number
): StageCompletion {
  const now = new Date().toISOString();
  return {
    id: '',
    user_id: '',
    stage_id: stageId,
    stage_prefix: stagePrefix,
    stars_earned: starsEarned,
    score,
    completed_at: now,
    updated_at: now,
  };
}

/**
 * Storage record type (without id and user_id)
 */
type StageCompletionRecord = {
  stage_id: string;
  stage_prefix: string;
  stars_earned: number;
  score: number;
  completed_at: string;
  updated_at: string;
};

/**
 * Updates an existing completion record
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

const STAGE_DEDUP_COOLDOWN_MS = 300000; // 5 minutes

function checkStageDedup(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  logger: Runtime.Logger
): { error?: string; claimVersion?: string } {
  const claimKey = `${userId}:${stageId}`;
  let existingClaims: { value?: string; version?: string; collection?: string }[] = [];
  try {
    existingClaims = nk.storageRead([
      { collection: 'stage_completion_claims', key: claimKey, userId },
    ]);
  } catch {
    // Storage error during dedup check - proceed with completion
  }
  if (existingClaims.length > 0 && existingClaims[0].value) {
    try {
      const claim = JSON.parse(existingClaims[0].value);
      if (claim && claim.claimed_at) {
        const timeSinceClaim = Date.now() - claim.claimed_at;
        if (timeSinceClaim < STAGE_DEDUP_COOLDOWN_MS) {
          logger.warn('Duplicate stage completion rejected for user %s stage %s', userId, stageId);
          return {
            error: JSON.stringify({
              success: false,
              error: 'Stage completion already processed',
              error_code: 'DUPLICATE_COMPLETION',
              retry_after_ms: STAGE_DEDUP_COOLDOWN_MS - timeSinceClaim,
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
    existingClaims[0].collection === 'stage_completion_claims' &&
    existingClaims[0].version
      ? existingClaims[0].version
      : undefined;
  return { claimVersion };
}

function validateStageAuth(ctx: Runtime.Context, logger: Runtime.Logger): string | null {
  if (!ctx.userId) {
    logger.warn('complete_stage attempted without authentication');
    return JSON.stringify({
      success: false,
      error: 'Authentication required',
      error_code: 'UNAUTHORIZED',
    });
  }
  return null;
}

/**
 * Sanitizes client-claimed completion inputs (issue #1068).
 *
 * Clamps `stars_earned` to 0-3 and `score` to MAX_STAGE_SCORE (the valibot
 * schema already rejects out-of-range payloads; these clamps are
 * defense-in-depth so persisted completions can never exceed the bounds even
 * if the schema is loosened later), and mutates `request.difficulty` in place
 * to the server-verified tier via `resolveVerifiedDifficulty` before any
 * loot multiplier is applied.
 *
 * @returns The clamped stars/score values to persist and echo.
 */
function sanitizeCompletionClaims(
  logger: Runtime.Logger,
  request: CompleteStageRequest
): { safeStars: number; safeScore: number } {
  const safeStars = Math.min(3, Math.max(0, request.stars_earned));
  const safeScore = Math.min(MAX_STAGE_SCORE, Math.max(0, request.score));
  if (request.difficulty) {
    request.difficulty = resolveVerifiedDifficulty(request.difficulty, logger);
  }
  return { safeStars, safeScore };
}

/**
 * Handles stage completion requests from players.
 * Validates input and records stage completion using Nakama storage.
 * Allows stage replay - only updates if new score is better.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing stage completion data
 * @returns JSON string with completion result
 */
export function rpcCompleteStage(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Complete stage called for user: %s', ctx.userId);

  // Validate authentication
  const authError = validateStageAuth(ctx, logger);
  if (authError) return authError;

  // Validate payload
  const validation = validatePayload(ZodSchemas.complete_stage, payload, 'complete_stage');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'complete_stage',
      'stage_completion',
      { stage_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('complete_stage', validation.error);
  }

  const request = validation.data as CompleteStageRequest;
  const { stage_id, stage_prefix } = request;

  // Issue #1068: clamp client-declared stars/score and verify difficulty
  // server-side before anything is persisted or rewarded.
  const { safeStars, safeScore } = sanitizeCompletionClaims(logger, request);

  // Rate limit check
  const rateLimitCheck = checkRateLimit(ctx.userId, 'stage_complete');
  if (!rateLimitCheck.allowed) {
    logger.warn('Stage complete rate limited for user: %s', ctx.userId);
    return JSON.stringify({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      error_code: 'RATE_LIMITED',
      retry_after_ms: rateLimitCheck.retryAfter,
    });
  }

  // Dedup check: prevent replay of same stage completion within cooldown window
  const dedupResult = checkStageDedup(nk, ctx.userId, stage_id, logger);
  if (dedupResult.error) {
    return dedupResult.error;
  }
  const claimKey = `${ctx.userId}:${stage_id}`;

  logger.info(
    'Processing stage completion: user=%s stage=%s stars=%d score=%d',
    ctx.userId,
    stage_id,
    safeStars,
    safeScore
  );

  try {
    // Read and process stage completion data
    const completionResult = readAndProcessStageCompletion(
      nk,
      ctx.userId,
      stage_id,
      stage_prefix,
      safeStars,
      safeScore,
      logger
    );

    // Handle case where replay didn't improve
    if (completionResult.noImprovement) {
      return JSON.stringify({
        success: true,
        stage_id,
        stars_earned: completionResult.existingCompletion!.stars_earned,
        score: completionResult.existingCompletion!.score,
        is_new_completion: false,
        previous_best: completionResult.previousBest,
        message: 'No improvement over previous completion',
      });
    }

    const isNewCompletion = completionResult.isNewCompletion;
    const previousBest = completionResult.previousBest;

    // Server-side loot generation (only if difficulty is provided)
    const lootResult: LootResult = { dropped: false, gear: null };
    let dropRate = 0;
    let unlockedModifierPools: string[] = [];

    if (request.difficulty) {
      // Process loot generation
      const lootProcessingResult = processStageLoot(nk, ctx.userId, request, stage_id, logger);
      lootResult.dropped = lootProcessingResult.lootResult.dropped;
      lootResult.gear = lootProcessingResult.lootResult.gear;
      dropRate = lootProcessingResult.dropRate;
      unlockedModifierPools = lootProcessingResult.unlockedModifierPools;
    }

    // Log audit event
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'complete_stage',
      'stage_completion',
      { stage_id, stage_prefix, stars_earned: safeStars, score: safeScore },
      isNewCompletion ? 'success' : 'success',
      isNewCompletion ? 'New completion' : 'Updated completion'
    );

    const response: StageCompletionResponse = {
      success: true,
      stage_id,
      stars_earned: safeStars,
      score: safeScore,
      is_new_completion: isNewCompletion,
    };

    if (previousBest) {
      response.previous_best = previousBest;
    }

    // Add loot information if difficulty was provided
    if (request.difficulty) {
      response.loot = lootResult;
      response.drop_rate = dropRate;
      response.unlocked_modifier_pools = unlockedModifierPools;
    }

    // Write dedup claim after successful processing
    nk.storageWrite([
      {
        collection: 'stage_completion_claims',
        key: claimKey,
        userId: ctx.userId,
        value: JSON.stringify({ claimed_at: Date.now(), stage_id }),
        version: dedupResult.claimVersion,
      },
    ]);

    return JSON.stringify(response);
  } catch (error) {
    logger.error('Error processing stage completion: %s', String(error));

    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'complete_stage',
      'stage_completion',
      { stage_id },
      'failure',
      String(error)
    );

    return JSON.stringify({
      success: false,
      error: 'Failed to process stage completion',
      error_code: 'INTERNAL_ERROR',
    });
  }
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
    const storageObjects = nk.storageRead([
      {
        collection: STAGE_COMPLETION_COLLECTION,
        key: ctx.userId,
        userId: ctx.userId,
      },
    ]);

    let storageData: StageCompletionStorage = {
      user_id: ctx.userId,
      completions: {},
    };

    // Parse existing data if it exists
    if (storageObjects.length > 0 && storageObjects[0].value) {
      try {
        storageData = JSON.parse(storageObjects[0].value) as StageCompletionStorage;
      } catch (e) {
        logger.warn('Failed to parse stage completion storage: %s', String(e));
      }
    }

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
    const storageObjects = nk.storageRead([
      {
        collection: STAGE_COMPLETION_COLLECTION,
        key: ctx.userId,
        userId: ctx.userId,
      },
    ]);

    let storageData: StageCompletionStorage = {
      user_id: ctx.userId,
      completions: {},
    };

    // Parse existing data if it exists
    if (storageObjects.length > 0 && storageObjects[0].value) {
      try {
        storageData = JSON.parse(storageObjects[0].value) as StageCompletionStorage;
      } catch (e) {
        logger.warn('Failed to parse stage completion storage: %s', String(e));
      }
    }

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

    // Extract bosses defeated from completions (boss stages typically have boss data)
    // We read from the gear_system inventory for boss defeats
    const bossesDefeated: string[] = [];
    try {
      const inventoryObjects = nk.storageRead([
        {
          collection: 'player_inventory',
          key: ctx.userId,
          userId: ctx.userId,
        },
      ]);
      if (inventoryObjects.length > 0 && inventoryObjects[0].value) {
        const inventory = JSON.parse(inventoryObjects[0].value);
        if (Array.isArray(inventory.unlocked_modifier_pools)) {
          // Modifier pools unlocked by bosses indicate boss defeats
          bossesDefeated.push(...inventory.unlocked_modifier_pools);
        }
      }
    } catch (e) {
      logger.warn('Failed to read boss defeats from inventory: %s', String(e));
    }

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

/**
 * Result of loot processing
 */
interface LootProcessingResult {
  lootResult: { dropped: boolean; gear: GearItem | null };
  dropRate: number;
  unlockedModifierPools: string[];
}

/**
 * Process stage completion loot generation
 */
function processStageLoot(
  nk: Runtime.Nakama,
  userId: string,
  request: CompleteStageRequest,
  stageId: string,
  logger: Runtime.Logger
): LootProcessingResult {
  const lootResult: LootProcessingResult = {
    lootResult: { dropped: false, gear: null },
    dropRate: 0,
    unlockedModifierPools: [],
  };

  // Calculate drop rate server-side
  lootResult.dropRate = calculateDropRate(request.difficulty!, request.boss_defeated || false);
  const roll = Math.random();

  logger.info(
    'Loot roll for user %s: roll=%f, dropRate=%f, difficulty=%s, bossDefeated=%s',
    userId,
    roll,
    lootResult.dropRate,
    request.difficulty,
    request.boss_defeated
  );

  // Get player inventory using helper function
  const inventory = getPlayerInventory(nk, userId, logger);

  // Unlock modifier pools when boss is defeated
  if (request.boss_defeated && request.boss_id) {
    const modifiersToUnlock = getModifiersUnlockedByBoss(request.boss_id);
    for (const modifierId of modifiersToUnlock) {
      if (!inventory.unlocked_modifier_pools.includes(modifierId)) {
        inventory.unlocked_modifier_pools.push(modifierId);
        logger.info(
          'Unlocked modifier pool %s for user %s after defeating boss %s',
          modifierId,
          userId,
          request.boss_id
        );
      }
    }
  }

  lootResult.unlockedModifierPools = inventory.unlocked_modifier_pools;

  // Roll for loot
  if (roll < lootResult.dropRate) {
    const gear = generateGearItem(stageId, inventory.unlocked_modifier_pools, logger);
    inventory.gear.push(gear);

    lootResult.lootResult.dropped = true;
    lootResult.lootResult.gear = gear;

    logger.info('Loot dropped for user %s: %s (%s)', userId, gear.name, gear.rarity);
  }

  // Save inventory with new gear (if any)
  nk.storageWrite([
    {
      collection: 'player_inventory',
      key: userId,
      userId: userId,
      value: JSON.stringify(inventory),
    },
  ]);

  // Audit the loot drop
  logAudit(
    nk,
    userId,
    null,
    'stage_complete_loot',
    'stage_progression',
    {
      stage_id: stageId,
      difficulty: request.difficulty,
      boss_defeated: request.boss_defeated,
      boss_id: request.boss_id ?? null,
      loot_dropped: lootResult.lootResult.dropped,
      loot_gear_id: lootResult.lootResult.gear?.id ?? null,
      loot_gear_rarity: lootResult.lootResult.gear?.rarity ?? null,
      drop_rate_used: lootResult.dropRate,
      roll_value: roll,
    },
    'success'
  );

  return lootResult;
}

/**
 * Result of reading and processing stage completion
 */
interface StageCompletionResult {
  storageData: StageCompletionStorage;
  isNewCompletion: boolean;
  noImprovement: boolean;
  previousBest: { stars_earned: number; score: number } | undefined;
  existingCompletion:
    | {
        stage_id: string;
        stage_prefix: string;
        stars_earned: number;
        score: number;
        completed_at: string;
        updated_at: string;
      }
    | undefined;
}

/**
 * Read and process stage completion data from storage
 */
function readAndProcessStageCompletion(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  stagePrefix: string,
  starsEarned: number,
  score: number,
  logger: Runtime.Logger
): StageCompletionResult {
  // Read existing stage completions from storage
  const storageObjects = nk.storageRead([
    {
      collection: STAGE_COMPLETION_COLLECTION,
      key: userId,
      userId: userId,
    },
  ]);

  let storageData: StageCompletionStorage = {
    user_id: userId,
    completions: {},
  };

  // Parse existing data if it exists
  if (storageObjects.length > 0 && storageObjects[0].value) {
    try {
      storageData = JSON.parse(storageObjects[0].value) as StageCompletionStorage;
    } catch (e) {
      logger.warn('Failed to parse stage completion storage, creating new: %s', String(e));
    }
  }

  // Check for existing completion of this stage
  const existingCompletion = storageData.completions[stageId];
  const result: StageCompletionResult = {
    storageData,
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

    // Update existing completion
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
    // Create new completion
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

  // Write updated completions to storage
  nk.storageWrite([
    {
      collection: STAGE_COMPLETION_COLLECTION,
      key: userId,
      userId: userId,
      value: JSON.stringify(storageData),
    },
  ]);

  return result;
}
