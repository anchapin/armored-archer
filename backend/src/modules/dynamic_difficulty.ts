/**
 * Dynamic Difficulty Module
 * @fileoverview Manages dynamic difficulty adjustment based on player performance.
 */

import { enum as enumType } from 'valibot';
import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { safeParse } from '../utils/safeParse';
import { getStorageRawValue, toStorageValue } from '../utils/storage-helpers';
import { logAudit } from './audit';
import { registerRpcWithMetrics } from './metrics';
import {
  validatePayload,
  createValidationErrorResponse,
  number,
  string,
  boolean,
  object,
  pipe,
  minValue,
  maxValue,
  minLength,
} from './validation';

/**
 * Test context interface that combines Runtime.Context with storage methods for testing.
 */
interface TestContext {
  userId?: string;
  username?: string;
  variables?: { [key: string]: string };
  env?: { [key: string]: string };
  sessionExpiry?: number;
  ipAddress?: string;
  storageRead?: Runtime.Nakama['storageRead'];
  storageWrite?: Runtime.Nakama['storageWrite'];
}

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
 * Maximum number of match history entries retained (server-side ledger).
 */
const MAX_HISTORY_ENTRIES = 100;

/**
 * Storage collection holding the authoritative server-side PvE stage results.
 * Written exclusively by the server-validated `stage_complete` RPC
 * (authentication + rate limiting + per-stage dedup — sole writer since the
 * `complete_stage` consolidation in #1069), so entries in it are trusted
 * evidence of stage wins.
 */
const STAGE_COMPLETION_COLLECTION = 'stage_completion';

/**
 * How long after a server-accepted stage completion a client-reported PvE win
 * may be corroborated by it. Generous enough for out-of-order RPCs within a
 * session, tight enough to require a real completion.
 */
const STAGE_EVIDENCE_WINDOW_MS = 30 * 60 * 1000;

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
 *
 * `seq`, `verified`, and `counted` are assigned by the server when the entry
 * is appended. Entries written before server-side re-derivation (legacy
 * client-trust era) lack these fields and are excluded from streak
 * derivation.
 */
export interface MatchEntry {
  match_id: string;
  won: boolean;
  match_type: 'pve' | 'pvp';
  timestamp: number;
  base_difficulty: number;
  /** Server-assigned monotonic sequence number (ledger ordering). */
  seq?: number;
  /** True when a PvE win was corroborated by server-known stage results. */
  verified?: boolean;
  /** True when this entry counts toward streak derivation. */
  counted?: boolean;
}

/**
 * Difficulty state persisted per player.
 *
 * `win_streak`/`lose_streak` are derived caches recomputed from the
 * server-classified match ledger on every tracked outcome — they are never
 * accumulated from client reports. `last_adjusted_seq` is the ledger cursor
 * marking entries already consumed by a difficulty adjustment, and
 * `corroborated_completions` records which stage completion events have
 * already been used to verify a PvE win (replay resistance).
 */
export interface DifficultyState {
  player_id: string;
  current_modifier: number;
  win_streak: number;
  lose_streak: number;
  updated_at: number;
  /** Ledger cursor: adjustments have been applied through this seq. */
  last_adjusted_seq?: number;
  /** stage_id -> epoch ms of the last completion event used as evidence. */
  corroborated_completions?: Record<string, number>;
  /** Hint recorded from sync_difficulty (never authoritative). */
  client_reported_modifier?: number;
  /** Hint recorded from sync_difficulty (never authoritative). */
  client_reported_level?: string;
}

/**
 * Server-known evidence of a PvE stage win, derived from the authoritative
 * stage completion storage.
 */
interface StageCompletionEvidence {
  stage_id: string;
  /** Epoch ms of the last server-accepted completion for this stage. */
  last_accepted_ms: number;
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
    object({
      difficulty_modifier: pipe(number(), minValue(MIN_MODIFIER), maxValue(MAX_MODIFIER)),
      difficulty_level: createEnum([
        DifficultyLevel.EASY,
        DifficultyLevel.NORMAL,
        DifficultyLevel.HARD,
        DifficultyLevel.EXTREME,
      ]),
    }),
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

  // Validate modifier matches level (hint sanity check)
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

  // Server-authoritative hardening (#870): the client sync is a hint only.
  // It is recorded for disclosure/analytics but never overwrites the
  // server-derived modifier or streaks, which are recomputed from
  // server-known stage results.
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

