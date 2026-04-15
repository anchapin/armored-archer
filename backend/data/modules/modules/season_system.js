"use strict";
/**
 * Season System module.
 * @fileoverview Manages seasonal rewards and rankings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRpcGetSeasonInfo = registerRpcGetSeasonInfo;
exports.rpcGetSeasonInfo = rpcGetSeasonInfo;
exports.registerRpcGetLeaderboard = registerRpcGetLeaderboard;
exports.rpcGetLeaderboard = rpcGetLeaderboard;
exports.registerRpcUpdateRank = registerRpcUpdateRank;
exports.applyEloUpdates = applyEloUpdates;
exports.rpcUpdateRank = rpcUpdateRank;
exports.registerRpcGetSeasonRewards = registerRpcGetSeasonRewards;
exports.rpcGetSeasonRewards = rpcGetSeasonRewards;
exports.registerRpcClaimSeasonRewards = registerRpcClaimSeasonRewards;
exports.rpcClaimSeasonRewards = rpcClaimSeasonRewards;
exports.registerRpcEndSeason = registerRpcEndSeason;
exports.rpcEndSeason = rpcEndSeason;
exports.getCurrentSeason = getCurrentSeason;
exports.getLeaderboardEntry = getLeaderboardEntry;
exports.calculateRewards = calculateRewards;
exports.recordPlayerActivity = recordPlayerActivity;
exports.applyRankDecay = applyRankDecay;
exports.getRankDecayInfo = getRankDecayInfo;
const anti_cheat_1 = require("./anti_cheat");
const validation_1 = require("./validation");
const SEASON_DURATION_WEEKS = 4;
const SEASON_DURATION_MS = SEASON_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000;
// Rank decay configuration
const RANK_DECAY_DAYS = 7; // Days of inactivity before decay starts
const RANK_DECAY_AMOUNT = 25; // Points lost per decay period
const RANK_DECAY_MAX_LOSS = 100; // Maximum points that can be lost per decay
const RANK_DECAY_MIN_SCORE = 800; // Minimum score after decay
const RANK_DECAY_CHECK_MS = 24 * 60 * 60 * 1000; // Check every 24 hours
/**
 * Registers the get season info RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetSeasonInfo(initializer) {
    initializer.registerRpc('armored_archer/get_season_info', rpcGetSeasonInfo);
}
/**
 * Retrieves current season information and player stats.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with season info and player stats
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "season": { ... },
 *   "player_rank": 15,
 *   "player_score": 1200,
 *   "time_remaining": 123456
 * }
 */
function rpcGetSeasonInfo(ctx, logger, nk, payload) {
    logger.info('Get season info called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_season_info, payload, 'get_season_info');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_season_info', validation.error);
    }
    const currentSeason = getCurrentSeason();
    const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);
    return JSON.stringify({
        success: true,
        season: currentSeason,
        player_rank: playerEntry ? playerEntry.rank : null,
        player_score: playerEntry ? playerEntry.score : 0,
        time_remaining: Math.max(0, currentSeason.end_time - Date.now()),
    });
}
/**
 * Registers the get leaderboard RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetLeaderboard(initializer) {
    initializer.registerRpc('armored_archer/get_leaderboard', rpcGetLeaderboard);
}
/**
 * Retrieves the current season leaderboard.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing limit parameter
 * @returns JSON string with leaderboard data
 *
 * @example
 * // Request payload
 * { "limit": 20 }
 *
 * // Response
 * {
 *   "success": true,
 *   "season": { ... },
 *   "leaderboard": [ ... ],
 *   "total": 100
 * }
 */
function rpcGetLeaderboard(ctx, logger, nk, payload) {
    logger.info('Get leaderboard called for user: %s', ctx.userId);
    const currentSeason = getCurrentSeason();
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_leaderboard, payload, 'get_leaderboard');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_leaderboard', validation.error);
    }
    const request = validation.data || {};
    const limit = request.limit || 50;
    const records = nk.leaderboardRecordList(currentSeason.season_id, [], limit, '', 0);
    const entries = records.map((record) => ({
        owner_id: record.ownerId,
        username: record.username,
        rank: record.rank,
        score: record.score,
        meta: JSON.parse(record.metadata || '{}'),
    }));
    return JSON.stringify({
        success: true,
        season: currentSeason,
        leaderboard: entries,
        total: records.length,
    });
}
/**
 * Registers the update rank RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcUpdateRank(initializer) {
    initializer.registerRpc('armored_archer/update_rank', rpcUpdateRank);
}
/**
 * Updates player ranks after a match using Elo rating system.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match results
 * @returns JSON string with rank changes
 *
 * @example
 * // Request payload
 * { "winner_id": "user_1", "loser_id": "user_2", "is_punch_up": false }
 *
 * // Response
 * {
 *   "success": true,
 *   "winner": { ... },
 *   "loser": { ... },
 *   "is_punch_up": false
 * }
 */
