"use strict";
/**
 * Matchmaker module.
 * @fileoverview Implements matchmaking and ranking for PvP matches.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRpcListMatches = registerRpcListMatches;
exports.rpcListMatches = rpcListMatches;
exports.registerRpcCreateMatch = registerRpcCreateMatch;
exports.rpcCreateMatch = rpcCreateMatch;
exports.registerRpcAcceptMatch = registerRpcAcceptMatch;
exports.rpcAcceptMatch = rpcAcceptMatch;
exports.registerRpcGetPlayerRank = registerRpcGetPlayerRank;
exports.rpcGetPlayerRank = rpcGetPlayerRank;
exports.calculateRank = calculateRank;
exports.generateMatchId = generateMatchId;
exports.registerRpcCompleteMatch = registerRpcCompleteMatch;
exports.rpcCompleteMatch = rpcCompleteMatch;
var tslib_1 = require("tslib");
var safeParse_1 = require("../utils/safeParse");
var storage_helpers_1 = require("../utils/storage-helpers");
var anti_cheat_1 = require("./anti_cheat");
var audit_1 = require("./audit");
var season_system_1 = require("./season_system");
var validation_1 = require("./validation");
/**
 * Registers the list matches RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcListMatches(initializer) {
    initializer.registerRpc('armored_archer/list_matches', rpcListMatches);
}
/**
 * Checks whether a match passes the listing filter criteria.
 *
 * @param match - The PvP match to check
 * @param userId - The requesting user's ID (to exclude own matches)
 * @param request - The filter parameters from the list request
 * @returns True if the match should be included in results
 */
function matchPassesFilter(match, userId, request) {
    if (match.status !== 'pending')
        return false;
    if (request.match_type && match.match_type !== request.match_type)
        return false;
    if (match.creator_id === userId)
        return false;
    if (request.min_rank !== undefined && match.creator_rank < request.min_rank)
        return false;
    if (request.max_rank !== undefined && match.creator_rank > request.max_rank)
        return false;
    return true;
}
/**
 * Lists available PvP matches with filtering options.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing filter parameters
 * @returns JSON string with list of matches and player rank
 *
 * @example
 * // Request payload
 * { "match_type": "ranked", "limit": 10 }
 *
 * // Response
 * {
 *   "success": true,
 *   "matches": [ ... ],
 *   "player_rank": 15,
 *   "total": 8
 * }
 */