  state.client_reported_modifier = request.difficulty_modifier;
  state.client_reported_level = request.difficulty_level;
  state.updated_at = Math.floor(Date.now() / 1000);

  nk.storageWrite([
    {
      collection: 'difficulty_state',
      key: ctx.userId,
      userId: ctx.userId,
      value: toStorageValue(state),
    },
  ]);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'sync_difficulty',
    'difficulty_state',
    { modifier: request.difficulty_modifier, level: request.difficulty_level },
    'success',
    'Client hint recorded; server-derived modifier preserved'
  );

  return JSON.stringify({
    success: true,
    synced: true,
    modifier: state.current_modifier,
    difficulty_level: getDifficultyLevel(state.current_modifier),
  });
}

/**
 * Handles match outcome tracking for difficulty adjustment.
 *
 * Server-authoritative (#870): the reported outcome is a hint/trigger, never
 * the streak truth. PvE wins only count when corroborated by server-known
 * stage results (the `stage_completion` storage written by the validated
 * `stage_complete` RPC, the sole writer since #1069); PvE losses are accepted as hints because failed
 * stage attempts produce no server-side signal and losses only ease
 * difficulty (reward-neutral, bounded); PvP outcomes are recorded for
 * analytics but never affect the modifier (PvE-only constraint). Streaks are
 * re-derived from the server-classified ledger on every call.
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
 * { "success": true, "modifier": 0.1, "difficulty_level": "Hard",
 *   "win_streak": 0, "lose_streak": 0, "adjusted": true,
 *   "verified": true, "counted": true }
 */
export function rpcTrackMatchOutcome(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Track match outcome called for user: %s', ctx.userId);

  const validation = validatePayload(
    object({
      match_id: pipe(string(), minLength(1)),
      won: boolean(),
      match_type: createEnum(['pve', 'pvp']),
      duration: pipe(number(), minValue(0)),
    }),
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
  const result = applyTrackedOutcome(nk, ctx.userId, {
    match_id: request.match_id,
    won: request.won,
    match_type: request.match_type,
    duration: request.duration,
  });

  if (request.match_type === 'pve' && request.won && !result.verified) {
    // Disclose that the reported win was not corroborated server-side.
    logger.warn(
      'Unverified PvE win report for user %s (match %s) — recorded as hint only',
      ctx.userId,
      request.match_id
    );
  }

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'track_match_outcome',
    'match_outcome',
    {
      match_id: request.match_id,
      won: request.won,
      modifier: result.state.current_modifier,
      verified: result.verified,
      counted: result.counted,
    },
    'success'
  );

  return JSON.stringify({
    success: true,
    modifier: result.state.current_modifier,
    difficulty_level: getDifficultyLevel(result.state.current_modifier),
    win_streak: result.state.win_streak,
    lose_streak: result.state.lose_streak,
    adjusted: result.adjusted,
    verified: result.verified,
    counted: result.counted,
  });
}

/**
 * Result of applying a tracked outcome through server-side re-derivation.
 */
export interface TrackOutcomeResult {
  state: DifficultyState;
  /** True when a reported PvE win was corroborated by server-known results. */
  verified: boolean;
  /** True when the outcome counted toward streak derivation. */
  counted: boolean;
  /** True when this call changed the difficulty modifier. */
  adjusted: boolean;
}

/**
 * Applies a tracked match outcome using server-authoritative re-derivation.
 *
 * Classification rules:
 * - PvE win: counted only when a server-accepted stage completion
 *   corroborates it (recent + not already consumed). The completion event is
 *   then marked consumed so it cannot verify further reports (replay
 *   resistance). A newer completion of the same stage (server refreshes
 *   `updated_at` only on accepted improvements) can corroborate again.
 * - PvE loss: counted as a hint (no server-side loss signal exists; losses
 *   only ease difficulty, which is reward-neutral and bounded).
 * - PvP: never counted (dynamic difficulty is PvE-only).
 *
 * Streaks are always re-derived from the ledger entries after the adjustment
 * cursor — persisted streak fields are treated as caches, never as truth.
 *
 * @param nk - Nakama server interface
 * @param userId - User the outcome belongs to
 * @param request - Validated outcome report (hint)
 * @returns Resulting state plus verification/adjustment flags
 */
