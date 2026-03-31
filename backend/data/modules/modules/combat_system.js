"use strict";
/**
 * Combat System module.
 * @fileoverview Manages PvP combat actions and turn processing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRpcSubmitCombatAction = registerRpcSubmitCombatAction;
exports.rpcSubmitCombatAction = rpcSubmitCombatAction;
exports.registerRpcGetMatchState = registerRpcGetMatchState;
exports.rpcGetMatchState = rpcGetMatchState;
exports.rpcPlayerDisconnect = rpcPlayerDisconnect;
exports.registerRpcPlayerDisconnect = registerRpcPlayerDisconnect;
var tslib_1 = require("tslib");
var logger_1 = require("../config/logger");
var tracing_1 = require("../utils/tracing");
var anti_cheat_1 = require("./anti_cheat");
var profiling_1 = require("./profiling");
var validation_1 = require("./validation");
var gear_system_1 = require("./gear_system");
// Match-level inactivity timeout: 2 minutes of inactivity results in auto-forfeit
var MATCH_INACTIVE_TIMEOUT_MS = 2 * 60 * 1000;
// Maximum consecutive turn timeouts before auto-forfeit
var MAX_CONSECUTIVE_TIMEOUTS = 2;
/**
 * Registers the submit combat action RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcSubmitCombatAction(initializer) {
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
function validateMatchForCombat(nk, matchId, userId, span) {
    var matchObjects = nk.storageRead([
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
    var match = JSON.parse(matchObjects[0].value);
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
    return { valid: true, match: match };
}
/**
 * Handles turn timeout by switching to opponent's turn
 * Returns true if match was forfeited due to consecutive timeouts
 */
