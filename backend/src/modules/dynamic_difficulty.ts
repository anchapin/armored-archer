/**
 * Dynamic Difficulty Module
 * @fileoverview Manages dynamic difficulty adjustment based on player performance.
 */

import { enum as enumType } from 'valibot';
import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { safeParse } from '../utils/safeParse';
import { logAudit } from './audit';
import { registerRpcWithMetrics } from './metrics';
import {
  validatePayload,
  createValidationErrorResponse,
  number,
  string,
  boolean,
  pipe,
  minValue,
  maxValue,
  minLength,
} from './validation';

// Type assertion helper for enum schemas
function createEnum<T extends string>(values: readonly T[]): ReturnType<typeof enumType> {
  return enumType(values as any);
}

/**
 * Difficulty level definitions.
 */
export enum DifficultyLevel {
  EASY = 'Easy',
  NORMAL = 'Normal',
  HARD = 'Hard',
  EXTREME = 'Extreme',
}

/**
 * Difficulty modifier bounds.
 */
const MAX_MODIFIER = 0.2;
const MIN_MODIFIER = -0.2;

/**
 * Streak thresholds for difficulty adjustment.
 */
const WIN_STREAK_THRESHOLD = 3;
const LOSE_STREAK_THRESHOLD = 3;

/**
 * Player performance tracking data.
 */
export interface PlayerPerformance {
  player_id: string;
  match_history: MatchEntry[];
  win_streak: number;
  lose_streak: number;
  current_modifier: number;
  last_updated: number;
}

/**
 * Individual match entry for tracking.
 */
export interface MatchEntry {
  match_id: string;
  won: boolean;
  match_type: 'pve' | 'pvp';
  timestamp: number;
  base_difficulty: number;
}

/**
 * Difficulty state persisted per player.
 */
export interface DifficultyState {
  player_id: string;
  current_modifier: number;
  win_streak: number;
  lose_streak: number;
  updated_at: number;
}

/**
 * Sync difficulty request.
 */
export interface SyncDifficultyRequest {
  difficulty_modifier: number;
  difficulty_level: string;
}

/**
 * Match outcome tracking request.
 */
export interface TrackMatchOutcomeRequest {
  match_id: string;
  won: boolean;
  match_type: 'pve' | 'pvp';
  duration: number;
}

/**
 * Player performance response.
 */
export interface PlayerPerformanceResponse {
  win_rate: number;
  win_streak: number;
  lose_streak: number;
  current_modifier: number;
  difficulty_level: string;
  performance_rating: string;
  matches_tracked: number;
}

/**
 * Registers the dynamic difficulty RPC endpoints.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcSyncDifficulty(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/sync_difficulty',
    'sync_difficulty',
    rpcSyncDifficulty
  );
}

/**
 * Registers the track match outcome RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcTrackMatchOutcome(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/track_match_outcome',
    'track_match_outcome',
    rpcTrackMatchOutcome
  );
}

/**
 * Registers the get player performance RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetPlayerPerformance(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_player_performance',
    'get_player_performance',
    rpcGetPlayerPerformance
  );
}

/**
 * Handles difficulty sync requests from the client.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing difficulty data
 * @returns JSON string with success status
 *
 * @example
 * // Request payload
 * { "difficulty_modifier": 0.1, "difficulty_level": "Hard" }
 *
 * // Response
 * { "success": true, "synced": true }
 */
export function rpcSyncDifficulty(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Sync difficulty called for user: %s', ctx.userId);

  const validation = validatePayload(
    {
      difficulty_modifier: pipe(number(), minValue(MIN_MODIFIER), maxValue(MAX_MODIFIER)),
      difficulty_level: createEnum([
        DifficultyLevel.EASY,
        DifficultyLevel.NORMAL,
        DifficultyLevel.HARD,
        DifficultyLevel.EXTREME,
      ]),
    },
    payload,
    'sync_difficulty'
  );

  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'sync_difficulty',
      'difficulty_state',
      { modifier: 'unknown', level: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('sync_difficulty', validation.error);
  }

  const request = validation.data;

  // Validate modifier matches level
  const expectedModifier = getModifierForLevel(request.difficulty_level);
  const modifierDiff = Math.abs(request.difficulty_modifier - expectedModifier);

  if (modifierDiff > 0.05) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'sync_difficulty',
      'difficulty_state',
      { modifier: request.difficulty_modifier, level: request.difficulty_level },
      'failure',
      'Modifier does not match difficulty level'
    );
    return JSON.stringify({
      error: 'Modifier does not match difficulty level',
    });
  }

  // Store difficulty state
  const state: DifficultyState = {
    player_id: ctx.userId,
    current_modifier: request.difficulty_modifier,
    win_streak: 0,
    lose_streak: 0,
    updated_at: Math.floor(Date.now() / 1000),
  };

  nk.storageWrite([
    {
      collection: 'difficulty_state',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(state),
    },
  ]);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'sync_difficulty',
    'difficulty_state',
    { modifier: request.difficulty_modifier, level: request.difficulty_level },
    'success'
  );

  return JSON.stringify({
    success: true,
    synced: true,
  });
}

