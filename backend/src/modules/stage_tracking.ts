/**
 * Stage Tracking module.
 * @fileoverview Manages PvE stage completion tracking for player progression.
 * Uses Nakama's storage system for data persistence.
 */

import { Runtime } from '../types/nakama';
import { logAudit } from './audit';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

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
 * Request payload for completing a stage.
 */
export interface CompleteStageRequest {
  stage_id: string;
  stage_prefix: string;
  stars_earned: number;
  score: number;
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
 * Response for stage completion.
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
  if (!ctx.userId) {
    logger.warn('complete_stage attempted without authentication');
    return JSON.stringify({
      success: false,
      error: 'Authentication required',
      error_code: 'UNAUTHORIZED',
    });
  }

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
  const { stage_id, stage_prefix, stars_earned, score } = request;

  logger.info(
    'Processing stage completion: user=%s stage=%s stars=%d score=%d',
    ctx.userId,
    stage_id,
    stars_earned,
    score
  );

  try {
    // Read existing stage completions from storage
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

    let isNewCompletion = true;
    let previousBest: { stars_earned: number; score: number } | undefined;

    // Parse existing data if it exists
    if (storageObjects.length > 0 && storageObjects[0].value) {
      try {
        storageData = JSON.parse(storageObjects[0].value) as StageCompletionStorage;
      } catch (e) {
        logger.warn('Failed to parse stage completion storage, creating new: %s', String(e));
      }
    }

    // Check for existing completion of this stage
    const existingCompletion = storageData.completions[stage_id];

    if (existingCompletion) {
      isNewCompletion = false;
      previousBest = {
        stars_earned: existingCompletion.stars_earned,
        score: existingCompletion.score,
      };

      // Only update if new completion is better (more stars or same stars with higher score)
      if (
        !isBetterCompletion(
          stars_earned,
          score,
          existingCompletion.stars_earned,
          existingCompletion.score
        )
      ) {
        logger.info(
          'Stage replay did not improve: stage=%s new_stars=%d existing_stars=%d new_score=%d existing_score=%d',
          stage_id,
          stars_earned,
          existingCompletion.stars_earned,
          score,
          existingCompletion.score
        );

        return JSON.stringify({
          success: true,
          stage_id,
          stars_earned: existingCompletion.stars_earned,
          score: existingCompletion.score,
          is_new_completion: false,
          previous_best: previousBest,
          message: 'No improvement over previous completion',
        });
      }

      // Update existing completion
      storageData.completions[stage_id] = updateCompletionRecord(
        stage_id,
        stage_prefix,
        stars_earned,
        score,
        existingCompletion
      );

      logger.info(
        'Updated stage completion: stage=%s stars=%d score=%d',
        stage_id,
        stars_earned,
        score
      );
    } else {
      // Create new completion
      storageData.completions[stage_id] = createCompletionRecord(
        stage_id,
        stage_prefix,
        stars_earned,
        score
      );

      logger.info(
        'Created new stage completion: stage=%s stars=%d score=%d',
        stage_id,
        stars_earned,
        score
      );
    }

    // Write updated completions to storage
    nk.storageWrite([
      {
        collection: STAGE_COMPLETION_COLLECTION,
        key: ctx.userId,
        userId: ctx.userId,
        value: JSON.stringify(storageData),
      },
    ]);

    // Log audit event
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'complete_stage',
      'stage_completion',
      { stage_id, stage_prefix, stars_earned, score },
      isNewCompletion ? 'success' : 'success',
      isNewCompletion ? 'New completion' : 'Updated completion'
    );

    const response: StageCompletionResponse = {
      success: true,
      stage_id,
      stars_earned,
      score,
      is_new_completion: isNewCompletion,
    };

    if (previousBest) {
      response.previous_best = previousBest;
    }

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