/**
 * Checks if a player is flagged and returns error response if so
 */
function checkPlayerFlagged(logger, playerId, playerType) {
    if ((0, anti_cheat_1.isPlayerFlagged)(playerId)) {
        logger.warn('Update rank blocked - %s flagged: %s reason: %s', playerType, playerId, (0, anti_cheat_1.getFlagReason)(playerId));
        const errorMsg = playerType === 'winner'
            ? `Player is flagged for review: ${(0, anti_cheat_1.getFlagReason)(playerId)}`
            : `Opponent is flagged for review: ${(0, anti_cheat_1.getFlagReason)(playerId)}`;
        return JSON.stringify({
            success: false,
            error_code: 'PLAYER_FLAGGED',
            error: errorMsg,
        });
    }
    return null;
}
/**
 * Validates anti-cheat signature for rank update
 */
function validateRankUpdateSignature(ctx, logger, request) {
    if (request.requestId && request.timestamp && request.signature && request.nonce) {
        const signatureData = {
            requestId: request.requestId,
            timestamp: request.timestamp,
            signature: request.signature,
            nonce: request.nonce,
        };
        const payloadForSig = JSON.stringify({
            match_id: request.match_id,
            winner_id: request.winner_id,
            loser_id: request.loser_id,
            winner_old_rank: request.winner_old_rank,
            loser_old_rank: request.loser_old_rank,
            winner_new_rank: request.winner_new_rank,
            loser_new_rank: request.loser_new_rank,
            is_punch_up: request.is_punch_up,
        });
        const sigResult = (0, anti_cheat_1.verifyRequestSignature)(ctx, payloadForSig, signatureData, 'update_rank');
        if (!sigResult.valid) {
            logger.warn('Invalid signature for update_rank: %s', sigResult.violations.join(', '));
            return JSON.stringify({
                success: false,
                error_code: 'ANTI_CHEAT_VIOLATION',
                error: 'Invalid request signature',
                violations: sigResult.violations,
            });
        }
    }
    return null;
}
/**
 * Applies Elo rating updates to both players
 */
