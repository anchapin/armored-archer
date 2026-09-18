/**
 * Combat System module.
 * @fileoverview Manages PvP combat actions and turn processing.
 */

import { Span } from '@opentelemetry/api';
import { logger } from '../config/logger';
import { PlayerStats } from '../types/game';
import { Runtime } from '../types/nakama';
import { traceAsync, setTracingAttribute } from '../utils/tracing';
import {
  verifyRequestSignature,
  validateCombatActionParameters,
  detectTimingAttack,
  RequestSignature,
} from './anti_cheat';
import { PvPMatch } from './matchmaker';
import { profileFunction } from './profiling';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { getPlayerInventory, getEquippedGearModifierBonuses, PlayerInventory } from './gear_system';
import { safeParse } from '../utils/safeParse';
import { getCurrentSeason, getLeaderboardEntry } from './season_system';
import {
  logHitResolution,
  logTimeout,
  logDisconnect,
  type HitResolutionEvent,
  type TimeoutEvent,
} from './fairness_telemetry';
import { recordCombatAction, recordDamageDealt } from './metrics';

// Maximum consecutive turn timeouts before auto-forfeit.
// Turn timers are the single timeout authority (ADR-0003): the 5-minute turn
// timer doubles as the mobile reconnect grace, so 2 consecutive timeouts
// (~10 minutes) forfeit the match. There is deliberately no separate, harsher
// match-level inactivity check (issue #868).
const MAX_CONSECUTIVE_TIMEOUTS = 2;

/**
 * Combat action request data.
 *
 * @property match_id - Unique identifier for the match
 * @property action_type - Type of combat action ("shoot")
 * @property angle - Angle of attack in radians (0 to 2π)
 * @property power - Optional power level for the attack (0.0-1.0)
 * @property requestId - Anti-cheat: unique request identifier
 * @property timestamp - Anti-cheat: client timestamp
 * @property signature - Anti-cheat: HMAC signature
 * @property nonce - Anti-cheat: cryptographic nonce
 */
export interface CombatAction {
  match_id: string;
  action_type: string; // "shoot"
  angle: number;
  power?: number;
  // Anti-cheat fields
  requestId?: string;
  timestamp?: number;
  signature?: string;
  nonce?: string;
}

/**
 * Result of a combat action.
 *
 * @property success - Whether the action was processed successfully
 * @property hit - Whether the attack hit the target
 * @property damage - Amount of damage dealt
 * @property is_crit - Whether the attack was a critical hit
 * @property attacker_stats - Stats of the attacking player
 * @property defender_stats - Stats of the defending player
 * @property match_status - Current status of the match
 * @property winner - Optional winner if match completed
 */
export interface CombatResult {
  success: boolean;
  hit: boolean;
  damage: number;
  is_crit: boolean;
  attacker_stats: PlayerStats;
  defender_stats: PlayerStats;
  match_status: string;
  winner?: string;
}

/**
 * Current state of a PvP match.
 *
 * @property match_id - Unique identifier for the match
 * @property turn - Current turn number
 * @property current_turn_user_id - Player whose turn it is
 * @property creator_id - ID of the match creator
 * @property opponent_id - ID of the opponent
 * @property creator_health - Current health of the creator
 * @property opponent_health - Current health of the opponent
 * @property creator_stats - Stats of the creator
 * @property opponent_stats - Stats of the opponent
 * @property status - Current match status
 * @property winner - Optional winner if match completed
 * @property log - Combat log entries
 * @property last_turn_timestamp - Timestamp of the last turn action
 * @property turn_timeout_ms - Milliseconds before a turn is considered abandoned
 * @property consecutive_timeouts - Number of consecutive turn timeouts for current player
 * @property forfeit_reason - Reason for match ending (timeout, disconnect, etc.)
 */
export interface MatchState {
  match_id: string;
  turn: number;
  current_turn_user_id: string;
  creator_id: string;
  opponent_id: string;
  creator_health: number;
  opponent_health: number;
  creator_stats: PlayerStats;
  opponent_stats: PlayerStats;
  status: string;
  winner?: string;
  log: CombatLogEntry[];
  last_turn_timestamp: number;
  turn_timeout_ms: number;
  consecutive_timeouts: number;
  forfeit_reason?: string;
}

/**
 * Combat log entry for tracking match history.
 *
 * @property turn - Turn number when this action occurred
 * @property attacker_id - ID of the attacking player
 * @property action - Type of action performed
 * @property hit - Whether the attack hit
 * @property damage - Amount of damage dealt
 * @property is_crit - Whether the attack was critical
 * @property timestamp - Timestamp when the action occurred
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
 * Registers the submit combat action RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcSubmitCombatAction(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/submit_combat_action', rpcSubmitCombatAction);
}

/**
 * Handles combat action submissions from players.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing combat action data
 * @returns JSON string with combat result
 *
 * @example
 * // Request payload
 * { "match_id": "match_123", "action_type": "shoot", "angle": 1.57 }
 *
 * // Response
 * {
 *   "success": true,
 *   "result": {
 *     "hit": true,
 *     "damage": 25,
 *     "is_crit": false,
 *     "match_status": "active"
 *   }
 * }
 */
/**
 * Validates match is valid and active for combat
 */