/**
 * Handles match outcome tracking for difficulty adjustment.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match outcome data
 * @returns JSON string with updated difficulty state
 *
 * @example
 * // Request payload
 * { "match_id": "uuid", "won": true, "match_type": "pve", "duration": 120 }
 *
 * // Response
 * { "success": true, "modifier": 0.1, "difficulty_level": "Hard" }
 */
export function rpcTrackMatchOutcome(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Track match outcome called for user: %s', ctx.userId);

  const validation = validatePayload(
    {
      match_id: pipe(string(), minLength(1)),
      won: boolean(),
      match_type: createEnum(['pve', 'pvp']),
      duration: pipe(number(), minValue(0)),
    },
    payload,
    'track_match_outcome'
  );

  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'track_match_outcome',
      'match_outcome',
      { match_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('track_match_outcome', validation.error);
  }

  const request = validation.data;

  // Load current difficulty state
  const stateResult = loadDifficultyState(nk, ctx.userId);
  const state = stateResult.success
    ? stateResult.data!
    : {
        player_id: ctx.userId,
        current_modifier: 0.0,
        win_streak: 0,
        lose_streak: 0,
        updated_at: 0,
      };

  // Update streaks
  if (request.won) {
    state.win_streak += 1;
    state.lose_streak = 0;
  } else {
    state.lose_streak += 1;
    state.win_streak = 0;
  }

  // Check for difficulty adjustment
  let adjustmentNeeded = false;

  if (state.win_streak >= WIN_STREAK_THRESHOLD) {
    const oldModifier = state.current_modifier;
    state.current_modifier = Math.min(state.current_modifier + 0.1, MAX_MODIFIER);
    state.win_streak = 0; // Reset after adjustment
    if (state.current_modifier !== oldModifier) {
      adjustmentNeeded = true;
    }
  }

  if (state.lose_streak >= LOSE_STREAK_THRESHOLD) {
    const oldModifier = state.current_modifier;
    state.current_modifier = Math.max(state.current_modifier - 0.1, MIN_MODIFIER);
    state.lose_streak = 0; // Reset after adjustment
    if (state.current_modifier !== oldModifier) {
      adjustmentNeeded = true;
    }
  }

  state.updated_at = Math.floor(Date.now() / 1000);

  // Save updated state
  nk.storageWrite([
    {
      collection: 'difficulty_state',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(state),
    },
  ]);

  // Track match outcome in storage for analytics
  const matchEntry: MatchEntry = {
    match_id: request.match_id,
    won: request.won,
    match_type: request.match_type,
    timestamp: Math.floor(Date.now() / 1000),
    base_difficulty: state.current_modifier,
  };

  const historyResult = loadMatchHistory(nk, ctx.userId);
  const history = historyResult.success ? historyResult.data! : [];
  history.push(matchEntry);

  // Keep only last 100 matches
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }

  nk.storageWrite([
    {
      collection: 'match_history',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(history),
    },
  ]);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'track_match_outcome',
    'match_outcome',
    {
      match_id: request.match_id,
      won: request.won,
      modifier: state.current_modifier,
    },
    'success'
  );

  return JSON.stringify({
    success: true,
    modifier: state.current_modifier,
    difficulty_level: getDifficultyLevel(state.current_modifier),
    win_streak: state.win_streak,
    lose_streak: state.lose_streak,
    adjusted: adjustmentNeeded,
  });
}

/**
 * Handles get player performance requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused)
 * @returns JSON string with performance metrics
 *
 * @example
 * // Response
 * {
 *   "win_rate": 0.75,
 *   "win_streak": 2,
 *   "lose_streak": 0,
 *   "current_modifier": 0.1,
 *   "difficulty_level": "Hard",
 *   "performance_rating": "Good",
 *   "matches_tracked": 20
 * }
 */