function applyEloUpdates(nk, ctx, currentSeason, winnerId, loserId, winnerOldElo, loserOldElo, isPunchUp, winnerEntry, loserEntry) {
    const K = isPunchUp ? 60 : 32;
    const expectedWinner = 1 / (1 + Math.pow(10, (loserOldElo - winnerOldElo) / 400));
    const expectedLoser = 1 - expectedWinner;
    const winnerNewElo = Math.round(winnerOldElo + K * (1 - expectedWinner));
    const loserNewElo = Math.round(loserOldElo + K * (0 - expectedLoser));
    // Update winner
    const winnerMeta = winnerEntry
        ? winnerEntry.meta
        : { wins: 0, losses: 0, win_rate: 0, punch_up_wins: 0 };
    winnerMeta.wins++;
    winnerMeta.punch_up_wins += isPunchUp ? 1 : 0;
    winnerMeta.win_rate = winnerMeta.wins / (winnerMeta.wins + winnerMeta.losses);
    nk.leaderboardRecordWrite(currentSeason.season_id, winnerId, ctx.username || 'Player', winnerNewElo, 0, {
        wins: String(winnerMeta.wins),
        losses: String(winnerMeta.losses),
        win_rate: String(winnerMeta.win_rate),
        punch_up_wins: String(winnerMeta.punch_up_wins),
    });
    // Update loser
    const loserMeta = loserEntry
        ? loserEntry.meta
        : { wins: 0, losses: 0, win_rate: 0, punch_up_wins: 0 };
    loserMeta.losses++;
    loserMeta.win_rate = loserMeta.wins / (loserMeta.wins + loserMeta.losses);
    nk.leaderboardRecordWrite(currentSeason.season_id, loserId, 'Opponent', loserNewElo, 0, {
        wins: String(loserMeta.wins),
        losses: String(loserMeta.losses),
        win_rate: String(loserMeta.win_rate),
        punch_up_wins: String(loserMeta.punch_up_wins),
    });
    return { winnerNewElo, loserNewElo };
}
function rpcUpdateRank(ctx, logger, nk, payload) {
    logger.info('Update rank called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.update_rank, payload, 'update_rank');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('update_rank', validation.error);
    }
    const request = validation.data;
    // Anti-cheat: Check if players are flagged
    const winnerFlagged = checkPlayerFlagged(logger, request.winner_id, 'winner');
    if (winnerFlagged)
        return winnerFlagged;
    const loserFlagged = checkPlayerFlagged(logger, request.loser_id, 'loser');
    if (loserFlagged)
        return loserFlagged;
    // Anti-cheat: Verify request signature
    const signatureError = validateRankUpdateSignature(ctx, logger, request);
    if (signatureError)
        return signatureError;
    // Anti-cheat: Detect timing attacks
    if ((0, anti_cheat_1.detectTimingAttack)(ctx.userId, 'update_rank', request.requestId || '')) {
        logger.warn('Timing attack detected for user: %s', ctx.userId);
        return JSON.stringify({
            success: false,
            error_code: 'TIMING_ANOMALY',
            error: 'Suspicious request pattern detected',
        });
    }
    const currentSeason = getCurrentSeason();
    const winnerEntry = getLeaderboardEntry(nk, request.winner_id, currentSeason.season_id);
    const loserEntry = getLeaderboardEntry(nk, request.loser_id, currentSeason.season_id);
    const winnerOldElo = winnerEntry ? winnerEntry.score : 1000;
    const loserOldElo = loserEntry ? loserEntry.score : 1000;
    // Apply Elo updates
    const { winnerNewElo, loserNewElo } = applyEloUpdates(nk, ctx, currentSeason, request.winner_id, request.loser_id, winnerOldElo, loserOldElo, request.is_punch_up, winnerEntry, loserEntry);
    // Record match results for anti-cheat analysis
    (0, anti_cheat_1.recordMatchResult)(request.winner_id, request.match_id, request.loser_id, 'win', true, winnerOldElo, winnerNewElo);
    (0, anti_cheat_1.recordMatchResult)(request.loser_id, request.match_id, request.winner_id, 'loss', true, loserOldElo, loserNewElo);
    return JSON.stringify({
        success: true,
        winner: {
            user_id: request.winner_id,
            old_rank: winnerOldElo,
            new_rank: winnerNewElo,
            rank_change: winnerNewElo - winnerOldElo,
        },
        loser: {
            user_id: request.loser_id,
            old_rank: loserOldElo,
            new_rank: loserNewElo,
            rank_change: loserNewElo - loserOldElo,
        },
        is_punch_up: request.is_punch_up,
    });
}
/**
 * Registers the get season rewards RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetSeasonRewards(initializer) {
    initializer.registerRpc('armored_archer/get_season_rewards', rpcGetSeasonRewards);
}
/**
 * Retrieves season rewards for a player.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with season rewards
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "rank": 15,
 *   "rewards": { ... }
 * }
 */
function rpcGetSeasonRewards(ctx, logger, nk, payload) {
    logger.info('Get season rewards called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_season_rewards, payload, 'get_season_rewards');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_season_rewards', validation.error);
    }
    const currentSeason = getCurrentSeason();
    const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);
    if (!playerEntry) {
        return JSON.stringify({
            success: true,
            rewards: null,
        });
    }
    const rewards = calculateRewards(playerEntry.rank, currentSeason.season_number);
    return JSON.stringify({
        success: true,
        rank: playerEntry.rank,
        rewards: rewards,
    });
}
/**
 * Registers the claim season rewards RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcClaimSeasonRewards(initializer) {
    initializer.registerRpc('armored_archer/claim_season_rewards', rpcClaimSeasonRewards);
}
/**
 * Claims season rewards for a player.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with claim result
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "rewards": { ... },
 *   "claimed": true
 * }
 */
