/**
 * Encounter Pacing Module
 * @fileoverview Manages encounter pacing tracking and analytics for fatigue prevention.
 */

import { Runtime } from '../types/nakama';
import { safeParse, createErrorResponse } from '../utils/safeParse';
import { logAudit } from './audit';
import { registerRpcWithMetrics } from './metrics';
import { validatePayload, createValidationErrorResponse } from './validation';
import {
  object,
  number,
  string,
  array,
  pipe,
  minValue,
  maxValue,
} from 'valibot';

/**
 * Content type enum for encounters.
 */
export enum ContentType {
  COMBAT = 'combat',
  EXPLORATION = 'exploration',
  NARRATIVE = 'narrative',
  PUZZLE = 'puzzle',
}

/**
 * Pacing metrics tracking data.
 */
export interface PacingMetrics {
  total_encounters: number;
  recent_encounters: number;
  combat_count: number;
  exploration_count: number;
  narrative_count: number;
  puzzle_count: number;
  combat_ratio: number;
  exploration_ratio: number;
  narrative_ratio: number;
  puzzle_ratio: number;
  combat_streak: number;
  exploration_streak: number;
  current_fatigue: number;
  fatigue_level: string;
  combat_time_total: number;
}

/**
 * Individual pacing entry for tracking.
 */
export interface PacingEntry {
  player_id: string;
  type: ContentType;
  duration: number;
  timestamp: number;
  intensity: number;
}

/**
 * Pacing state persisted per player.
 */
export interface PacingState {
  player_id: string;
  recent_encounters: PacingEntry[];
  combat_streak: number;
  exploration_streak: number;
  current_fatigue: number;
  session_encounters: number;
  combat_time_accumulated: number;
  updated_at: number;
}

/**
 * Log encounter pacing request.
 */
export interface LogEncounterPacingRequest {
  total_encounters: number;
  recent_encounters: number;
  combat_count: number;
  exploration_count: number;
  narrative_count: number;
  puzzle_count: number;
  combat_ratio: number;
  exploration_ratio: number;
  narrative_ratio: number;
  puzzle_ratio: number;
  combat_streak: number;
  exploration_streak: number;
  current_fatigue: number;
  fatigue_level: string;
  combat_time_total: number;
}

/**
 * Pacing report response.
 */
export interface PacingReportResponse {
  player_id: string;
  metrics: PacingMetrics;
  recommendations: PacingRecommendation;
  pacing_score: number;
}

/**
 * Pacing recommendation data.
 */
export interface PacingRecommendation {
  should_break: boolean;
  break_duration: number;
  suggested_next_type: ContentType;
  reason: string;
}

// Pacing targets
const TARGET_COMBAT_RATIO = 0.60;
const TARGET_EXPLORATION_RATIO = 0.20;
const TARGET_NARRATIVE_RATIO = 0.20;
const MAX_COMBAT_STREAK = 5;
const MIN_EXPLORATION_STREAK = 3;
const FATIGUE_THRESHOLD_HIGH = 70;
const FATIGUE_THRESHOLD_CRITICAL = 85;

/**
 * Registers the log encounter pacing RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcLogEncounterPacing(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/log_encounter_pacing',
    'log_encounter_pacing',
    rpcLogEncounterPacing
  );
}

/**
 * Registers the get pacing report RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetPacingReport(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_pacing_report',
    'get_pacing_report',
    rpcGetPacingReport
  );
}

/**
 * Handles encounter pacing logging requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing pacing metrics
 * @returns JSON string with success status
 */