function validateMatchForCombat(
  nk: Runtime.Nakama,
  matchId: string,
  userId: string,
  span: Span
): { valid: true; match: PvPMatch } | { valid: false; error: string; errorCode?: string } {
  const matchObjects = nk.storageRead([
    {
      collection: 'pvp_matches',
      key: matchId,
      userId: userId,
    },
  ]);

  if (matchObjects.length === 0) {
    span.setAttribute('error', true);
    span.setAttribute('error.message', 'Match not found');
    return { valid: false, error: 'Match not found' };
  }

  const matchResult = safeParse<Record<string, unknown>>(
    matchObjects[0].value,
    null,
    logger,
    'validateMatch:match'
  );
  if (!matchResult.success || !matchResult.data) {
    span.setAttribute('error', true);
    span.setAttribute('error.message', 'Failed to parse match data');
    return { valid: false, error: 'Failed to parse match data' };
  }
  const match = matchResult.data as unknown as PvPMatch;

  if (isMatchExpired(match)) {
    span.setAttribute('error', true);
    span.setAttribute('error.message', 'Match has expired');
    return { valid: false, error: 'Match has expired' };
  }

  if (match.status !== 'active') {
    span.setAttribute('error', true);
    span.setAttribute('error.message', 'Match is not active');
    return { valid: false, error: 'Match is not active' };
  }

  if (match.creator_id !== userId && match.opponent_id !== userId) {
    span.setAttribute('error', true);
    span.setAttribute('error.message', 'Not a participant in this match');
    return { valid: false, error: 'Not a participant in this match' };
  }

  return { valid: true, match };
}

/**
 * Handles turn timeout by switching to opponent's turn
 * Returns true if match was forfeited due to consecutive timeouts
 */