export function applyTrackedOutcome(
  nk: Runtime.Nakama,
  userId: string,
  request: TrackMatchOutcomeRequest
): TrackOutcomeResult {
  const stateResult = loadDifficultyState(nk, userId);
  const state = stateResult.success
    ? stateResult.data!
    : {
        player_id: userId,
        current_modifier: 0.0,
        win_streak: 0,
        lose_streak: 0,
        updated_at: 0,
      };

  // Normalize optional fields for legacy states written before hardening.
  if (state.last_adjusted_seq === undefined) {
    state.last_adjusted_seq = 0;
  }
  if (state.corroborated_completions === undefined) {
    state.corroborated_completions = {};
  }

  const historyResult = loadMatchHistory(nk, userId);
  const history = historyResult.success ? historyResult.data! : [];

  const nowMs = Date.now();
  const preAdjustmentModifier = state.current_modifier;

  let verified = false;
  let counted = false;

  if (request.match_type === 'pve') {
    if (!request.won) {
      // PvE loss: hint only (no server-side signal for failed attempts).
      counted = true;
    } else {
      const evidence = loadStageCompletionEvidence(nk, userId);
      const match = findCorroboratingCompletion(state.corroborated_completions, evidence, nowMs);
      if (match) {
        verified = true;
        counted = true;
        state.corroborated_completions[match.stage_id] = match.last_accepted_ms;
      }
    }
  }
  // PvP outcomes: recorded below for analytics only — never counted (PvE-only).

  const seq = nextSequence(history);
  const matchEntry: MatchEntry = {
    match_id: request.match_id,
    won: request.won,
    match_type: request.match_type,
    timestamp: Math.floor(nowMs / 1000),
    base_difficulty: preAdjustmentModifier,
    seq,
    verified,
    counted,
  };
  history.push(matchEntry);

  // Keep only the most recent entries (server-side ledger cap).
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.splice(0, history.length - MAX_HISTORY_ENTRIES);
  }

  // Re-derive streaks from the ledger; never trust persisted streak fields.
  let derived = deriveStreaks(history, state.last_adjusted_seq);
  let adjustmentNeeded = false;

  if (derived.win_streak >= WIN_STREAK_THRESHOLD) {
    const newModifier = Math.min(state.current_modifier + 0.1, MAX_MODIFIER);
    if (newModifier !== state.current_modifier) {
      adjustmentNeeded = true;
    }
    state.current_modifier = newModifier;
    state.last_adjusted_seq = seq; // Consume ledger entries through this one.
    derived = deriveStreaks(history, state.last_adjusted_seq);
  } else if (derived.lose_streak >= LOSE_STREAK_THRESHOLD) {
    const newModifier = Math.max(state.current_modifier - 0.1, MIN_MODIFIER);
    if (newModifier !== state.current_modifier) {
      adjustmentNeeded = true;
    }
    state.current_modifier = newModifier;
    state.last_adjusted_seq = seq; // Consume ledger entries through this one.
    derived = deriveStreaks(history, state.last_adjusted_seq);
  }

  state.win_streak = derived.win_streak;
  state.lose_streak = derived.lose_streak;
  state.updated_at = Math.floor(nowMs / 1000);

  nk.storageWrite?.([
    {
      collection: 'difficulty_state',
      key: userId,
      userId: userId,
      value: toStorageValue(state),
    },
  ]);

  nk.storageWrite?.([
    {
      collection: 'match_history',
      key: userId,
      userId: userId,
      value: toStorageValue(history),
    },
  ]);

  return {
    state,
    verified,
    counted,
    adjusted: adjustmentNeeded,
  };
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

  // Re-derive streaks from the server-classified ledger rather than trusting
  // the persisted streak caches (#870).
  const derived = deriveStreaks(history, state.last_adjusted_seq ?? 0);

  // Calculate win rate from recent matches
  const recentMatches = history.slice(-10);
  const wins = recentMatches.filter((m) => m.won).length;
  const winRate = recentMatches.length > 0 ? wins / recentMatches.length : 0.0;

  // Calculate performance rating
  const performanceRating = calculatePerformanceRating(
    winRate,
    derived.win_streak,
    derived.lose_streak
  );

  return JSON.stringify({
    win_rate: winRate,
    win_streak: derived.win_streak,
    lose_streak: derived.lose_streak,
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
export function getDifficultyLevel(modifier: number): string {
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
  const objects =
    nk.storageRead?.([
      {
        collection: 'difficulty_state',
        key: userId,
        userId: userId,
      },
    ]) ?? [];

  if (!objects || objects.length === 0) {
    return { success: false };
  }

  const value = objects[0].value;
  if (!value) {
    return { success: false };
  }

  const parseResult = safeParse<DifficultyState>(
    getStorageRawValue(value) ?? '',
    null,
    logger,
    'difficulty_state'
  );
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
  const objects =
    nk.storageRead?.([
      {
        collection: 'match_history',
        key: userId,
        userId: userId,
      },
    ]) ?? [];

  if (!objects || objects.length === 0) {
    return { success: true, data: [] };
  }

  const value = objects[0].value;
  if (!value) {
    return { success: true, data: [] };
  }

  // Create a dummy logger for safeParse
  const dummyLogger: Runtime.Logger = {
    info: (_message: string, ..._args: unknown[]) => {},
    warn: (_message: string, ..._args: unknown[]) => {},
    error: (_message: string, ..._args: unknown[]) => {},
    debug: (_message: string, ..._args: unknown[]) => {},
  };

  const parseResult = safeParse<MatchEntry[]>(
    getStorageRawValue(value) ?? '',
    null,
    dummyLogger,
    'match_history'
  );
  if (!parseResult.success || !parseResult.data) {
    return { success: true, data: [] };
  }

  return { success: true, data: parseResult.data };
}

/**
 * Minimal shape of the authoritative stage completion storage needed for
 * evidence extraction. The full record is owned by `stage_tracking`.
 */
interface StageCompletionStorageShape {
  completions?: Record<
    string,
    {
      stage_id?: string;
      completed_at?: string;
      updated_at?: string;
    }
  >;
}

/**
 * Loads server-known PvE stage results from the authoritative
 * `stage_completion` storage (written only by the validated `stage_complete`
 * RPC, the sole writer since the #1069 consolidation). Fails closed: any read/parse error yields no evidence, so PvE wins
 * cannot be corroborated by accident.
 *
 * @param nk - Nakama server interface
 * @param userId - User to load evidence for
 * @returns Stage completion evidence keyed by stage_id
 */
function loadStageCompletionEvidence(
  nk: Runtime.Nakama,
  userId: string
): StageCompletionEvidence[] {
  let objects: { value?: string | Record<string, unknown> }[] = [];
  try {
    objects =
      nk.storageRead?.([
        {
          collection: STAGE_COMPLETION_COLLECTION,
          key: userId,
          userId: userId,
        },
      ]) ?? [];
  } catch {
    // Storage failure: fail closed (no evidence).
    return [];
  }

  if (!objects || objects.length === 0 || !objects[0].value) {
    return [];
  }

  const raw = objects[0].value;
  let parsed: StageCompletionStorageShape | null = null;
  try {
    parsed =
      typeof raw === 'string'
        ? (JSON.parse(raw) as StageCompletionStorageShape)
        : (raw as unknown as StageCompletionStorageShape);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.completions) {
    return [];
  }

  return Object.values(parsed.completions)
    .map(parseCompletionEvidenceRecord)
    .filter((item): item is StageCompletionEvidence => item !== null);
}

/**
 * Parses a single stage completion record into evidence, validating that it
 * carries a usable stage id and a sane (parseable, not-in-the-future)
 * server-written timestamp.
 *
 * @param record - Raw completion record from storage
 * @returns Evidence, or null when the record is unusable
 */
function parseCompletionEvidenceRecord(record: unknown): StageCompletionEvidence | null {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const typed = record as { stage_id?: unknown; completed_at?: unknown; updated_at?: unknown };
  const stageId = typeof typed.stage_id === 'string' ? typed.stage_id : null;
  if (!stageId) {
    return null;
  }
  // `updated_at` is refreshed on every server-accepted (new or improved)
  // completion; `completed_at` is the first completion timestamp.
  const rawTs = typed.updated_at || typed.completed_at;
  if (typeof rawTs !== 'string') {
    return null;
  }
  const ts = Date.parse(rawTs);
  if (!Number.isFinite(ts) || ts > Date.now()) {
    return null;
  }
  return { stage_id: stageId, last_accepted_ms: ts };
}

/**
 * Finds a stage completion event that can corroborate a reported PvE win.
 *
 * A completion qualifies when it is newer than the last event already
 * consumed for that stage (replay resistance) and recent enough to plausibly
 * correspond to the reported match (evidence window). Among qualifiers the
 * most recent event is chosen.
 *
 * @param consumed - Per-stage consumed completion timestamps (mutated by the caller on match)
 * @param evidence - Server-known stage completion evidence
 * @param nowMs - Current server time in epoch ms
 * @returns The corroborating completion, or null when none qualifies
 */
function findCorroboratingCompletion(
  consumed: Record<string, number>,
  evidence: StageCompletionEvidence[],
  nowMs: number
): StageCompletionEvidence | null {
  let best: StageCompletionEvidence | null = null;

  for (const item of evidence) {
    if (item.last_accepted_ms <= (consumed[item.stage_id] ?? 0)) {
      continue; // Already used to verify a previous report.
    }
    if (nowMs - item.last_accepted_ms > STAGE_EVIDENCE_WINDOW_MS) {
      continue; // Too old to corroborate this report.
    }
    if (best === null || item.last_accepted_ms > best.last_accepted_ms) {
      best = item;
    }
  }

  return best;
}

/**
 * Derives current win/lose streaks from the server-classified match ledger.
 *
 * Only entries the server classified as counting (`counted === true`) and
 * appended after the adjustment cursor participate. Non-counted entries
 * (PvP reports, uncorroborated PvE wins, legacy pre-hardening entries) are
 * transparent: they neither extend nor reset a streak. The streak direction
 * is taken from the most recent counted entry and counts backwards until the
 * direction flips.
 *
 * @param history - Match ledger (may include non-counted and legacy entries)
 * @param adjustedThroughSeq - Ledger cursor; entries with seq <= this are consumed
 * @returns Derived win and lose streaks
 */
export function deriveStreaks(
  history: MatchEntry[],
  adjustedThroughSeq: number
): { win_streak: number; lose_streak: number } {
  let winStreak = 0;
  let loseStreak = 0;
  let direction: 'win' | 'lose' | null = null;

  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry.seq === undefined || entry.seq <= adjustedThroughSeq) {
      continue; // Consumed by an adjustment, or legacy entry without seq.
    }
    if (entry.counted !== true) {
      continue; // PvP / uncorroborated PvE win — transparent.
    }
    if (direction === null) {
      direction = entry.won ? 'win' : 'lose';
    }
    if (entry.won && direction === 'win') {
      winStreak += 1;
    } else if (!entry.won && direction === 'lose') {
      loseStreak += 1;
    } else {
      break; // Direction flipped — the streak ends.
    }
  }

  return { win_streak: winStreak, lose_streak: loseStreak };
}