export function rpcLogEncounterPacing(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Log encounter pacing called for user: %s', ctx.userId);

  const validation = validatePayload(
    {
      total_encounters: pipe(number(), minValue(0)),
      recent_encounters: pipe(number(), minValue(0)),
      combat_count: pipe(number(), minValue(0)),
      exploration_count: pipe(number(), minValue(0)),
      narrative_count: pipe(number(), minValue(0)),
      puzzle_count: pipe(number(), minValue(0)),
      combat_ratio: pipe(number(), minValue(0), maxValue(1)),
      exploration_ratio: pipe(number(), minValue(0), maxValue(1)),
      narrative_ratio: pipe(number(), minValue(0), maxValue(1)),
      puzzle_ratio: pipe(number(), minValue(0), maxValue(1)),
      combat_streak: pipe(number(), minValue(0)),
      exploration_streak: pipe(number(), minValue(0)),
      current_fatigue: pipe(number(), minValue(0), maxValue(100)),
      fatigue_level: string(),
      combat_time_total: pipe(number(), minValue(0)),
    },
    payload,
    'log_encounter_pacing'
  );

  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'log_encounter_pacing',
      'pacing_metrics',
      { metrics: 'invalid' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('log_encounter_pacing', validation.error);
  }

  const request = validation.data;

  // Create pacing entry
  const pacingEntry: PacingEntry = {
    player_id: ctx.userId,
    type: ContentType.COMBAT, // Default type for now
    duration: 0,
    timestamp: Math.floor(Date.now() / 1000),
    intensity: 0,
  };

  // Load current pacing state
  const stateResult = loadPacingState(nk, ctx.userId);
  const state = stateResult.success ? stateResult.data! : createDefaultPacingState(ctx.userId);

  // Update state with new metrics
  state.session_encounters = request.total_encounters;
  state.combat_streak = request.combat_streak;
  state.exploration_streak = request.exploration_streak;
  state.current_fatigue = request.current_fatigue;
  state.combat_time_accumulated = request.combat_time_total;
  state.updated_at = Math.floor(Date.now() / 1000);

  // Add entry to recent encounters
  state.recent_encounters.push(pacingEntry);

  // Keep only last 10 encounters
  if (state.recent_encounters.length > 10) {
    state.recent_encounters.splice(0, state.recent_encounters.length - 10);
  }

  // Save updated state
  nk.storageWrite([
    {
      collection: 'pacing_state',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(state),
    },
  ]);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'log_encounter_pacing',
    'pacing_metrics',
    { fatigue: request.current_fatigue, combat_streak: request.combat_streak },
    'success'
  );

  return JSON.stringify({
    success: true,
    logged: true,
  });
}

/**
 * Handles get pacing report requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused)
 * @returns JSON string with pacing analytics
 */
export function rpcGetPacingReport(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get pacing report called for user: %s', ctx.userId);

  // Load pacing state
  const stateResult = loadPacingState(nk, ctx.userId);
  const state = stateResult.success ? stateResult.data! : createDefaultPacingState(ctx.userId);

  // Calculate metrics
  const metrics = calculateMetrics(state);

  // Generate recommendations
  const recommendations = generateRecommendations(metrics);

  // Calculate pacing score
  const pacingScore = calculatePacingScore(metrics);

  const response: PacingReportResponse = {
    player_id: ctx.userId,
    metrics,
    recommendations,
    pacing_score: pacingScore,
  };

  return JSON.stringify(response);
}

/**
 * Calculates pacing metrics from pacing state.
 */
function calculateMetrics(state: PacingState): PacingMetrics {
  const combatCount = state.recent_encounters.filter(e => e.type === ContentType.COMBAT).length;
  const explorationCount = state.recent_encounters.filter(e => e.type === ContentType.EXPLORATION).length;
  const narrativeCount = state.recent_encounters.filter(e => e.type === ContentType.NARRATIVE).length;
  const puzzleCount = state.recent_encounters.filter(e => e.type === ContentType.PUZZLE).length;
  const total = state.recent_encounters.length;

  return {
    total_encounters: state.session_encounters,
    recent_encounters: total,
    combat_count: combatCount,
    exploration_count: explorationCount,
    narrative_count: narrativeCount,
    puzzle_count: puzzleCount,
    combat_ratio: total > 0 ? combatCount / total : 0,
    exploration_ratio: total > 0 ? explorationCount / total : 0,
    narrative_ratio: total > 0 ? narrativeCount / total : 0,
    puzzle_ratio: total > 0 ? puzzleCount / total : 0,
    combat_streak: state.combat_streak,
    exploration_streak: state.exploration_streak,
    current_fatigue: state.current_fatigue,
    fatigue_level: getFatigueLevelString(state.current_fatigue),
    combat_time_total: state.combat_time_accumulated,
  };
}

/**
 * Generates pacing recommendations based on metrics.
 */