async function handleTurnTimeout(
  nk: Runtime.Nakama,
  matchState: MatchState,
  logger: Runtime.Logger
): Promise<boolean> {
  const timedOutUserId = matchState.current_turn_user_id;
  const opponentId =
    timedOutUserId === matchState.creator_id ? matchState.opponent_id : matchState.creator_id;

  logger.info(
    'Turn timed out for user: %s in match: %s (consecutive timeouts: %d)',
    timedOutUserId,
    matchState.match_id,
    matchState.consecutive_timeouts + 1
  );

  // Increment consecutive timeouts
  matchState.consecutive_timeouts++;

  // Check if we should auto-forfeit
  if (matchState.consecutive_timeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
    logger.info(
      'Auto-forfeit triggered for match: %s due to consecutive timeouts',
      matchState.match_id
    );

    // Determine winner (the player who didn't timeout)
    const winnerId = opponentId;
    const loserId = timedOutUserId;

    // Update match state
    matchState.status = 'completed';
    matchState.winner = winnerId;
    matchState.forfeit_reason = 'timeout';

    // Add forfeit entry to log
    const forfeitLogEntry: CombatLogEntry = {
      turn: matchState.turn,
      attacker_id: loserId,
      action: 'forfeit',
      hit: false,
      damage: 0,
      is_crit: false,
      timestamp: Date.now(),
    };
    matchState.log.push(forfeitLogEntry);

    // Save match state
    saveMatchState(nk, matchState);

    // Get the match and update its status
    const matchObjects = nk.storageRead([
      {
        collection: 'pvp_matches',
        key: matchState.match_id,
        userId: matchState.creator_id,
      },
    ]);

    if (matchObjects.length > 0) {
      const matchResult = safeParse<PvPMatch>(
        matchObjects[0].value,
        null,
        logger,
        'handleTimeoutForfeit:match'
      );
      if (matchResult.success && matchResult.data) {
        // Log timeout event for fairness telemetry before persisting
        const timeoutEvent: TimeoutEvent = {
          event_id: `timeout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          match_id: matchState.match_id,
          timestamp: Date.now(),
          timed_out_user_id: loserId,
          opponent_id: winnerId,
          timeout_type: 'consecutive_timeouts',
          consecutive_timeouts: matchState.consecutive_timeouts,
          match_type: matchResult.data.match_type,
          turn: matchState.turn,
          turn_duration_ms: Date.now() - matchState.last_turn_timestamp,
        };

        // Non-blocking: log to telemetry
        void logTimeout(nk, timeoutEvent);

        updateMatchStatus(nk, matchResult.data, winnerId, 'timeout');

        // Persist match result to database
        await persistMatchResult(nk, matchResult.data, matchState, 'timeout');
      }
    }

    // Notify opponent of forfeit
    notifyOpponentOfForfeit(nk, matchState, opponentId, 'timeout');

    // Notify both players of match completion
    notifyMatchStateUpdate(nk, matchState, undefined, 'match_completed');

    return true;
  }

  // Switch to opponent's turn
  matchState.current_turn_user_id = opponentId;
  matchState.last_turn_timestamp = Date.now();
  saveMatchState(nk, matchState);

  // Log turn timeout event for fairness telemetry
  const timeoutEvent: TimeoutEvent = {
    event_id: `timeout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    match_id: matchState.match_id,
    timestamp: Date.now(),
    timed_out_user_id: timedOutUserId,
    opponent_id: opponentId,
    timeout_type: 'turn_timeout',
    consecutive_timeouts: matchState.consecutive_timeouts,
    match_type: 'ranked', // Default to ranked, will be updated when match is loaded
    turn: matchState.turn,
    turn_duration_ms: Date.now() - matchState.last_turn_timestamp,
  };

  // Non-blocking: log to telemetry
  void logTimeout(nk, timeoutEvent);

  return false;
}

/**
 * Performs anti-cheat validations for combat action
 */
function validateAntiCheat(
  ctx: Runtime.Context,
  action: CombatAction,
  matchState: MatchState,
  logger: Runtime.Logger
): string | null {
  // 1. Verify request signature if anti-cheat fields are provided
  if (action.requestId && action.timestamp && action.signature && action.nonce) {
    const signatureData: RequestSignature = {
      requestId: action.requestId,
      timestamp: action.timestamp,
      signature: action.signature,
      nonce: action.nonce,
    };

    const payloadForSig = JSON.stringify({
      match_id: action.match_id,
      action_type: action.action_type,
      angle: action.angle,
      power: action.power,
    });

    const sigResult = verifyRequestSignature(
      ctx,
      payloadForSig,
      signatureData,
      'submit_combat_action'
    );
    if (!sigResult.valid) {
      logger.warn('Anti-cheat signature verification failed for user: %s', ctx.userId);
      return 'ANTI_CHEAT_VIOLATION: Invalid request signature';
    }
  }

  // 2. Validate combat action parameters (angle, power)
  const requestId =
    action.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const paramValidation = validateCombatActionParameters(
    action.angle,
    action.power,
    matchState.current_turn_user_id,
    ctx.userId,
    'submit_combat_action',
    requestId
  );

  if (!paramValidation.valid) {
    const outOfTurnViolation = paramValidation.violations.some(
      (v) => v.violationType === 'out_of_turn'
    );
    if (outOfTurnViolation) {
      logger.warn('Out of turn action from user: %s', ctx.userId);
      return 'Not your turn';
    }
    logger.warn('Invalid combat parameters from user: %s', ctx.userId);
    return 'INVALID_PARAMETERS: Combat parameters out of valid range';
  }

  // 3. Detect timing attacks (rapid requests)
  if (detectTimingAttack(ctx.userId, 'submit_combat_action', requestId)) {
    logger.warn('Timing attack detected for user: %s', ctx.userId);
    return 'TIMING_ANOMALY: Suspicious request pattern detected';
  }

  return null;
}

export async function rpcSubmitCombatAction(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  return traceAsync('rpc.submit_combat_action', async (span) => {
    span.setAttribute('user.id', ctx.userId || 'anonymous');

    return profileFunction<string>('combat.submit_combat_action', async () => {
      logger.info('Submit combat action called for user: %s', ctx.userId);

      setTracingAttribute('rpc.payload_size', payload.length);

      const validation = validatePayload(
        ZodSchemas.submit_combat_action,
        payload,
        'submit_combat_action'
      );
      if (!validation.success) {
        span.setAttribute('validation.error', true);
        return createValidationErrorResponse('submit_combat_action', validation.error);
      }

      const action = validation.data;
      span.setAttribute('match.id', action.match_id);
      span.setAttribute('combat.action_type', action.action_type);
      setTracingAttribute('combat.angle', action.angle);
      if (action.power !== undefined) {
        setTracingAttribute('combat.power', action.power);
      }

      // Validate match
      const matchValidation = validateMatchForCombat(nk, action.match_id, ctx.userId, span);
      if (!matchValidation.valid) {
        return JSON.stringify({ error: matchValidation.error });
      }
      const match = matchValidation.match;

      const matchState = getOrCreateMatchState(nk, action.match_id, match, logger);

      // Handle turn timeout
      if (isTurnTimedOut(matchState)) {
        const wasForfeited = await handleTurnTimeout(nk, matchState, logger);
        span.setAttribute('combat.turn_timeout', true);

        if (wasForfeited) {
          return JSON.stringify({
            error: 'Match forfeited due to consecutive timeouts',
            forfeit: true,
            winner: matchState.winner,
          });
        }

        return JSON.stringify({
          error: 'Your previous turn timed out, opponent now has their turn',
        });
      }

      // Reset consecutive timeouts when player successfully takes a turn
      matchState.consecutive_timeouts = 0;

      // Anti-cheat validations
      const antiCheatError = validateAntiCheat(ctx, action, matchState, logger);
      if (antiCheatError) {
        const response: { error: string; error_code?: string } = { error: antiCheatError };
        if (
          antiCheatError.startsWith('ANTI_CHEAT') ||
          antiCheatError.startsWith('INVALID') ||
          antiCheatError.startsWith('TIMING')
        ) {
          response.error_code = antiCheatError.split(':')[0];
        }
        return JSON.stringify(response);
      }

      // Final turn check
      if (matchState.current_turn_user_id !== ctx.userId) {
        return JSON.stringify({ error: 'Not your turn' });
      }

      const result = processCombatAction(ctx.userId, action, match, matchState, nk, logger);

      saveMatchState(nk, matchState);

      // Notify both players of the turn result
      notifyMatchStateUpdate(nk, matchState, result, 'turn_taken');

      if (result.winner) {
        updateMatchStatus(nk, match, result.winner, 'health_zero');

        // Persist match result to database
        await persistMatchResult(nk, match, matchState, 'health_zero');

        // Notify both players that match is complete
        notifyMatchStateUpdate(nk, matchState, result, 'match_completed');
      }

      span.setAttribute('combat.result.hit', result.hit);
      setTracingAttribute('combat.result.damage', result.damage);
      if (result.is_crit) {
        span.setAttribute('combat.result.critical', true);
      }

      return JSON.stringify({
        success: true,
        result,
      });
    });
  });
}

/**
 * Registers the get match state RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetMatchState(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_match_state', rpcGetMatchState);
}

/**
 * Retrieves the current state of a PvP match.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match_id
 * @returns JSON string with match state
 *
 * @example
 * // Request payload
 * { "match_id": "match_123" }
 *
 * // Response
 * {
 *   "match_id": "match_123",
 *   "turn": 3,
 *   "current_turn_user_id": "user_456",
 *   "creator_health": 75,
 *   "opponent_health": 50,
 *   ...
 * }
 */
export async function rpcGetMatchState(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  return profileFunction<string>('combat.get_match_state', () => {
    logger.info('Get match state called for user: %s', ctx.userId);

    const validation = validatePayload(ZodSchemas.get_match_state, payload, 'get_match_state');
    if (!validation.success) {
      return createValidationErrorResponse('get_match_state', validation.error);
    }

    const request = validation.data;

    const stateObjects = nk.storageRead([
      {
        collection: 'pvp_match_states',
        key: request.match_id,
        userId: ctx.userId,
      },
    ]);

    if (stateObjects.length === 0) {
      return JSON.stringify({
        error: 'Match state not found',
      });
    }

    return stateObjects[0].value;
  });
}

/**
 * Retrieves or creates match state for a PvP match.
 *
 * @param nk - Nakama server interface
 * @param matchId - Unique identifier for the match
 * @param match - PvP match data
 * @param logger - Nakama logger instance
 * @returns Current match state
 */
function getOrCreateMatchState(
  nk: Runtime.Nakama,
  matchId: string,
  match: PvPMatch,
  logger: Runtime.Logger
): MatchState {
  const stateObjects = nk.storageRead([
    {
      collection: 'pvp_match_states',
      key: matchId,
      userId: match.creator_id,
    },
  ]);

  if (stateObjects.length > 0) {
    // Handle case where value exists but is empty (corrupted data)
    if (!stateObjects[0].value) {
      // Fall through to create new state
    } else {
      const stateResult = safeParse<MatchState>(
        stateObjects[0].value,
        null,
        logger,
        'getOrCreateMatchState'
      );
      if (stateResult.success && stateResult.data) {
        return stateResult.data;
      }
      logger.warn('Failed to parse match state, creating new state');
    }
  }

  const creatorStats = getPlayerStats(nk, match.creator_id, logger);
  const opponentStats = getPlayerStats(nk, match.opponent_id, logger);

  const baseHealth = 100;
  const maxHealth = baseHealth + creatorStats.level * 10;
  const now = Date.now();
  // Each turn has a 5-minute timeout
  const TURN_TIMEOUT_MS = 5 * 60 * 1000;

  const matchState: MatchState = {
    match_id: matchId,
    turn: 1,
    current_turn_user_id: match.creator_id,
    creator_id: match.creator_id,
    opponent_id: match.opponent_id,
    creator_health: maxHealth,
    opponent_health: maxHealth,
    creator_stats: creatorStats,
    opponent_stats: opponentStats,
    status: 'active',
    log: [],
    last_turn_timestamp: now,
    turn_timeout_ms: TURN_TIMEOUT_MS,
    consecutive_timeouts: 0,
  };

  return matchState;
}

/**
 * Processes a combat action and calculates results.
 *
 * @param userId - ID of the player performing the action
 * @param action - Combat action data
 * @param match - PvP match data
 * @param matchState - Current match state
 * @param _nk - Nakama server interface
 * @param _logger - Nakama logger instance
 * @returns Combat result with hit/miss and damage calculations
 */
function processCombatAction(
  userId: string,
  action: CombatAction,
  match: PvPMatch,
  matchState: MatchState,
  _nk: Runtime.Nakama,
  _logger: Runtime.Logger
): CombatResult {
  const isCreator = userId === matchState.creator_id;
  const attackerStats = isCreator ? matchState.creator_stats : matchState.opponent_stats;
  const defenderStats = isCreator ? matchState.opponent_stats : matchState.creator_stats;

  const result: CombatResult = {
    success: true,
    hit: false,
    damage: 0,
    is_crit: false,
    attacker_stats: attackerStats,
    defender_stats: defenderStats,
    match_status: 'active',
  };

  if (action.action_type === 'shoot') {
    const hit = calculateHit(attackerStats, defenderStats);

    if (hit) {
      const damage = calculateDamage(attackerStats, defenderStats);
      const isCrit = calculateCrit(attackerStats.stats.crit_rate);
      const finalDamage = isCrit ? damage * 2 : damage;

      result.hit = true;
      result.damage = finalDamage;
      result.is_crit = isCrit;

      if (isCreator) {
        matchState.opponent_health = Math.max(0, matchState.opponent_health - finalDamage);
      } else {
        matchState.creator_health = Math.max(0, matchState.creator_health - finalDamage);
      }

      // Issue #1093: feed the existing combat-damage histogram and combat-action
      // counter so the dashboards (issue #1092) stop reporting zeros for events
      // that already happen.
      recordCombatAction('shoot', isCrit ? 'crit' : 'hit');
      recordDamageDealt('opponent', finalDamage);

      const logEntry: CombatLogEntry = {
        turn: matchState.turn,
        attacker_id: userId,
        action: action.action_type,
        hit: true,
        damage: finalDamage,
        is_crit: isCrit,
        timestamp: Date.now(),
      };

      matchState.log.push(logEntry);

      // Log hit resolution for fairness telemetry
      const hitResolutionEvent: HitResolutionEvent = {
        event_id: `hit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        match_id: match.match_id,
        timestamp: Date.now(),
        attacker_id: userId,
        defender_id: isCreator ? matchState.opponent_id : matchState.creator_id,
        hit: true,
        damage: finalDamage,
        is_crit: isCrit,
        angle: action.angle,
        power: action.power,
        attacker_health: isCreator ? matchState.creator_health : matchState.opponent_health,
        defender_health: isCreator ? matchState.opponent_health : matchState.creator_health,
        turn: matchState.turn,
      };

      // Non-blocking: log to telemetry but don't wait
      void logHitResolution(_nk, hitResolutionEvent);

      if (matchState.creator_health <= 0) {
        result.winner = matchState.opponent_id;
        result.match_status = 'completed';
        matchState.status = 'completed';
        matchState.winner = matchState.opponent_id;
      } else if (matchState.opponent_health <= 0) {
        result.winner = matchState.creator_id;
        result.match_status = 'completed';
        matchState.status = 'completed';
        matchState.winner = matchState.creator_id;
      }
    } else {
      // Issue #1093: count misses too (issue #1092 dashboards split actions
      // by result; without this the "miss" label series stays absent).
      recordCombatAction('shoot', 'miss');

      const logEntry: CombatLogEntry = {
        turn: matchState.turn,
        attacker_id: userId,
        action: action.action_type,
        hit: false,
        damage: 0,
        is_crit: false,
        timestamp: Date.now(),
      };

      matchState.log.push(logEntry);

      // Log miss for fairness telemetry
      const hitResolutionEvent: HitResolutionEvent = {
        event_id: `miss_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        match_id: match.match_id,
        timestamp: Date.now(),
        attacker_id: userId,
        defender_id: isCreator ? matchState.opponent_id : matchState.creator_id,
        hit: false,
        damage: 0,
        is_crit: false,
        angle: action.angle,
        power: action.power,
        attacker_health: isCreator ? matchState.creator_health : matchState.opponent_health,
        defender_health: isCreator ? matchState.opponent_health : matchState.creator_health,
        turn: matchState.turn,
      };

      // Non-blocking: log to telemetry but don't wait
      void logHitResolution(_nk, hitResolutionEvent);
    }
  }

  matchState.turn++;
  matchState.current_turn_user_id = isCreator ? matchState.opponent_id : matchState.creator_id;

  return result;
}

/**
 * Calculates whether an attack hits based on defender's dodge chance.
 *
 * @param attackerStats - Stats of the attacking player
 * @param defenderStats - Stats of the defending player
 * @returns True if attack hits, false if it misses
 */
function calculateHit(attackerStats: PlayerStats, defenderStats: PlayerStats): boolean {
  const dodgeChance = defenderStats.stats.dodge / 100.0;
  const hitChance = 1.0 - dodgeChance;
  const roll = Math.random();

  return roll <= hitChance;
}

/**
 * Calculates damage dealt based on attacker's attack and defender's defense.
 *
 * @param attackerStats - Stats of the attacking player
 * @param defenderStats - Stats of the defending player
 * @returns Calculated damage amount
 */
function calculateDamage(attackerStats: PlayerStats, defenderStats: PlayerStats): number {
  const baseDamage = 10 + attackerStats.stats.attack * 0.5;
  const defenseReduction = defenderStats.stats.defense * 0.3;
  const finalDamage = Math.max(1, baseDamage - defenseReduction);

  return Math.floor(finalDamage);
}

/**
 * Determines if an attack is a critical hit based on crit rate.
 *
 * @param critRate - Critical hit rate percentage
 * @returns True if attack is critical, false otherwise
 */
function calculateCrit(critRate: number): boolean {
  const critChance = critRate / 100.0;
  const roll = Math.random();

  return roll <= critChance;
}

/**
 * Retrieves player statistics for combat calculations.
 * Applies gear modifier bonuses from equipped gear.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player to retrieve stats for
 * @param logger - Nakama logger instance
 * @returns Player stats with gear modifier bonuses applied
 */
function getPlayerStats(nk: Runtime.Nakama, userId: string, logger: Runtime.Logger): PlayerStats {
  const objects = nk.storageRead([
    {
      collection: 'player_stats',
      key: userId,
      userId: userId,
    },
  ]);

  let baseStats: PlayerStats;

  if (objects.length === 0) {
    baseStats = {
      level: 1,
      xp: 0,
      stats: {
        attack: 10,
        defense: 10,
        dodge: 10,
        crit_rate: 5,
      },
    };
  } else {
    const statsResult = safeParse<PlayerStats>(objects[0].value, null, logger, 'getPlayerStats');
    if (!statsResult.success || !statsResult.data) {
      logger.warn('Failed to parse player stats for user %s, using defaults', userId);
      baseStats = {
        level: 1,
        xp: 0,
        stats: {
          attack: 10,
          defense: 10,
          dodge: 10,
          crit_rate: 5,
        },
      };
    } else {
      baseStats = statsResult.data;
    }
  }

  // Apply gear modifier bonuses from equipped gear
  const inventory = getPlayerInventory(nk, userId, logger);
  const gearBonuses = getEquippedGearModifierBonuses(inventory);

  // Return stats with gear bonuses applied
  return {
    ...baseStats,
    stats: {
      attack: baseStats.stats.attack + (gearBonuses['attack'] || 0),
      defense: baseStats.stats.defense + (gearBonuses['defense'] || 0),
      dodge: baseStats.stats.dodge + (gearBonuses['dodge'] || 0),
      crit_rate: baseStats.stats.crit_rate + (gearBonuses['crit_rate'] || 0),
    },
  };
}

/**
 * Saves the current match state to storage.
 *
 * @param nk - Nakama server interface
 * @param matchState - Match state to save
 */
function saveMatchState(nk: Runtime.Nakama, matchState: MatchState): void {
  nk.storageWrite([
    {
      collection: 'pvp_match_states',
      key: matchState.match_id,
      userId: matchState.creator_id,
      value: JSON.stringify(matchState),
    },
  ]);
}

/**
 * Updates match status when a winner is determined.
 *
 * Marks the match completed with a server-declared winner (ADR-0002). The
 * match remains unsettled (no settled_at) — Elo/XP/reward settlement is
 * applied by the matchmaker settlement path keyed off this declaration.
 *
 * @param nk - Nakama server interface
 * @param match - PvP match data
 * @param winner - ID of the winning player (server-derived)
 * @param endReason - Server-side reason the match ended
 */
function updateMatchStatus(
  nk: Runtime.Nakama,
  match: PvPMatch,
  winner: string,
  endReason: 'health_zero' | 'forfeit' | 'timeout' | 'disconnect'
): void {
  match.status = 'completed';
  match.winner = winner;
  match.end_reason = endReason;
  match.updated_at = Date.now();

  nk.storageWrite([
    {
      collection: 'pvp_matches',
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match),
    },
  ]);
}

/**
 * Checks if a match has exceeded its expiration time.
 *
 * @param match - PvP match data
 * @returns True if match has expired, false otherwise
 */
function isMatchExpired(match: PvPMatch): boolean {
  return Date.now() > match.expires_at;
}

/**
 * Checks if the current turn has exceeded its timeout.
 *
 * @param matchState - Current match state
 * @returns True if turn has timed out, false otherwise
 */
function isTurnTimedOut(matchState: MatchState): boolean {
  const timeSinceLastTurn = Date.now() - matchState.last_turn_timestamp;
  return timeSinceLastTurn > matchState.turn_timeout_ms;
}

/**
 * Notifies opponent of a forfeit via Nakama notifications.
 *
 * @param nk - Nakama server interface
 * @param matchState - Current match state
 * @param opponentId - ID of the opponent to notify
 * @param forfeitReason - Reason for forfeit (timeout, disconnect, etc.)
 */
function notifyOpponentOfForfeit(
  nk: Runtime.Nakama,
  matchState: MatchState,
  opponentId: string,
  forfeitReason: string
): void {
  try {
    const winnerId = matchState.winner || opponentId;
    const loserId =
      winnerId === matchState.creator_id ? matchState.opponent_id : matchState.creator_id;

    nk.notificationSend(
      opponentId,
      'Match Forfeited',
      {
        match_id: matchState.match_id,
        forfeit_reason: forfeitReason,
        winner_id: winnerId,
        loser_id: loserId,
        message: `Your opponent has forfeited the match. You win!`,
      },
      2, // Custom notification code for match forfeit
      true, // persist
      '' // senderId (empty for server)
    );
  } catch (error) {
    // Log error but don't fail the operation
    logger.error('Failed to send forfeit notification', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      matchId: matchState.match_id,
      opponentId,
    });
  }
}

/**
 * Notifies both players of match state updates.
 *
 * @param nk - Nakama server interface
 * @param matchState - Current match state
 * @param result - Combat result from the action
 * @param reason - Reason for notification (turn_taken, match_completed, etc.)
 */
function notifyMatchStateUpdate(
  nk: Runtime.Nakama,
  matchState: MatchState,
  result?: CombatResult,
  reason: 'turn_taken' | 'match_completed' | 'health_update' = 'turn_taken'
): void {
  try {
    const creatorId = matchState.creator_id;
    const opponentId = matchState.opponent_id;

    // Determine who took the last action
    const lastActionTakerId =
      matchState.current_turn_user_id === creatorId ? opponentId : creatorId;

    const notificationData = {
      match_id: matchState.match_id,
      turn: matchState.turn,
      current_turn_user_id: matchState.current_turn_user_id,
      creator_health: matchState.creator_health,
      opponent_health: matchState.opponent_health,
      status: matchState.status,
      reason,
      timestamp: Date.now(),
    };

    // If result provided, include combat data
    if (result) {
      Object.assign(notificationData, {
        hit: result.hit,
        damage: result.damage,
        is_crit: result.is_crit,
        attacker_id: lastActionTakerId,
      });
    }

    // If match completed, include winner
    if (matchState.status === 'completed' && matchState.winner) {
      Object.assign(notificationData, {
        winner_id: matchState.winner,
        winner_name: matchState.winner === creatorId ? 'You (Creator)' : 'Opponent',
      });
    }

    // Send to creator
    const creatorMessage = buildNotificationMessage(creatorId, matchState, result, reason);
    nk.notificationSend(
      creatorId,
      'PvP Match Update',
      {
        ...notificationData,
        message: creatorMessage,
      },
      3, // Custom notification code for match state update
      false, // don't persist (transient game state)
      '' // senderId (empty for server)
    );

    // Send to opponent
    const opponentMessage = buildNotificationMessage(opponentId, matchState, result, reason);
    nk.notificationSend(
      opponentId,
      'PvP Match Update',
      {
        ...notificationData,
        message: opponentMessage,
      },
      3, // Custom notification code for match state update
      false, // don't persist (transient game state)
      '' // senderId (empty for server)
    );

    logger.info('Match state update notification sent', {
      matchId: matchState.match_id,
      reason,
      creatorId,
      opponentId,
    });
  } catch (error) {
    logger.error('Failed to send match state update notification', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      matchId: matchState.match_id,
      reason,
    });
  }
}