function handleTurnTimeout(nk, matchState, logger) {
    var timedOutUserId = matchState.current_turn_user_id;
    var opponentId = timedOutUserId === matchState.creator_id ? matchState.opponent_id : matchState.creator_id;
    logger.info('Turn timed out for user: %s in match: %s (consecutive timeouts: %d)', timedOutUserId, matchState.match_id, matchState.consecutive_timeouts + 1);
    // Increment consecutive timeouts
    matchState.consecutive_timeouts++;
    // Check if we should auto-forfeit
    if (matchState.consecutive_timeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
        logger.info('Auto-forfeit triggered for match: %s due to consecutive timeouts', matchState.match_id);
        // Determine winner (the player who didn't timeout)
        var winnerId = opponentId;
        var loserId = timedOutUserId;
        // Update match state
        matchState.status = 'completed';
        matchState.winner = winnerId;
        matchState.forfeit_reason = 'timeout';
        // Add forfeit entry to log
        var forfeitLogEntry = {
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
        var matchObjects = nk.storageRead([
            {
                collection: 'pvp_matches',
                key: matchState.match_id,
                userId: matchState.creator_id,
            },
        ]);
        if (matchObjects.length > 0) {
            var match = JSON.parse(matchObjects[0].value);
            updateMatchStatus(nk, match, winnerId);
        }
        // Notify opponent of forfeit
        notifyOpponentOfForfeit(nk, matchState, opponentId, 'timeout');
        return true;
    }
    // Switch to opponent's turn
    matchState.current_turn_user_id = opponentId;
    matchState.last_turn_timestamp = Date.now();
    saveMatchState(nk, matchState);
    return false;
}
/**
 * Performs anti-cheat validations for combat action
 */
function validateAntiCheat(ctx, action, matchState, logger) {
    // 1. Verify request signature if anti-cheat fields are provided
    if (action.requestId && action.timestamp && action.signature && action.nonce) {
        var signatureData = {
            requestId: action.requestId,
            timestamp: action.timestamp,
            signature: action.signature,
            nonce: action.nonce,
        };
        var payloadForSig = JSON.stringify({
            match_id: action.match_id,
            action_type: action.action_type,
            angle: action.angle,
            power: action.power,
        });
        var sigResult = (0, anti_cheat_1.verifyRequestSignature)(ctx, payloadForSig, signatureData, 'submit_combat_action');
        if (!sigResult.valid) {
            logger.warn('Anti-cheat signature verification failed for user: %s', ctx.userId);
            return 'ANTI_CHEAT_VIOLATION: Invalid request signature';
        }
    }
    // 2. Validate combat action parameters (angle, power)
    var requestId = action.requestId || "req_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(7));
    var paramValidation = (0, anti_cheat_1.validateCombatActionParameters)(action.angle, action.power, matchState.current_turn_user_id, ctx.userId, 'submit_combat_action', requestId);
    if (!paramValidation.valid) {
        var outOfTurnViolation = paramValidation.violations.some(function (v) { return v.violationType === 'out_of_turn'; });
        if (outOfTurnViolation) {
            logger.warn('Out of turn action from user: %s', ctx.userId);
            return 'Not your turn';
        }
        logger.warn('Invalid combat parameters from user: %s', ctx.userId);
        return 'INVALID_PARAMETERS: Combat parameters out of valid range';
    }
    // 3. Detect timing attacks (rapid requests)
    if ((0, anti_cheat_1.detectTimingAttack)(ctx.userId, 'submit_combat_action', requestId)) {
        logger.warn('Timing attack detected for user: %s', ctx.userId);
        return 'TIMING_ANOMALY: Suspicious request pattern detected';
    }
    return null;
}
function rpcSubmitCombatAction(ctx, logger, nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, (0, tracing_1.traceAsync)('rpc.submit_combat_action', function (span) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        span.setAttribute('user.id', ctx.userId || 'anonymous');
                        return [2 /*return*/, (0, profiling_1.profileFunction)('combat.submit_combat_action', function () {
                                logger.info('Submit combat action called for user: %s', ctx.userId);
                                (0, tracing_1.setTracingAttribute)('rpc.payload_size', payload.length);
                                var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.submit_combat_action, payload, 'submit_combat_action');
                                if (!validation.success) {
                                    span.setAttribute('validation.error', true);
                                    return (0, validation_1.createValidationErrorResponse)('submit_combat_action', validation.error);
                                }
                                var action = validation.data;
                                span.setAttribute('match.id', action.match_id);
                                span.setAttribute('combat.action_type', action.action_type);
                                (0, tracing_1.setTracingAttribute)('combat.angle', action.angle);
                                if (action.power !== undefined) {
                                    (0, tracing_1.setTracingAttribute)('combat.power', action.power);
                                }
                                // Validate match
                                var matchValidation = validateMatchForCombat(nk, action.match_id, ctx.userId, span);
                                if (!matchValidation.valid) {
                                    return JSON.stringify({ error: matchValidation.error });
                                }
                                var match = matchValidation.match;
                                var matchState = getOrCreateMatchState(nk, action.match_id, match, logger);
                                // Handle turn timeout
                                if (isTurnTimedOut(matchState)) {
                                    var wasForfeited = handleTurnTimeout(nk, matchState, logger);
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
                                var antiCheatError = validateAntiCheat(ctx, action, matchState, logger);
                                if (antiCheatError) {
                                    var response = { error: antiCheatError };
                                    if (antiCheatError.startsWith('ANTI_CHEAT') ||
                                        antiCheatError.startsWith('INVALID') ||
                                        antiCheatError.startsWith('TIMING')) {
                                        response.error_code = antiCheatError.split(':')[0];
                                    }
                                    return JSON.stringify(response);
                                }
                                // Final turn check
                                if (matchState.current_turn_user_id !== ctx.userId) {
                                    return JSON.stringify({ error: 'Not your turn' });
                                }
                                var result = processCombatAction(ctx.userId, action, match, matchState, nk, logger);
                                saveMatchState(nk, matchState);
                                if (result.winner) {
                                    updateMatchStatus(nk, match, result.winner);
                                }
                                span.setAttribute('combat.result.hit', result.hit);
                                (0, tracing_1.setTracingAttribute)('combat.result.damage', result.damage);
                                if (result.is_crit) {
                                    span.setAttribute('combat.result.critical', true);
                                }
                                return JSON.stringify({
                                    success: true,
                                    result: result,
                                });
                            })];
                    });
                }); })];
        });
    });
}
/**
 * Registers the get match state RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetMatchState(initializer) {
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
function rpcGetMatchState(ctx, logger, nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, (0, profiling_1.profileFunction)('combat.get_match_state', function () {
                    logger.info('Get match state called for user: %s', ctx.userId);
                    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_match_state, payload, 'get_match_state');
                    if (!validation.success) {
                        return (0, validation_1.createValidationErrorResponse)('get_match_state', validation.error);
                    }
                    var request = validation.data;
                    var stateObjects = nk.storageRead([
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
                })];
        });
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
function getOrCreateMatchState(nk, matchId, match, logger) {
    var stateObjects = nk.storageRead([
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
        }
        else {
            return JSON.parse(stateObjects[0].value);
        }
    }
    var creatorStats = getPlayerStats(nk, match.creator_id, logger);
    var opponentStats = getPlayerStats(nk, match.opponent_id, logger);
    var baseHealth = 100;
    var maxHealth = baseHealth + creatorStats.level * 10;
    var now = Date.now();
    // Each turn has a 5-minute timeout
    var TURN_TIMEOUT_MS = 5 * 60 * 1000;
    var matchState = {
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
function processCombatAction(userId, action, match, matchState, _nk, _logger) {
    var isCreator = userId === matchState.creator_id;
    var attackerStats = isCreator ? matchState.creator_stats : matchState.opponent_stats;
    var defenderStats = isCreator ? matchState.opponent_stats : matchState.creator_stats;
    var result = {
        success: true,
        hit: false,
        damage: 0,
        is_crit: false,
        attacker_stats: attackerStats,
        defender_stats: defenderStats,
        match_status: 'active',
    };
    if (action.action_type === 'shoot') {
        var hit = calculateHit(attackerStats, defenderStats);
        if (hit) {
            var damage = calculateDamage(attackerStats, defenderStats);
            var isCrit = calculateCrit(attackerStats.stats.crit_rate);
            var finalDamage = isCrit ? damage * 2 : damage;
            result.hit = true;
            result.damage = finalDamage;
            result.is_crit = isCrit;
            if (isCreator) {
                matchState.opponent_health = Math.max(0, matchState.opponent_health - finalDamage);
            }
            else {
                matchState.creator_health = Math.max(0, matchState.creator_health - finalDamage);
            }
            var logEntry = {
                turn: matchState.turn,
                attacker_id: userId,
                action: action.action_type,
                hit: true,
                damage: finalDamage,
                is_crit: isCrit,
                timestamp: Date.now(),
            };
            matchState.log.push(logEntry);
            if (matchState.creator_health <= 0) {
                result.winner = matchState.opponent_id;
                result.match_status = 'completed';
                matchState.status = 'completed';
                matchState.winner = matchState.opponent_id;
            }
            else if (matchState.opponent_health <= 0) {
                result.winner = matchState.creator_id;
                result.match_status = 'completed';
                matchState.status = 'completed';
                matchState.winner = matchState.creator_id;
            }
        }
        else {
            var logEntry = {
                turn: matchState.turn,
                attacker_id: userId,
                action: action.action_type,
                hit: false,
                damage: 0,
                is_crit: false,
                timestamp: Date.now(),
            };
            matchState.log.push(logEntry);
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
function calculateHit(attackerStats, defenderStats) {
    var dodgeChance = defenderStats.stats.dodge / 100.0;
    var hitChance = 1.0 - dodgeChance;
    var roll = Math.random();
    return roll <= hitChance;
}
/**
 * Calculates damage dealt based on attacker's attack and defender's defense.
 *
 * @param attackerStats - Stats of the attacking player
 * @param defenderStats - Stats of the defending player
 * @returns Calculated damage amount
 */