function rpcClaimSeasonRewards(ctx, logger, nk, payload) {
    logger.info('Claim season rewards called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.claim_season_rewards, payload, 'claim_season_rewards');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('claim_season_rewards', validation.error);
    }
    const currentSeason = getCurrentSeason();
    const objects = nk.storageRead([
        {
            collection: 'season_rewards_claimed',
            key: `${currentSeason.season_id}_${ctx.userId}`,
            userId: ctx.userId,
        },
    ]);
    if (objects.length > 0) {
        return JSON.stringify({
            error: 'Rewards already claimed for this season',
        });
    }
    const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);
    if (!playerEntry) {
        return JSON.stringify({
            error: 'No leaderboard entry found',
        });
    }
    const rewards = calculateRewards(playerEntry.rank, currentSeason.season_number);
    // Mark rewards as claimed
    nk.storageWrite([
        {
            collection: 'season_rewards_claimed',
            key: `${currentSeason.season_id}_${ctx.userId}`,
            userId: ctx.userId,
            value: JSON.stringify({
                season_id: currentSeason.season_id,
                user_id: ctx.userId,
                claimed_at: Date.now(),
                rank: playerEntry.rank,
                rewards: rewards,
            }),
        },
    ]);
    // Give rewards (coins, cosmetics)
    const rewardChanges = {};
    if (rewards.coins) {
        rewardChanges['coins'] = rewards.coins;
    }
    if (rewards.gems) {
        rewardChanges['gems'] = rewards.gems;
    }
    if (Object.keys(rewardChanges).length > 0) {
        nk.walletUpdate(ctx.userId, rewardChanges);
    }
    return JSON.stringify({
        success: true,
        rewards: rewards,
        claimed: true,
    });
}
/**
 * Registers the end season RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcEndSeason(initializer) {
    initializer.registerRpc('armored_archer/end_season', rpcEndSeason);
}
/**
 * Ends the current season and starts a new one.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with season transition result
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "old_season": { ... },
 *   "new_season": { ... }
 * }
 */
function rpcEndSeason(ctx, logger, nk, payload) {
    logger.info('End season called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.end_season, payload, 'end_season');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('end_season', validation.error);
    }
    const currentSeason = getCurrentSeason();
    // Create new season
    const nextSeasonNumber = currentSeason.season_number + 1;
    const nextSeasonStartTime = Date.now();
    const nextSeasonEndTime = nextSeasonStartTime + SEASON_DURATION_MS;
    const nextSeason = {
        season_id: `season_${nextSeasonNumber}`,
        season_number: nextSeasonNumber,
        start_time: nextSeasonStartTime,
        end_time: nextSeasonEndTime,
        status: 'active',
        duration_weeks: SEASON_DURATION_WEEKS,
    };
    // Store new season info
    nk.storageWrite([
        {
            collection: 'seasons',
            key: nextSeason.season_id,
            userId: ctx.userId,
            value: JSON.stringify(nextSeason),
        },
    ]);
    // Update current season status
    const oldSeason = currentSeason;
    oldSeason.status = 'ended';
    nk.storageWrite([
        {
            collection: 'seasons',
            key: oldSeason.season_id,
            userId: ctx.userId,
            value: JSON.stringify(oldSeason),
        },
    ]);
    // Create new leaderboard for next season
    nk.leaderboardCreate(nextSeason.season_id, true, 'desc', 'best', '', {
        season_number: String(nextSeasonNumber),
    });
    return JSON.stringify({
        success: true,
        old_season: oldSeason,
        new_season: nextSeason,
    });
}
/**
 * Gets the current season information.
 *
 * @returns Current season data
 */
function getCurrentSeason() {
    const now = Date.now();
    const seasonNumber = Math.floor(now / SEASON_DURATION_MS) + 1;
    const seasonStartTime = (seasonNumber - 1) * SEASON_DURATION_MS;
    const seasonEndTime = seasonStartTime + SEASON_DURATION_MS;
    return {
        season_id: `season_${seasonNumber}`,
        season_number: seasonNumber,
        start_time: seasonStartTime,
        end_time: seasonEndTime,
        status: 'active',
        duration_weeks: SEASON_DURATION_WEEKS,
    };
}
/**
 * Gets a player's leaderboard entry.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player to retrieve
 * @param leaderboardId - ID of the leaderboard
 * @returns Leaderboard entry or null if not found
 */
function getLeaderboardEntry(nk, userId, leaderboardId) {
    const records = nk.leaderboardRecordList(leaderboardId, [userId], 1, '', 0);
    if (records.length === 0) {
        return null;
    }
    const record = records[0];
    return {
        owner_id: record.ownerId,
        username: record.username,
        rank: record.rank,
        score: record.score,
        meta: JSON.parse(record.metadata || '{}'),
    };
}
/**
 * Calculates season rewards based on player rank.
 *
 * @param rank - Player's final rank
 * @param seasonNumber - Current season number
 * @returns Calculated season rewards
 */