/**
 * Builds a user-friendly notification message based on match state.
 */
function buildNotificationMessage(
  userId: string,
  matchState: MatchState,
  result?: CombatResult,
  reason: string = 'turn_taken'
): string {
  const isCreator = userId === matchState.creator_id;
  const opponentId = isCreator ? matchState.opponent_id : matchState.creator_id;
  const myHealth = isCreator ? matchState.creator_health : matchState.opponent_health;
  const opponentHealth = isCreator ? matchState.opponent_health : matchState.creator_health;
  const isMyTurn = matchState.current_turn_user_id === userId;

  if (reason === 'match_completed') {
    if (matchState.winner === userId) {
      return '🎉 Victory! You won the match!';
    } else {
      return '😔 Defeat! You lost the match.';
    }
  }

  if (reason === 'turn_taken') {
    if (result) {
      if (result.hit) {
        const critText = result.is_crit ? ' (CRITICAL!)' : '';
        if (isCreator) {
          return result.attacker_stats === matchState.creator_stats
            ? `Your shot hit! Dealt ${result.damage} damage.${critText} Health: You ${myHealth} - Opponent ${opponentHealth}`
            : `Opponent hit you! Took ${result.damage} damage.${critText} Health: You ${myHealth} - Opponent ${opponentHealth}`;
        } else {
          return result.attacker_stats === matchState.opponent_stats
            ? `Your shot hit! Dealt ${result.damage} damage.${critText} Health: You ${myHealth} - Opponent ${opponentHealth}`
            : `Opponent hit you! Took ${result.damage} damage.${critText} Health: You ${myHealth} - Opponent ${opponentHealth}`;
        }
      } else {
        return `Shot missed! Health: You ${myHealth} - Opponent ${opponentHealth}`;
      }
    }
  }

  // Default message
  return isMyTurn ? "It's your turn!" : 'Opponent is playing...';
}