function calculateDamage(attackerStats, defenderStats) {
    var baseDamage = 10 + attackerStats.stats.attack * 0.5;
    var defenseReduction = defenderStats.stats.defense * 0.3;
    var finalDamage = Math.max(1, baseDamage - defenseReduction);
    return Math.floor(finalDamage);
}
/**
 * Determines if an attack is a critical hit based on crit rate.
 *
 * @param critRate - Critical hit rate percentage
 * @returns True if attack is critical, false otherwise
 */
function calculateCrit(critRate) {
    var critChance = critRate / 100.0;
    var roll = Math.random();
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
function getPlayerStats(nk, userId, logger) {
    var objects = nk.storageRead([
        {
            collection: 'player_stats',
            key: userId,
            userId: userId,
        },
    ]);
    var baseStats;
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
    }
    else {
        baseStats = JSON.parse(objects[0].value);
    }
    // Apply gear modifier bonuses from equipped gear
    var inventory = (0, gear_system_1.getPlayerInventory)(nk, userId, logger);
    var gearBonuses = (0, gear_system_1.getEquippedGearModifierBonuses)(inventory);
    // Return stats with gear bonuses applied
    return tslib_1.__assign(tslib_1.__assign({}, baseStats), { stats: {
            attack: baseStats.stats.attack + (gearBonuses['attack'] || 0),
            defense: baseStats.stats.defense + (gearBonuses['defense'] || 0),
            dodge: baseStats.stats.dodge + (gearBonuses['dodge'] || 0),
            crit_rate: baseStats.stats.crit_rate + (gearBonuses['crit_rate'] || 0),
        } });
}
/**
 * Saves the current match state to storage.
 *
 * @param nk - Nakama server interface
 * @param matchState - Match state to save
 */