export function rpcGetPlayerPerformance(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  _payload: string
): string {
  logger.info('Get player performance called for user: %s', ctx.userId);

  const stateResult = loadDifficultyState(nk, ctx.userId);
  const state = stateResult.success
    ? stateResult.data!
    : {
        player_id: ctx.userId,
        current_modifier: 0.0,
        win_streak: 0,
        lose_streak: 0,
        updated_at: 0,
      };

  const historyResult = loadMatchHistory(nk, ctx.userId);
  const history = historyResult.success ? historyResult.data! : [];

  // Calculate win rate from recent matches
  const recentMatches = history.slice(-10);
  const wins = recentMatches.filter((m) => m.won).length;
  const winRate = recentMatches.length > 0 ? wins / recentMatches.length : 0.0;

  // Calculate performance rating
  const performanceRating = calculatePerformanceRating(
    winRate,
    state.win_streak,
    state.lose_streak
  );

  return JSON.stringify({
    win_rate: winRate,
    win_streak: state.win_streak,
    lose_streak: state.lose_streak,
    current_modifier: state.current_modifier,
    difficulty_level: getDifficultyLevel(state.current_modifier),
    performance_rating: performanceRating,
    matches_tracked: history.length,
  });
}

/**
 * Calculates performance rating based on win rate and streaks.
 */
function calculatePerformanceRating(
  winRate: number,
  _winStreak: number,
  _loseStreak: number
): string {
  if (winRate >= 0.8) {
    return 'Excellent';
  } else if (winRate >= 0.6) {
    return 'Good';
  } else if (winRate >= 0.4) {
    return 'Average';
  } else {
    return 'Poor';
  }
}

/**
 * Gets the difficulty level string for a modifier value.
 */
function getDifficultyLevel(modifier: number): string {
  if (modifier <= MIN_MODIFIER + 0.01) {
    return DifficultyLevel.EASY;
  } else if (modifier <= 0.01) {
    return DifficultyLevel.NORMAL;
  } else if (modifier <= 0.11) {
    return DifficultyLevel.HARD;
  } else {
    return DifficultyLevel.EXTREME;
  }
}

/**
 * Gets the modifier value for a difficulty level.
 */
function getModifierForLevel(level: string): number {
  switch (level) {
    case DifficultyLevel.EASY:
      return MIN_MODIFIER;
    case DifficultyLevel.NORMAL:
      return 0.0;
    case DifficultyLevel.HARD:
      return 0.1;
    case DifficultyLevel.EXTREME:
      return MAX_MODIFIER;
    default:
      return 0.0;
  }
}

/**
 * Loads difficulty state from storage.
 */
function loadDifficultyState(
  nk: Runtime.Nakama,
  userId: string
): { success: boolean; data?: DifficultyState } {
  const objects = nk.storageRead([
    {
      collection: 'difficulty_state',
      key: userId,
      userId: userId,
    },
  ]);

  if (objects.length === 0) {
    return { success: false };
  }

  const value = objects[0].value;
  if (!value) {
    return { success: false };
  }

  const parseResult = safeParse<DifficultyState>(value, null, logger, 'difficulty_state');
  if (!parseResult.success || !parseResult.data) {
    return { success: false };
  }

  return { success: true, data: parseResult.data };
}

/**
 * Loads match history from storage.
 */
function loadMatchHistory(
  nk: Runtime.Nakama,
  userId: string
): { success: boolean; data?: MatchEntry[] } {
  const objects = nk.storageRead([
    {
      collection: 'match_history',
      key: userId,
      userId: userId,
    },
  ]);

  if (objects.length === 0) {
    return { success: true, data: [] };
  }

  const value = objects[0].value;
  if (!value) {
    return { success: true, data: [] };
  }

  // Create a dummy logger for safeParse
  const dummyLogger = {
    info: (_message: string, ..._args: any[]) => {},
    warn: (_message: string, ..._args: any[]) => {},
    error: (_message: string, ..._args: any[]) => {},
  };

  const parseResult = safeParse<MatchEntry[]>(value, null, dummyLogger as any, 'match_history');
  if (!parseResult.success || !parseResult.data) {
    return { success: true, data: [] };
  }

  return { success: true, data: parseResult.data };
}