/**
 * Handles a player disconnect/leave match request.
 * This allows graceful handling of disconnections.
 */
export async function rpcPlayerDisconnect(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  return traceAsync('rpc.player_disconnect', async (span) => {
    span.setAttribute('user.id', ctx.userId || 'anonymous');

    return profileFunction<string>('combat.player_disconnect', async () => {
      logger.info('Player disconnect called for user: %s', ctx.userId);

      const validation = validatePayload(
        ZodSchemas.player_disconnect,
        payload,
        'player_disconnect'
      );
      if (!validation.success) {
        span.setAttribute('validation.error', true);
        return createValidationErrorResponse('player_disconnect', validation.error);
      }

      const { match_id, reason } = validation.data;

      // Read match
      const matchObjects = nk.storageRead([
        {
          collection: 'pvp_matches',
          key: match_id,
          userId: ctx.userId,
        },
      ]);

      if (matchObjects.length === 0) {
        span.setAttribute('error', true);
        span.setAttribute('error.message', 'Match not found');
        return JSON.stringify({ error: 'Match not found' });
      }

      const matchResult = safeParse<PvPMatch>(
        matchObjects[0].value,
        null,
        logger,
        'rpcForfeitMatch:match'
      );
      if (!matchResult.success || !matchResult.data) {
        return JSON.stringify({ error: 'Failed to parse match data' });
      }
      const match: PvPMatch = matchResult.data;

      if (match.status !== 'active') {
        return JSON.stringify({ error: 'Match is not active' });
      }

      if (match.creator_id !== ctx.userId && match.opponent_id !== ctx.userId) {
        return JSON.stringify({ error: 'Not a participant in this match' });
      }

      // Read match state
      const stateObjects = nk.storageRead([
        {
          collection: 'pvp_match_states',
          key: match_id,
          userId: match.creator_id,
        },
      ]);

      if (stateObjects.length === 0) {
        return JSON.stringify({ error: 'Match state not found' });
      }

      // Handle case where value exists but is empty (corrupted data)
      if (!stateObjects[0].value) {
        return JSON.stringify({ error: 'Match state not found' });
      }

      const stateResult = safeParse<MatchState>(
        stateObjects[0].value,
        null,
        logger,
        'rpcForfeitMatch:matchState'
      );
      if (!stateResult.success || !stateResult.data) {
        return JSON.stringify({ error: 'Failed to parse match state' });
      }
      const matchState: MatchState = stateResult.data;

      // Determine winner (opponent)
      const winnerId = ctx.userId === match.creator_id ? match.opponent_id : match.creator_id;
      const loserId = ctx.userId;

      // Update match state
      matchState.status = 'completed';
      matchState.winner = winnerId;
      matchState.forfeit_reason = reason || 'disconnect';

      // Add forfeit entry to log
      const forfeitLogEntry: CombatLogEntry = {
        turn: matchState.turn,
        attacker_id: loserId,
        action: 'forfeit',
        hit: false,
        damage: 0,
        is_crit: false,
        timestamp: Date.now(),
      };
      matchState.log.push(forfeitLogEntry);

      // Save match state
      saveMatchState(nk, matchState);

      // Update match status (end reason mirrors persistMatchResult's mapping)
      updateMatchStatus(nk, match, winnerId, reason === 'timeout' ? 'timeout' : 'disconnect');

      // Persist match result to database
      await persistMatchResult(
        nk,
        match,
        matchState,
        reason === 'timeout' ? 'timeout' : 'disconnect'
      );

      // Log disconnect event for fairness telemetry (if not a timeout)
      if (reason !== 'timeout') {
        const disconnectEvent = {
          event_id: `dc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          match_id: match.match_id,
          timestamp: Date.now(),
          user_id: ctx.userId,
          opponent_id: winnerId,
          disconnect_reason: reason || 'disconnect',
          match_status: match.status,
          match_type: match.match_type,
          current_turn_user_id: matchState.current_turn_user_id,
          was_winning:
            ctx.userId === matchState.creator_id
              ? matchState.creator_health > matchState.opponent_health
              : matchState.opponent_health > matchState.creator_health,
          health_before_disconnect:
            ctx.userId === matchState.creator_id
              ? matchState.creator_health
              : matchState.opponent_health,
          opponent_health_before_disconnect:
            ctx.userId === matchState.creator_id
              ? matchState.opponent_health
              : matchState.creator_health,
        };

        // Non-blocking: log to telemetry
        void logDisconnect(nk, disconnectEvent);
      }

      // Notify opponent
      notifyOpponentOfForfeit(nk, matchState, winnerId, reason || 'disconnect');

      // Notify both players of match completion
      notifyMatchStateUpdate(nk, matchState, undefined, 'match_completed');

      return JSON.stringify({
        success: true,
        forfeit: true,
        winner: winnerId,
        reason: reason || 'disconnect',
      });
    });
  });
}

/**
 * Persists match result to the database for historical tracking.
 *
 * @param nk - Nakama server interface
 * @param match - PvP match data
 * @param matchState - Final match state
 * @param endReason - Reason match ended (health_zero, forfeit, timeout, disconnect)
 * @returns Promise resolving to success or error
 */
async function persistMatchResult(
  nk: Runtime.Nakama,
  match: PvPMatch,
  matchState: MatchState,
  endReason: 'health_zero' | 'forfeit' | 'timeout' | 'disconnect'
): Promise<{ success: boolean; error?: string }> {
  try {
    const winnerId = matchState.winner || match.winner;
    if (!winnerId) {
      return { success: false, error: 'No winner determined' };
    }

    const loserId = winnerId === match.creator_id ? match.opponent_id : match.creator_id;
    const currentSeason = getCurrentSeason();

    // Calculate match duration
    const durationSeconds = Math.floor((Date.now() - match.created_at) / 1000);

    // Get Elo ratings from leaderboard (if ranked match)
    let creatorOldElo: number | undefined;
    let creatorNewElo: number | undefined;
    let opponentOldElo: number | undefined;
    let opponentNewElo: number | undefined;

    if (match.match_type === 'ranked') {
      try {
        const winnerEntry = getLeaderboardEntry(nk, winnerId, currentSeason.season_id);
        const loserEntry = getLeaderboardEntry(nk, loserId, currentSeason.season_id);

        if (winnerId === match.creator_id) {
          creatorOldElo = winnerEntry ? winnerEntry.score : undefined;
          opponentOldElo = loserEntry ? loserEntry.score : undefined;
        } else {
          creatorOldElo = loserEntry ? loserEntry.score : undefined;
          opponentOldElo = winnerEntry ? winnerEntry.score : undefined;
        }

        // New Elo is calculated after the match, so we need to store it
        // This will be updated in a separate call from matchmaker
      } catch (e) {
        logger.warn('Failed to get Elo ratings for match result', {
          error: e instanceof Error ? e.message : String(e),
          matchId: match.match_id,
        });
      }
    }

    await nk.dbQuery(
      `INSERT INTO match_results (
        match_id, creator_id, opponent_id, winner_id, loser_id,
        match_type, is_punch_up, creator_rank, opponent_rank,
        creator_old_elo, creator_new_elo, opponent_old_elo, opponent_new_elo,
        total_turns, duration_seconds, end_reason, combat_log,
        creator_health_remaining, opponent_health_remaining,
        creator_stats_at_match, opponent_stats_at_match, season_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [
        match.match_id,
        match.creator_id,
        match.opponent_id,
        winnerId,
        loserId,
        match.match_type,
        match.is_punch_up,
        match.creator_rank,
        match.opponent_rank,
        creatorOldElo || null,
        creatorNewElo || null,
        opponentOldElo || null,
        opponentNewElo || null,
        matchState.turn,
        durationSeconds,
        endReason,
        JSON.stringify(matchState.log),
        matchState.creator_health,
        matchState.opponent_health,
        JSON.stringify(matchState.creator_stats),
        JSON.stringify(matchState.opponent_stats),
        currentSeason.season_id,
      ]
    );

    logger.info('Match result persisted to database', {
      matchId: match.match_id,
      winnerId,
      loserId,
      matchType: match.match_type,
      endReason,
      turns: matchState.turn,
      durationSeconds,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to persist match result', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      matchId: match.match_id,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Registers the player disconnect RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcPlayerDisconnect(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/player_disconnect', rpcPlayerDisconnect);
}