function saveMatchState(nk, matchState) {
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
 * @param nk - Nakama server interface
 * @param match - PvP match data
 * @param winner - ID of the winning player
 */
function updateMatchStatus(nk, match, winner) {
    match.status = 'completed';
    match.winner = winner;
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
function isMatchExpired(match) {
    return Date.now() > match.expires_at;
}
/**
 * Checks if the current turn has exceeded its timeout.
 *
 * @param matchState - Current match state
 * @returns True if turn has timed out, false otherwise
 */
function isTurnTimedOut(matchState) {
    var timeSinceLastTurn = Date.now() - matchState.last_turn_timestamp;
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
function notifyOpponentOfForfeit(nk, matchState, opponentId, forfeitReason) {
    try {
        var winnerId = matchState.winner || opponentId;
        var loserId = winnerId === matchState.creator_id ? matchState.opponent_id : matchState.creator_id;
        nk.notificationSend(opponentId, 'Match Forfeited', {
            match_id: matchState.match_id,
            forfeit_reason: forfeitReason,
            winner_id: winnerId,
            loser_id: loserId,
            message: "Your opponent has forfeited the match. You win!",
        }, 2, // Custom notification code for match forfeit
        true, // persist
        '' // senderId (empty for server)
        );
    }
    catch (error) {
        // Log error but don't fail the operation
        logger_1.logger.error('Failed to send forfeit notification', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            matchId: matchState.match_id,
            opponentId: opponentId,
        });
    }
}
/**
 * Handles a player disconnect/leave match request.
 * This allows graceful handling of disconnections.
 */
function rpcPlayerDisconnect(ctx, logger, nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, (0, tracing_1.traceAsync)('rpc.player_disconnect', function (span) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        span.setAttribute('user.id', ctx.userId || 'anonymous');
                        return [2 /*return*/, (0, profiling_1.profileFunction)('combat.player_disconnect', function () {
                                logger.info('Player disconnect called for user: %s', ctx.userId);
                                var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.player_disconnect, payload, 'player_disconnect');
                                if (!validation.success) {
                                    span.setAttribute('validation.error', true);
                                    return (0, validation_1.createValidationErrorResponse)('player_disconnect', validation.error);
                                }
                                var _a = validation.data, match_id = _a.match_id, reason = _a.reason;
                                // Read match
                                var matchObjects = nk.storageRead([
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
                                var match = JSON.parse(matchObjects[0].value);
                                if (match.status !== 'active') {
                                    return JSON.stringify({ error: 'Match is not active' });
                                }
                                if (match.creator_id !== ctx.userId && match.opponent_id !== ctx.userId) {
                                    return JSON.stringify({ error: 'Not a participant in this match' });
                                }
                                // Read match state
                                var stateObjects = nk.storageRead([
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
                                var matchState = JSON.parse(stateObjects[0].value);
                                // Determine winner (opponent)
                                var winnerId = ctx.userId === match.creator_id ? match.opponent_id : match.creator_id;
                                var loserId = ctx.userId;
                                // Update match state
                                matchState.status = 'completed';
                                matchState.winner = winnerId;
                                matchState.forfeit_reason = reason || 'disconnect';
                                // Add forfeit entry to log
                                var forfeitLogEntry = {
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
                                // Update match status
                                updateMatchStatus(nk, match, winnerId);
                                // Notify opponent
                                notifyOpponentOfForfeit(nk, matchState, winnerId, reason || 'disconnect');
                                return JSON.stringify({
                                    success: true,
                                    forfeit: true,
                                    winner: winnerId,
                                    reason: reason || 'disconnect',
                                });
                            })];
                    });
                }); })];
        });
    });
}
/**
 * Registers the player disconnect RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcPlayerDisconnect(initializer) {
    initializer.registerRpc('armored_archer/player_disconnect', rpcPlayerDisconnect);
}