function calculateRewards(rank, seasonNumber) {
    if (rank <= 10) {
        return {
            rank_tier: 'legendary',
            coins: 10000,
            gems: 500,
            cosmetics: {
                title: `Season ${seasonNumber} Champion`,
                aura: 'legendary_aura',
            },
        };
    }
    else if (rank <= 50) {
        return {
            rank_tier: 'epic',
            coins: 5000,
            gems: 200,
            cosmetics: {
                title: `Season ${seasonNumber} Elite`,
                aura: 'epic_aura',
            },
        };
    }
    else if (rank <= 100) {
        return {
            rank_tier: 'rare',
            coins: 2000,
            gems: 100,
            cosmetics: {
                title: `Season ${seasonNumber} Veteran`,
                aura: 'rare_aura',
            },
        };
    }
    else if (rank <= 500) {
        return {
            rank_tier: 'uncommon',
            coins: 500,
            gems: 0,
        };
    }
    else {
        return {
            rank_tier: 'common',
            coins: 100,
            gems: 0,
        };
    }
}
/**
 * Records player match activity for rank decay tracking.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 */
function recordPlayerActivity(nk, userId) {
    const now = Date.now();
    nk.storageWrite([
        {
            collection: 'player_activity',
            key: userId,
            userId: userId,
            value: JSON.stringify({ last_match_time: now }),
        },
    ]);
}
/**
 * Gets the timestamp of the player's last match.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @returns Last match timestamp or 0 if never played
 */
function getLastMatchTime(nk, userId) {
    try {
        const records = nk.storageRead([
            {
                collection: 'player_activity',
                key: userId,
                userId: userId,
            },
        ]);
        if (records.length > 0 && records[0].value) {
            const data = JSON.parse(records[0].value);
            return data.last_match_time || 0;
        }
    }
    catch (e) {
        // Ignore errors, return 0
    }
    return 0;
}
/**
 * Calculates and applies rank decay for a player based on inactivity.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param currentScore - Player's current rank score
 * @returns New score after decay (or original if no decay applies)
 */
function applyRankDecay(nk, userId, currentScore) {
    // Don't decay players below minimum score
    if (currentScore < RANK_DECAY_MIN_SCORE) {
        return currentScore;
    }
    const lastMatchTime = getLastMatchTime(nk, userId);
    const now = Date.now();
    const inactiveMs = now - lastMatchTime;
    const inactiveDays = Math.floor(inactiveMs / (24 * 60 * 60 * 1000));
    // No decay if player has been active within the decay period
    if (inactiveDays < RANK_DECAY_DAYS) {
        return currentScore;
    }
    // Calculate decay periods
    const decayPeriods = Math.floor((inactiveDays - RANK_DECAY_DAYS) / RANK_DECAY_DAYS);
    const decayLoss = Math.min(decayPeriods * RANK_DECAY_AMOUNT, RANK_DECAY_MAX_LOSS);
    const newScore = Math.max(currentScore - decayLoss, RANK_DECAY_MIN_SCORE);
    return newScore;
}
/**
 * Gets the rank decay info for a player.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param currentScore - Player's current rank score
 * @returns Decay information including days inactive and points at risk
 */
function getRankDecayInfo(nk, userId, currentScore) {
    const lastMatchTime = getLastMatchTime(nk, userId);
    const now = Date.now();
    const inactiveMs = now - lastMatchTime;
    const daysInactive = Math.floor(inactiveMs / (24 * 60 * 60 * 1000));
    // Calculate points at risk
    let pointsAtRisk = 0;
    if (currentScore >= RANK_DECAY_MIN_SCORE && daysInactive >= RANK_DECAY_DAYS) {
        const decayPeriods = Math.floor((daysInactive - RANK_DECAY_DAYS) / RANK_DECAY_DAYS);
        pointsAtRisk = Math.min(decayPeriods * RANK_DECAY_AMOUNT, RANK_DECAY_MAX_LOSS);
    }
    return {
        days_inactive: daysInactive,
        points_at_risk: pointsAtRisk,
        can_decay: pointsAtRisk > 0,
    };
}