/**
 * Computes the next monotonic sequence number for the ledger.
 *
 * @param history - Current match ledger
 * @returns Next sequence number (>= 1)
 */
function nextSequence(history: MatchEntry[]): number {
  let max = 0;
  for (const entry of history) {
    if (entry.seq !== undefined && entry.seq > max) {
      max = entry.seq;
    }
  }
  return max + 1;
}

/**
 * Gets the current difficulty modifier for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get modifier for
 * @returns Current difficulty modifier
 */
export function getDifficultyModifier(ctx: TestContext, userId: string): number {
  const stateResult = loadDifficultyState(ctx as unknown as Runtime.Nakama, userId);
  return stateResult.success ? stateResult.data!.current_modifier : 0.0;
}

/**
 * Gets the difficulty state for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get state for
 * @returns Full difficulty state with match history
 */
export function getDifficultyState(
  ctx: TestContext,
  userId: string
): DifficultyState & { match_history: MatchEntry[] } {
  const stateResult = loadDifficultyState(ctx as unknown as Runtime.Nakama, userId);
  const historyResult = loadMatchHistory(ctx as unknown as Runtime.Nakama, userId);

  const state = stateResult.success
    ? stateResult.data!
    : {
        player_id: userId,
        current_modifier: 0.0,
        win_streak: 0,
        lose_streak: 0,
        updated_at: 0,
      };

  const history = historyResult.success ? historyResult.data! : [];

  return {
    ...state,
    match_history: history,
  };
}

