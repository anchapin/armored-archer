/**
 * Match Replay module.
 * @fileoverview Implements replay system for debugging and QA investigation of PvP matches.
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { PlayerStats } from '../types/game';
import { safeParse } from '../utils/safeParse';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

/**
 * Turn-by-turn state snapshot for replay reconstruction.
 *
 * @property turn - Turn number
 * @property timestamp - When this turn occurred
 * @property creator_health - Creator's HP after this turn
 * @property opponent_health - Opponent's HP after this turn
 * @property creator_turn_data - The turn data submitted by creator (if applicable)
 * @property opponent_turn_data - The turn data submitted by opponent (if applicable)
 * @property current_player - Which player's turn it is after this turn
 * @property match_status - Status after this turn
 */
export interface TurnStateSnapshot {
  turn: number;
  timestamp: number;
  creator_health: number;
  opponent_health: number;
  creator_turn_data?: {
    action_type: string;
    angle: number;
    power?: number;
  };
  opponent_turn_data?: {
    action_type: string;
    angle: number;
    power?: number;
  };
  current_player: string;
  match_status: 'pending' | 'active' | 'completed';
}

/**
 * Detailed match replay data.
 *
 * @property match_id - Unique match identifier
 * @property creator_id - ID of match creator
 * @property opponent_id - ID of opponent
 * @property match_type - Type of match
 * @property created_at - When match was created
 * @property completed_at - When match was completed
 * @property total_turns - Number of turns played
 * @property duration_seconds - Match duration
 * @property winner_id - ID of the winner
 * @property loser_id - ID of the loser
 * @property end_reason - Why the match ended
 * @property combat_log - Full combat log entries
 * @property turn_snapshots - Turn-by-turn state snapshots for reconstruction
 * @property creator_stats_at_match - Creator's stats at match start
 * @property opponent_stats_at_match - Opponent's stats at match start
 * @property creator_final_health - Creator's HP at match end
 * @property opponent_final_health - Opponent's HP at match end
 * @property replay_data - Additional replay metadata
 * @property debug_notes - Manual debug notes
 * @property qa_flagged - Whether flagged for QA
 * @property qa_flagged_reason - Reason for QA flag
 */
export interface MatchReplayData {
  match_id: string;
  creator_id: string;
  opponent_id: string;
  match_type: 'ranked' | 'casual';
  created_at: string;
  completed_at: string;
  total_turns: number;
  duration_seconds: number;
  winner_id: string;
  loser_id: string;
  end_reason: string;
  combat_log: CombatLogEntry[];
  turn_snapshots: TurnStateSnapshot[];
  creator_stats_at_match: PlayerStats;
  opponent_stats_at_match: PlayerStats;
  creator_final_health: number;
  opponent_final_health: number;
  replay_data: Record<string, unknown>;
  debug_notes: string | null;
  qa_flagged: boolean;
  qa_flagged_reason: string | null;
}

/**
 * Combat log entry from the database.
 */
export interface CombatLogEntry {
  turn: number;
  attacker_id: string;
  action: string;
  hit: boolean;
  damage: number;
  is_crit: boolean;
  timestamp: number;
}

/**
 * Request to get match replay data.
 *
 * @property match_id - The match ID to retrieve replay for
 */
export interface GetMatchReplayRequest {
  match_id: string;
}

/**
 * Request to list match replays.
 *
 * @property limit - Maximum number of replays to return (default 50)
 * @property offset - Pagination offset (default 0)
 * @property match_type - Optional filter by match type
 * @property qa_flagged_only - Only show QA flagged matches
 * @property player_id - Optional filter by player ID (creator or opponent)
 * @property date_from - Optional start date filter (ISO 8601)
 * @property date_to - Optional end date filter (ISO 8601)
 */
export interface ListMatchReplaysRequest {
  limit?: number;
  offset?: number;
  match_type?: 'ranked' | 'casual';
  qa_flagged_only?: boolean;
  player_id?: string;
  date_from?: string;
  date_to?: string;
}

/**
 * Summary data for a match replay list.
 */
export interface MatchReplaySummary {
  match_id: string;
  creator_id: string;
  opponent_id: string;
  match_type: 'ranked' | 'casual';
  created_at: string;
  total_turns: number;
  duration_seconds: number;
  winner_id: string;
  end_reason: string;
  qa_flagged: boolean;
  qa_flagged_reason: string | null;
  replay_access_count: number;
}

/**
 * Request to flag a match for QA investigation.
 *
 * @property match_id - The match ID to flag
 * @property reason - Reason for flagging
 */
export interface FlagMatchForQaRequest {
  match_id: string;
  reason: string;
}

/**
 * Request to add debug notes to a match.
 *
 * @property match_id - The match ID
 * @property notes - Debug notes to add
 */