function generateRecommendations(metrics: PacingMetrics): PacingRecommendation {
  const recommendation: PacingRecommendation = {
    should_break: false,
    break_duration: 0,
    suggested_next_type: ContentType.COMBAT,
    reason: '',
  };

  // Check fatigue
  if (metrics.current_fatigue >= FATIGUE_THRESHOLD_CRITICAL) {
    recommendation.should_break = true;
    recommendation.break_duration = 300; // 5 minutes
    recommendation.suggested_next_type = ContentType.NARRATIVE;
    recommendation.reason = 'Critical fatigue detected';
  } else if (metrics.current_fatigue >= FATIGUE_THRESHOLD_HIGH) {
    recommendation.should_break = true;
    recommendation.break_duration = 120; // 2 minutes
    recommendation.suggested_next_type = ContentType.EXPLORATION;
    recommendation.reason = 'High fatigue detected';
  }

  // Check combat streak
  if (metrics.combat_streak > MAX_COMBAT_STREAK) {
    recommendation.should_break = true;
    recommendation.suggested_next_type = ContentType.EXPLORATION;
    recommendation.reason = 'Combat streak too long';
  }

  // Check exploration streak
  if (metrics.exploration_streak >= MIN_EXPLORATION_STREAK) {
    recommendation.suggested_next_type = ContentType.COMBAT;
    if (!recommendation.should_break) {
      recommendation.reason = 'Enough exploration, ready for combat';
    }
  }

  // Check pacing ratios
  if (metrics.combat_ratio > TARGET_COMBAT_RATIO) {
    recommendation.suggested_next_type = ContentType.EXPLORATION;
  } else if (metrics.exploration_ratio > TARGET_EXPLORATION_RATIO) {
    recommendation.suggested_next_type = ContentType.COMBAT;
  }

  return recommendation;
}

/**
 * Calculates overall pacing score (0-100).
 */
function calculatePacingScore(metrics: PacingMetrics): number {
  let score = 100;

  // Deduct for combat streak violations
  if (metrics.combat_streak > MAX_COMBAT_STREAK) {
    score -= (metrics.combat_streak - MAX_COMBAT_STREAK) * 10;
  }

  // Deduct for fatigue
  score -= metrics.current_fatigue * 0.3;

  // Deduct for ratio deviations
  const combatRatioDiff = Math.abs(metrics.combat_ratio - TARGET_COMBAT_RATIO);
  score -= combatRatioDiff * 30;

  const explorationRatioDiff = Math.abs(metrics.exploration_ratio - TARGET_EXPLORATION_RATIO);
  score -= explorationRatioDiff * 15;

  const narrativeRatioDiff = Math.abs(metrics.narrative_ratio - TARGET_NARRATIVE_RATIO);
  score -= narrativeRatioDiff * 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Gets fatigue level as a string.
 */
function getFatigueLevelString(fatigue: number): string {
  if (fatigue >= FATIGUE_THRESHOLD_CRITICAL) {
    return 'Critical';
  } else if (fatigue >= FATIGUE_THRESHOLD_HIGH) {
    return 'High';
  } else if (fatigue >= 50.0) {
    return 'Medium';
  } else if (fatigue >= 25.0) {
    return 'Low';
  } else {
    return 'None';
  }
}

/**
 * Creates a default pacing state for a new player.
 */
function createDefaultPacingState(playerId: string): PacingState {
  return {
    player_id: playerId,
    recent_encounters: [],
    combat_streak: 0,
    exploration_streak: 0,
    current_fatigue: 0.0,
    session_encounters: 0,
    combat_time_accumulated: 0.0,
    updated_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Loads pacing state from storage.
 */
function loadPacingState(
  nk: Runtime.Nakama,
  userId: string
): { success: boolean; data?: PacingState } {
  const objects = nk.storageRead([
    {
      collection: 'pacing_state',
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

  const parseResult = safeParse<PacingState>(value, null, logger, 'pacing_state');
  if (!parseResult.success || !parseResult.data) {
    return { success: false };
  }

  return { success: true, data: parseResult.data };
}

// Dummy logger for compatibility
const logger = {
  info: (_message: string, ..._args: any[]) => {},
  warn: (_message: string, ..._args: any[]) => {},
  error: (_message: string, ..._args: any[]) => {},
  debug: (_message: string, ..._args: any[]) => {},
};