/**
 * Sets the difficulty modifier for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to set modifier for
 * @param modifier - New difficulty modifier
 */
export function setDifficultyModifier(ctx: TestContext, userId: string, modifier: number): void {
  const stateResult = loadDifficultyState(ctx as unknown as Runtime.Nakama, userId);
  const state = stateResult.success
    ? stateResult.data!
    : {
        player_id: userId,
        current_modifier: 0.0,
        win_streak: 0,
        lose_streak: 0,
        updated_at: 0,
      };

  state.current_modifier = Math.min(Math.max(modifier, MIN_MODIFIER), MAX_MODIFIER);
  state.updated_at = Math.floor(Date.now() / 1000);

  ctx.storageWrite?.([
    {
      collection: 'difficulty_state',
      key: userId,
      userId: userId,
      value: toStorageValue(state),
    },
  ]);
}

/**
 * Tracks a match outcome for difficulty adjustment (test helper).
 *
 * Delegates to the same server-authoritative re-derivation used by the
 * `track_match_outcome` RPC, so tests exercise production semantics.
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to track match for
 * @param data - Match outcome data
 */
export function trackMatchOutcome(
  ctx: TestContext,
  userId: string,
  data: { won: boolean; match_type: 'pve' | 'pvp' }
): void {
  applyTrackedOutcome(ctx as unknown as Runtime.Nakama, userId, {
    match_id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    won: data.won,
    match_type: data.match_type,
    duration: 0,
  });
}