function rpcListMatches(ctx, logger, nk, payload) {
    var e_1, _a;
    logger.info('List matches called for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.list_matches, payload, 'list_matches');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('list_matches', validation.error);
    }
    var request = validation.data || {};
    var limit = request.limit || 20;
    var objects = nk.storageRead([
        {
            collection: 'player_stats',
            key: ctx.userId,
            userId: ctx.userId,
        },
    ]);
    if (objects.length === 0) {
        return JSON.stringify({
            error: 'Player stats not found',
        });
    }
    var playerStatsResult = (0, safeParse_1.safeParse)(objects[0].value, null, logger, 'rpcListMatches:playerStats');
    if (!playerStatsResult.success || !playerStatsResult.data) {
        return JSON.stringify({ error: 'Failed to parse player stats' });
    }
    var playerStats = playerStatsResult.data;
    var playerRank = calculateRank(playerStats);
    var matches = nk.storageList(ctx.userId, 'pvp_matches', limit, '', '');
    var filteredMatches = [];
    try {
        for (var matches_1 = tslib_1.__values(matches), matches_1_1 = matches_1.next(); !matches_1_1.done; matches_1_1 = matches_1.next()) {
            var object = matches_1_1.value;
            var matchResult = (0, safeParse_1.safeParse)(object.value, null, logger, 'rpcListMatches:match');
            if (!matchResult.success || !matchResult.data) {
                logger.warn('Skipping corrupted match record for user: %s', ctx.userId);
                continue;
            }
            var match = matchResult.data;
            if (matchPassesFilter(match, ctx.userId, request)) {
                filteredMatches.push(match);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (matches_1_1 && !matches_1_1.done && (_a = matches_1.return)) _a.call(matches_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    filteredMatches.sort(function (a, b) { return b.created_at - a.created_at; });
    return JSON.stringify({
        success: true,
        matches: filteredMatches.slice(0, limit),
        player_rank: playerRank,
        total: filteredMatches.length,
    });
}
/**
 * Registers the create match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcCreateMatch(initializer) {
    initializer.registerRpc('armored_archer/create_match', rpcCreateMatch);
}
/**
 * Creates a new PvP match with optional direct challenge.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match creation parameters
 * @returns JSON string with created match data
 *
 * @example
 * // Request payload
 * { "match_type": "ranked", "target_opponent_id": "user_456" }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": { ... }
 * }
 */
function rpcCreateMatch(ctx, logger, nk, payload) {
    var _a;
    logger.info('Create match called for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.create_match, payload, 'create_match');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'create_match', 'pvp_matches', { match_type: 'unknown', is_punch_up: false, target_opponent_id: 'none' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('create_match', validation.error);
    }
    var request = validation.data;
    var objects = nk.storageRead([
        {
            collection: 'player_stats',
            key: ctx.userId,
            userId: ctx.userId,
        },
    ]);
    if (objects.length === 0) {
        return JSON.stringify({
            error: 'Player stats not found',
        });
    }
    var playerStatsResult = (0, safeParse_1.safeParse)(objects[0].value, null, logger, 'rpcCreateMatch:playerStats');
    if (!playerStatsResult.success || !playerStatsResult.data) {
        return JSON.stringify({ error: 'Failed to parse player stats' });
    }
    var playerStats = playerStatsResult.data;
    var playerRank = calculateRank(playerStats);
    if (request.target_opponent_id) {
        var targetStats = nk.storageRead([
            {
                collection: 'player_stats',
                key: request.target_opponent_id,
                userId: request.target_opponent_id,
            },
        ]);
        if (targetStats.length === 0) {
            return JSON.stringify({
                error: 'Target player not found',
            });
        }
        var targetPlayerStatsResult = (0, safeParse_1.safeParse)(targetStats[0].value, null, logger, 'rpcCreateMatch:targetStats');
        if (!targetPlayerStatsResult.success || !targetPlayerStatsResult.data) {
            return JSON.stringify({ error: 'Failed to parse target player stats' });
        }
        var targetPlayerStats = targetPlayerStatsResult.data;
        var targetRank = calculateRank(targetPlayerStats);
        if (!request.is_punch_up && Math.abs(playerRank - targetRank) > 3) {
            return JSON.stringify({
                error: 'Rank difference too large for direct challenge',
            });
        }
        var match = {
            match_id: generateMatchId(),
            creator_id: ctx.userId,
            opponent_id: request.target_opponent_id,
            creator_rank: playerRank,
            opponent_rank: targetRank,
            match_type: request.match_type,
            is_punch_up: request.is_punch_up || false,
            status: 'pending',
            created_at: Date.now(),
            updated_at: Date.now(),
            expires_at: Date.now() + 300000, // 5 minutes
            last_turn_timestamp: Date.now(),
        };
        nk.storageWrite([
            {
                collection: 'pvp_matches',
                key: match.match_id,
                userId: ctx.userId,
                value: JSON.stringify(match),
            },
        ]);
        return JSON.stringify({
            success: true,
            match: match,
        });
    }
    else {
        var now = Date.now();
        // Pending matches expire after 24 hours
        var PENDING_MATCH_EXPIRY_MS = 24 * 60 * 60 * 1000;
        var match = {
            match_id: generateMatchId(),
            creator_id: ctx.userId,
            opponent_id: '',
            creator_rank: playerRank,
            opponent_rank: 0,
            match_type: request.match_type,
            is_punch_up: false,
            status: 'pending',
            created_at: now,
            updated_at: now,
            expires_at: now + PENDING_MATCH_EXPIRY_MS,
            last_turn_timestamp: now,
        };
        nk.storageWrite([
            {
                collection: 'pvp_matches',
                key: match.match_id,
                userId: ctx.userId,
                value: JSON.stringify(match),
            },
        ]);
        return JSON.stringify({
            success: true,
            match: match,
        });
    }
}
/**
 * Registers the accept match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcAcceptMatch(initializer) {
    initializer.registerRpc('armored_archer/accept_match', rpcAcceptMatch);
}
/**
 * Accepts a pending PvP match and starts the game.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match_id
 * @returns JSON string with accepted match data
 *
 * @example
 * // Request payload
 * { "match_id": "match_123" }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": { ... }
 * }
 */
function rpcAcceptMatch(ctx, logger, nk, payload) {
    var _a, _b;
    logger.info('Accept match called for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.accept_match, payload, 'accept_match');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'accept_match', 'pvp_matches', { match_id: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('accept_match', validation.error);
    }
    var request = validation.data;
    var objects = nk.storageRead([
        {
            collection: 'pvp_matches',
            key: request.match_id,
            userId: ctx.userId,
        },
    ]);
    if (objects.length === 0) {
        return JSON.stringify({
            error: 'Match not found',
        });
    }
    var matchResult = (0, safeParse_1.safeParse)(objects[0].value, null, logger, 'rpcAcceptMatch:match');
    if (!matchResult.success || !matchResult.data) {
        return JSON.stringify({ error: 'Failed to parse match data' });
    }
    var match = matchResult.data;
    if (match.creator_id === ctx.userId) {
        return JSON.stringify({
            error: 'Cannot accept your own match',
        });
    }
    if (match.status !== 'pending') {
        return JSON.stringify({
            error: 'Match is no longer available',
        });
    }
    var playerObjects = nk.storageRead([
        {
            collection: 'player_stats',
            key: ctx.userId,
            userId: ctx.userId,
        },
    ]);
    if (playerObjects.length === 0) {
        return JSON.stringify({
            error: 'Player stats not found',
        });
    }
    var playerStatsResult = (0, safeParse_1.safeParse)(playerObjects[0].value, null, logger, 'rpcAcceptMatch:playerStats');
    if (!playerStatsResult.success || !playerStatsResult.data) {
        return JSON.stringify({ error: 'Failed to parse player stats' });
    }
    var playerStats = playerStatsResult.data;
    var now = Date.now();
    // Active matches expire after 7 days of inactivity
    var ACTIVE_MATCH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
    match.opponent_id = ctx.userId;
    match.opponent_rank = calculateRank(playerStats);
    match.status = 'active';
    match.updated_at = now;
    match.expires_at = now + ACTIVE_MATCH_EXPIRY_MS;
    match.last_turn_timestamp = now;
    nk.storageWrite([
        {
            collection: 'pvp_matches',
            key: match.match_id,
            userId: match.creator_id,
            value: JSON.stringify(match),
        },
    ]);
    (0, audit_1.logAudit)(nk, ctx.userId, (_b = ctx.ipAddress) !== null && _b !== void 0 ? _b : null, 'accept_match', 'pvp_matches', {
        match_id: match.match_id,
        creator_id: match.creator_id,
        match_type: match.match_type,
        is_punch_up: match.is_punch_up,
    }, 'success');
    return JSON.stringify({
        success: true,
        match: match,
    });
}
/**
 * Registers the get player rank RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetPlayerRank(initializer) {
    initializer.registerRpc('armored_archer/get_player_rank', rpcGetPlayerRank);
}
/**
 * Retrieves a player's current rank and stats.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with player rank and stats
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "rank": 15,
 *   "level": 5,
 *   "xp": 450
 * }
 */
function rpcGetPlayerRank(ctx, logger, nk, payload) {
    logger.info('Get player rank called for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_player_rank, payload, 'get_player_rank');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_player_rank', validation.error);
    }
    var statsResult = (0, storage_helpers_1.readAndParseStorage)(nk, 'player_stats', ctx.userId, ctx.userId, logger, 'rpcGetPlayerRank');
    if (statsResult.error) {
        return JSON.stringify({ error: 'Player stats not found' });
    }
    var playerStats = statsResult.data;
    var rank = calculateRank(playerStats);
    // Apply rank decay check - this updates the player's rank if they've been inactive
    var decayedRank = (0, season_system_1.applyRankDecay)(nk, ctx.userId, rank);
    return JSON.stringify({
        success: true,
        rank: decayedRank,
        level: playerStats.level,
        xp: playerStats.xp,
    });
}
/**
 * Calculates a player's rank based on level and stats.
 *
 * @param playerStats - Player statistics data
 * @returns Calculated player rank
 */
function calculateRank(playerStats) {
    var baseRank = playerStats.level * 10;
    var statsTotal = playerStats.stats.attack +
        playerStats.stats.defense +
        playerStats.stats.dodge +
        playerStats.stats.crit_rate;
    return Math.floor(baseRank + statsTotal / 4);
}
/**
 * Generates a unique match ID.
 *
 * @returns Unique match identifier string
 */
function generateMatchId() {
    return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
/**
 * Checks if a player is flagged and returns error response if so.
 */
function checkPlayerFlagged(logger, playerId, playerType) {
    if ((0, anti_cheat_1.isPlayerFlagged)(playerId)) {
        logger.warn('Complete match blocked - %s flagged: %s reason: %s', playerType, playerId, (0, anti_cheat_1.getFlagReason)(playerId));
        var errorMsg = playerType === 'winner'
            ? "Player is flagged for review: ".concat((0, anti_cheat_1.getFlagReason)(playerId))
            : "Opponent is flagged for review: ".concat((0, anti_cheat_1.getFlagReason)(playerId));
        return JSON.stringify({
            success: false,
            error_code: 'PLAYER_FLAGGED',
            error: errorMsg,
        });
    }
    return null;
}
/**
 * Registers the complete match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcCompleteMatch(initializer) {
    initializer.registerRpc('armored_archer/complete_match', rpcCompleteMatch);
}
/**
 * Completes a PvP match and updates player ranks using Elo rating system.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match completion data
 * @returns JSON string with match result and rank changes
 *
 * @example
 * // Request payload
 * { "match_id": "match_123", "winner_id": "user_1", "loser_id": "user_2", "is_punch_up": false }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": { ... },
 *   "winner": { "user_id": "user_1", "old_rank": 1200, "new_rank": 1220, "rank_change": 20 },
 *   "loser": { "user_id": "user_2", "old_rank": 1200, "new_rank": 1180, "rank_change": -20 }
 * }
 */
function rpcCompleteMatch(ctx, logger, nk, payload) {
    var _a;
    logger.info('Complete match called for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.complete_match, payload, 'complete_match');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'complete_match', 'pvp_matches', { match_id: 'unknown', winner_id: 'unknown', loser_id: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('complete_match', validation.error);
    }
    var request = validation.data;
    // Anti-cheat: Check if players are flagged
    var winnerFlagged = checkPlayerFlagged(logger, request.winner_id, 'winner');
    if (winnerFlagged)
        return winnerFlagged;
    var loserFlagged = checkPlayerFlagged(logger, request.loser_id, 'loser');
    if (loserFlagged)
        return loserFlagged;
    // Fetch and validate the match
    var matchResult = getAndValidateMatch(nk, ctx, request, logger);
    if (matchResult.error || !matchResult.match) {
        return JSON.stringify({ error: matchResult.error || 'Match not found' });
    }
    var match = matchResult.match;
    // Validate winner/loser are valid participants
    var participantError = validateMatchParticipants(match, request);
    if (participantError) {
        return JSON.stringify({ error: participantError });
    }
    var isPunchUp = request.is_punch_up || match.is_punch_up;
    // Process match result
    return processMatchResult(ctx, logger, nk, request, match, isPunchUp);
}
/**
 * Fetch and validate the match from storage
 */
function getAndValidateMatch(nk, ctx, request, logger) {
    var objects = nk.storageRead([
        {
            collection: 'pvp_matches',
            key: request.match_id,
            userId: ctx.userId,
        },
    ]);
    if (objects.length === 0) {
        return { error: 'Match not found' };
    }
    var matchResult = (0, safeParse_1.safeParse)(objects[0].value, null, logger, 'rpcForfeitMatch:match');
    if (!matchResult.success || !matchResult.data) {
        return { error: 'Failed to parse match data' };
    }
    var match = matchResult.data;
    if (match.status !== 'active') {
        return { error: 'Match is not active' };
    }
    if (match.creator_id !== ctx.userId && match.opponent_id !== ctx.userId) {
        return { error: 'Not authorized to complete this match' };
    }
    return { match: match };
}
/**
 * Validate that winner and loser are valid match participants
 */
function validateMatchParticipants(match, request) {
    // Validate winner and loser are the match participants
    if ((request.winner_id !== match.creator_id && request.winner_id !== match.opponent_id) ||
        (request.loser_id !== match.creator_id && request.loser_id !== match.opponent_id)) {
        return 'Winner and loser must be match participants';
    }
    // Validate winner and loser are different
    if (request.winner_id === request.loser_id) {
        return 'Winner and loser must be different';
    }
    return null;
}
/**
 * Process the match result, calculate ranks, and update storage
 */
function processMatchResult(ctx, logger, nk, request, match, isPunchUp) {
    var _a;
    // Only process rank changes for ranked matches
    var winnerNewRank = match.creator_rank;
    var loserNewRank = match.opponent_rank;
    var winnerRankChange = 0;
    var loserRankChange = 0;
    if (match.match_type === 'ranked') {
        var currentSeason = (0, season_system_1.getCurrentSeason)();
        // Get current Elo ratings from leaderboard
        var winnerEntry = (0, season_system_1.getLeaderboardEntry)(nk, request.winner_id, currentSeason.season_id);
        var loserEntry = (0, season_system_1.getLeaderboardEntry)(nk, request.loser_id, currentSeason.season_id);
        var winnerOldElo = winnerEntry ? winnerEntry.score : 1000;
        var loserOldElo = loserEntry ? loserEntry.score : 1000;
        // Apply Elo updates
        var _b = (0, season_system_1.applyEloUpdates)(nk, ctx, currentSeason, request.winner_id, request.loser_id, winnerOldElo, loserOldElo, isPunchUp, winnerEntry, loserEntry), winnerNewElo = _b.winnerNewElo, loserNewElo = _b.loserNewElo;
        winnerNewRank = winnerNewElo;
        loserNewRank = loserNewElo;
        winnerRankChange = winnerNewElo - winnerOldElo;
        loserRankChange = loserNewElo - loserOldElo;
        // Record match results for anti-cheat analysis
        (0, anti_cheat_1.recordMatchResult)(request.winner_id, request.match_id, request.loser_id, 'win', true, winnerOldElo, winnerNewElo);
        (0, anti_cheat_1.recordMatchResult)(request.loser_id, request.match_id, request.winner_id, 'loss', true, loserOldElo, loserNewElo);
    }
    // Record player activity for rank decay tracking
    (0, season_system_1.recordPlayerActivity)(nk, request.winner_id);
    (0, season_system_1.recordPlayerActivity)(nk, request.loser_id);
    // Apply rank decay if applicable (for inactive players)
    var _c = applyMatchRankDecay(nk, request.winner_id, request.loser_id, winnerNewRank, loserNewRank, logger), winnerDecayedRank = _c.winnerNewRank, loserDecayedRank = _c.loserNewRank;
    winnerNewRank = winnerDecayedRank;
    loserNewRank = loserDecayedRank;
    // Update match status to completed
    var now = Date.now();
    match.status = 'completed';
    match.winner = request.winner_id;
    match.updated_at = now;
    // Update the match in storage
    nk.storageWrite([
        {
            collection: 'pvp_matches',
            key: match.match_id,
            userId: match.creator_id,
            value: JSON.stringify(match),
        },
    ]);
    // Log audit event
    (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'complete_match', 'pvp_matches', {
        match_id: match.match_id,
        winner_id: request.winner_id,
        loser_id: request.loser_id,
        match_type: match.match_type,
        is_punch_up: isPunchUp,
        winner_rank_change: winnerRankChange,
        loser_rank_change: loserRankChange,
    }, 'success');
    logger.info('Match completed: %s, winner: %s, loser: %s, type: %s, rank_change: %d', match.match_id, request.winner_id, request.loser_id, match.match_type, winnerRankChange);
    return JSON.stringify({
        success: true,
        match: match,
        winner: {
            user_id: request.winner_id,
            old_rank: match.match_type === 'ranked'
                ? request.winner_id === match.creator_id
                    ? match.creator_rank
                    : match.opponent_rank
                : 0,
            new_rank: winnerNewRank,
            rank_change: winnerRankChange,
        },
        loser: {
            user_id: request.loser_id,
            old_rank: match.match_type === 'ranked'
                ? request.loser_id === match.creator_id
                    ? match.creator_rank
                    : match.opponent_rank
                : 0,
            new_rank: loserNewRank,
            rank_change: loserRankChange,
        },
        is_punch_up: isPunchUp,
    });
}
/**
 * Apply rank decay to match participants
 */
function applyMatchRankDecay(nk, winnerId, loserId, winnerRank, loserRank, logger) {
    var winnerDecayedRank = (0, season_system_1.applyRankDecay)(nk, winnerId, winnerRank);
    var loserDecayedRank = (0, season_system_1.applyRankDecay)(nk, loserId, loserRank);
    if (winnerDecayedRank !== winnerRank) {
        logger.info('Rank decay applied for winner %s: %d -> %d', winnerId, winnerRank, winnerDecayedRank);
    }
    if (loserDecayedRank !== loserRank) {
        logger.info('Rank decay applied for loser %s: %d -> %d', loserId, loserRank, loserDecayedRank);
    }
    return { winnerNewRank: winnerDecayedRank, loserNewRank: loserDecayedRank };
}