export interface AddDebugNotesRequest {
  match_id: string;
  notes: string;
}

/**
 * Reconstructed state at a specific turn.
 */
export interface ReconstructedMatchState {
  turn: number;
  creator_health: number;
  opponent_health: number;
  creator_stats: PlayerStats;
  opponent_stats: PlayerStats;
  current_player: string;
  match_status: string;
  last_action: {
    player_id: string;
    action: string;
    result: {
      hit: boolean;
      damage: number;
      is_crit: boolean;
    };
  } | null;
}

// ============================================
// RPC Handlers
// ============================================

/**
 * Registers the get match replay RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetMatchReplay(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_match_replay', rpcGetMatchReplay);
}

/**
 * RPC handler for getting match replay data.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing request data
 * @returns JSON string with replay data
 */
export async function rpcGetMatchReplay(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  try {
    const validation = validatePayload(ZodSchemas.get_match_replay, payload, 'get_match_replay');
    if (!validation.success) {
      return createValidationErrorResponse('get_match_replay', validation.error);
    }

    const request = validation.data;

    // Query the match result
    const result = await nk.dbQuery(
      `SELECT
        match_id, creator_id, opponent_id, winner_id, loser_id,
        match_type, total_turns, duration_seconds, end_reason,
        combat_log, replay_data, debug_notes, qa_flagged, qa_flagged_reason,
        creator_health_remaining, opponent_health_remaining,
        creator_stats_at_match, opponent_stats_at_match,
        created_at, updated_at
       FROM match_results
       WHERE match_id = $1 AND replay_enabled = true`,
      [request.match_id]
    );

    if (result.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Match not found or replay not enabled',
      });
    }

    const match = result[0] as Record<string, unknown>;

    // Parse combat log
    const combatLogParse = safeParse<CombatLogEntry[]>(
      String(match.combat_log || '[]'),
      null,
      logger,
      'rpcGetMatchReplay:combat_log'
    );
    const combatLog = combatLogParse.success && combatLogParse.data ? combatLogParse.data : [];

    // Parse replay data for turn snapshots
    const replayDataParse = safeParse<Record<string, unknown>>(
      String(match.replay_data || '{}'),
      null,
      logger,
      'rpcGetMatchReplay:replay_data'
    );
    const replayData = replayDataParse.success && replayDataParse.data ? replayDataParse.data : {};

    // Parse turn snapshots from replay data
    const turnSnapshotsParse = safeParse<TurnStateSnapshot[]>(
      JSON.stringify(replayData.turn_snapshots || []),
      null,
      logger,
      'rpcGetMatchReplay:turn_snapshots'
    );
    const turnSnapshots = turnSnapshotsParse.success && turnSnapshotsParse.data ? turnSnapshotsParse.data : [];

    // Parse player stats
    const creatorStatsParse = safeParse<PlayerStats>(
      String(match.creator_stats_at_match || '{}'),
      null,
      logger,
      'creator_stats'
    );
    const creatorStats = creatorStatsParse.success && creatorStatsParse.data ? creatorStatsParse.data : { level: 1, xp: 0, stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 } };

    const opponentStatsParse = safeParse<PlayerStats>(
      String(match.opponent_stats_at_match || '{}'),
      null,
      logger,
      'opponent_stats'
    );
    const opponentStats = opponentStatsParse.success && opponentStatsParse.data ? opponentStatsParse.data : { level: 1, xp: 0, stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 } };

    // Increment replay access count
    await nk.dbQuery('SELECT increment_replay_access($1)', [request.match_id]);

    // Build replay data response
    const replayDataResponse: MatchReplayData = {
      match_id: String(match.match_id),
      creator_id: String(match.creator_id),
      opponent_id: String(match.opponent_id),
      match_type: match.match_type as 'ranked' | 'casual',
      created_at: String(match.created_at),
      completed_at: String(match.updated_at),
      total_turns: Number(match.total_turns || 0),
      duration_seconds: Number(match.duration_seconds || 0),
      winner_id: String(match.winner_id),
      loser_id: String(match.loser_id),
      end_reason: String(match.end_reason),
      combat_log: combatLog,
      turn_snapshots: turnSnapshots,
      creator_stats_at_match: creatorStats,
      opponent_stats_at_match: opponentStats,
      creator_final_health: Number(match.creator_health_remaining || 0),
      opponent_final_health: Number(match.opponent_health_remaining || 0),
      replay_data: replayData,
      debug_notes: match.debug_notes as string | null,
      qa_flagged: Boolean(match.qa_flagged),
      qa_flagged_reason: match.qa_flagged_reason as string | null,
    };

    logger.info('Match replay retrieved', {
      matchId: request.match_id,
      userId: ctx.userId,
      turns: match.total_turns,
    });

    return JSON.stringify({
      success: true,
      replay: replayDataResponse,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get match replay', {
      error: errorMessage,
      userId: ctx.userId,
    });
    return JSON.stringify({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Registers the list match replays RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcListMatchReplays(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/list_match_replays', rpcListMatchReplays);
}

/**
 * RPC handler for listing match replays.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing request data
 * @returns JSON string with replay list
 */
export async function rpcListMatchReplays(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  try {
    const validation = validatePayload(ZodSchemas.list_match_replays, payload, 'list_match_replays');
    if (!validation.success) {
      return createValidationErrorResponse('list_match_replays', validation.error);
    }

    const request = validation.data;

    const limit = Math.min(request.limit || 50, 100);
    const offset = request.offset || 0;

    // Build query conditions
    const conditions: string[] = ['replay_enabled = true'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (request.match_type) {
      conditions.push(`match_type = $${paramIndex++}`);
      params.push(request.match_type);
    }

    if (request.qa_flagged_only) {
      conditions.push(`qa_flagged = true`);
    }

    if (request.player_id) {
      conditions.push(`(creator_id = $${paramIndex++} OR opponent_id = $${paramIndex++})`);
      params.push(request.player_id, request.player_id);
    }

    if (request.date_from) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(request.date_from);
    }

    if (request.date_to) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(request.date_to);
    }

    const whereClause = conditions.join(' AND ');

    // Query match replays
    const result = await nk.dbQuery(
      `SELECT
        match_id, creator_id, opponent_id, match_type,
        created_at, total_turns, duration_seconds,
        winner_id, end_reason, qa_flagged, qa_flagged_reason,
        replay_access_count
       FROM match_results
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const summaries: MatchReplaySummary[] = (result as Record<string, unknown>[]).map((row: Record<string, unknown>) => ({
      match_id: String(row.match_id),
      creator_id: String(row.creator_id),
      opponent_id: String(row.opponent_id),
      match_type: row.match_type as 'ranked' | 'casual',
      created_at: String(row.created_at),
      total_turns: Number(row.total_turns),
      duration_seconds: Number(row.duration_seconds),
      winner_id: String(row.winner_id),
      end_reason: String(row.end_reason),
      qa_flagged: Boolean(row.qa_flagged),
      qa_flagged_reason: row.qa_flagged_reason as string | null,
      replay_access_count: Number(row.replay_access_count || 0),
    }));

    logger.info('Match replays listed', {
      userId: ctx.userId,
      count: summaries.length,
      limit,
      offset,
    });

    return JSON.stringify({
      success: true,
      replays: summaries,
      count: summaries.length,
      limit,
      offset,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to list match replays', {
      error: errorMessage,
      userId: ctx.userId,
    });
    return JSON.stringify({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Registers the flag match for QA RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcFlagMatchForQa(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/flag_match_for_qa', rpcFlagMatchForQa);
}

/**
 * RPC handler for flagging a match for QA investigation.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing request data
 * @returns JSON string with result
 */
export async function rpcFlagMatchForQa(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  try {
    const validation = validatePayload(ZodSchemas.flag_match_for_qa, payload, 'flag_match_for_qa');
    if (!validation.success) {
      return createValidationErrorResponse('flag_match_for_qa', validation.error);
    }

    const request = validation.data;

    const result = await nk.dbQuery('SELECT flag_match_for_qa($1, $2)', [
      request.match_id,
      request.reason,
    ]);

    const success = (result[0] as Record<string, unknown>)?.flag_match_for_qa === true;

    if (!success) {
      return JSON.stringify({
        success: false,
        error: 'Match not found',
      });
    }

    logger.info('Match flagged for QA', {
      matchId: request.match_id,
      userId: ctx.userId,
      reason: request.reason,
    });

    return JSON.stringify({
      success: true,
      message: 'Match flagged for QA investigation',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to flag match for QA', {
      error: errorMessage,
      userId: ctx.userId,
    });
    return JSON.stringify({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Registers the add debug notes RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcAddDebugNotes(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/add_debug_notes', rpcAddDebugNotes);
}

/**
 * RPC handler for adding debug notes to a match.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing request data
 * @returns JSON string with result
 */
export async function rpcAddDebugNotes(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  try {
    const validation = validatePayload(ZodSchemas.add_debug_notes, payload, 'add_debug_notes');
    if (!validation.success) {
      return createValidationErrorResponse('add_debug_notes', validation.error);
    }

    const request = validation.data;

    const result = await nk.dbQuery(
      `UPDATE match_results
       SET debug_notes = COALESCE(debug_notes, '') || $1,
           updated_at = NOW()
       WHERE match_id = $2
       RETURNING match_id`,
      [
        (request.notes || '').trim() + '\n---\n',
        request.match_id,
      ]
    );

    if (result.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Match not found',
      });
    }

    logger.info('Debug notes added to match', {
      matchId: request.match_id,
      userId: ctx.userId,
    });

    return JSON.stringify({
      success: true,
      message: 'Debug notes added',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to add debug notes', {
      error: errorMessage,
      userId: ctx.userId,
    });
    return JSON.stringify({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Registers the reconstruct match state RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcReconstructMatchState(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/reconstruct_match_state', rpcReconstructMatchState);
}

/**
 * RPC handler for reconstructing match state at a specific turn.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing request data
 * @returns JSON string with reconstructed state
 */
export async function rpcReconstructMatchState(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  try {
    const validation = validatePayload(ZodSchemas.reconstruct_match_state, payload, 'reconstruct_match_state');
    if (!validation.success) {
      return createValidationErrorResponse('reconstruct_match_state', validation.error);
    }

    const request = validation.data;

    // Get match replay data
    const result = await nk.dbQuery(
      `SELECT
        match_id, creator_id, opponent_id, winner_id, match_type,
        combat_log, replay_data, creator_stats_at_match, opponent_stats_at_match
       FROM match_results
       WHERE match_id = $1 AND replay_enabled = true`,
      [request.match_id]
    );

    if (result.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Match not found or replay not enabled',
      });
    }

    const match = result[0] as Record<string, unknown>;

    // Parse combat log
    const combatLogParse = safeParse<CombatLogEntry[]>(
      String(match.combat_log || '[]'),
      null,
      logger,
      'rpcReconstructMatchState:combat_log'
    );
    const combatLog = combatLogParse.success && combatLogParse.data ? combatLogParse.data : [];

    // Parse replay data for turn snapshots
    const replayDataParse = safeParse<Record<string, unknown>>(
      String(match.replay_data || '{}'),
      null,
      logger,
      'rpcReconstructMatchState:replay_data'
    );
    const replayData = replayDataParse.success && replayDataParse.data ? replayDataParse.data : {};

    // Parse turn snapshots from replay data
    const turnSnapshotsParse = safeParse<TurnStateSnapshot[]>(
      JSON.stringify(replayData.turn_snapshots || []),
      null,
      logger,
      'rpcReconstructMatchState:turn_snapshots'
    );
    const turnSnapshots = turnSnapshotsParse.success && turnSnapshotsParse.data ? turnSnapshotsParse.data : [];

    // Find the snapshot at or before the requested turn
    const targetSnapshot = turnSnapshots.find(s => s.turn === request.turn) ||
                          turnSnapshots.filter(s => s.turn <= request.turn).pop();

    if (!targetSnapshot) {
      return JSON.stringify({
        success: false,
        error: 'Turn not found in replay data',
      });
    }

    // Find the last action before or at this turn
    const lastActionLog = combatLog
      .filter(entry => entry.turn <= request.turn)
      .pop();

    const lastAction = lastActionLog ? {
      player_id: lastActionLog.attacker_id,
      action: lastActionLog.action,
      result: {
        hit: lastActionLog.hit,
        damage: lastActionLog.damage,
        is_crit: lastActionLog.is_crit,
      },
    } : null;

    // Parse player stats
    const creatorStatsParse = safeParse<PlayerStats>(
      String(match.creator_stats_at_match || '{}'),
      null,
      logger,
      'creator_stats'
    );
    const creatorStats = creatorStatsParse.success && creatorStatsParse.data ? creatorStatsParse.data : { level: 1, xp: 0, stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 } };

    const opponentStatsParse = safeParse<PlayerStats>(
      String(match.opponent_stats_at_match || '{}'),
      null,
      logger,
      'opponent_stats'
    );
    const opponentStats = opponentStatsParse.success && opponentStatsParse.data ? opponentStatsParse.data : { level: 1, xp: 0, stats: { attack: 0, defense: 0, dodge: 0, crit_rate: 0 } };

    // Build reconstructed state
    const reconstructedState: ReconstructedMatchState = {
      turn: targetSnapshot.turn,
      creator_health: targetSnapshot.creator_health,
      opponent_health: targetSnapshot.opponent_health,
      creator_stats: creatorStats,
      opponent_stats: opponentStats,
      current_player: targetSnapshot.current_player,
      match_status: targetSnapshot.match_status,
      last_action: lastAction,
    };

    logger.info('Match state reconstructed', {
      matchId: request.match_id,
      turn: request.turn,
      userId: ctx.userId,
    });

    return JSON.stringify({
      success: true,
      state: reconstructedState,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to reconstruct match state', {
      error: errorMessage,
      userId: ctx.userId,
    });
    return JSON.stringify({
      success: false,
      error: 'Internal server error',
    });
  }
}

// ============================================
// Validation Schemas (imported from validation.ts)
// ============================================
// Validation schemas are imported from validation.ts and used via validatePayload