/**
 * Resets the difficulty state for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to reset state for
 */
export function resetDifficulty(ctx: TestContext, userId: string): void {
  const defaultState: DifficultyState = {
    player_id: userId,
    current_modifier: 0.0,
    win_streak: 0,
    lose_streak: 0,
    updated_at: Math.floor(Date.now() / 1000),
    last_adjusted_seq: 0,
    corroborated_completions: {},
  };

  // Reset difficulty state
  ctx.storageWrite?.([
    {
      collection: 'difficulty_state',
      key: userId,
      userId: userId,
      value: toStorageValue(defaultState),
    },
  ]);

  // Clear match history
  ctx.storageWrite?.([
    {
      collection: 'match_history',
      key: userId,
      userId: userId,
      value: toStorageValue([]),
    },
  ]);
}

/**
 * Gets the difficulty level string for a user (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get difficulty level for
 * @returns Difficulty level string
 */
export function getDifficultyLevelString(ctx: TestContext, userId: string): string {
  const modifier = getDifficultyModifier(ctx, userId);
  return getDifficultyLevel(modifier);
}

/**
 * Gets performance rating for a user (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get performance rating for
 * @returns Performance rating string
 */
export function getPerformanceRating(ctx: TestContext, userId: string): string {
  const winRate = getWinRate(ctx, userId, 10);
  const state = getDifficultyState(ctx, userId);

  return calculatePerformanceRating(winRate, state.win_streak, state.lose_streak);
}

/**
 * Gets win rate for a user (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get win rate for
 * @param windowSize - Number of recent matches to consider
 * @returns Win rate (0-1)
 */
export function getWinRate(ctx: TestContext, userId: string, windowSize: number = 10): number {
  const historyResult = loadMatchHistory(ctx as unknown as Runtime.Nakama, userId);
  const history = historyResult.success ? historyResult.data! : [];

  if (history.length === 0) {
    return 0;
  }

  // Get last N matches
  const recentMatches = history.slice(-windowSize);
  const wins = recentMatches.filter((m) => m.won).length;

  return wins / recentMatches.length;
}

/**
 * Calculates target difficulty with modifier (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to calculate target difficulty for
 * @param baseDifficulty - Base difficulty value (0-1)
 * @param customModifier - Optional custom modifier override
 * @returns Target difficulty (0-1.5)
 */
export function calculateTargetDifficulty(
  ctx: TestContext,
  userId: string,
  baseDifficulty: number,
  customModifier?: number
): number {
  const modifier =
    customModifier !== undefined ? customModifier : getDifficultyModifier(ctx, userId);
  const target = baseDifficulty * (1 + modifier);

  // Clamp to [0, 1.5]
  return Math.max(0, Math.min(1.5, target));
}

/**
 * Gets the encounter reward modifier based on difficulty (test helper).
 *
 * Reward-neutrality (#870): the dynamic difficulty modifier must NEVER
 * affect loot, XP, or drop rates. The ratified constraint is enforced here
 * by always returning a neutral 1.0x multiplier, regardless of the current
 * difficulty modifier. Rewards are computed exclusively from stage-level
 * inputs (stage difficulty tier, boss defeat) by the loot system.
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get reward modifier for
 * @returns Reward multiplier — always exactly 1.0 (reward-neutral)
 */
export function getEncounterRewardModifier(_ctx: TestContext, _userId: string): number {
  return 1.0;
}
