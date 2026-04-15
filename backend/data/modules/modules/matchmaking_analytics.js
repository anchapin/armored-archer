"use strict";
/**
 * Matchmaking Analytics Module
 * @fileoverview Handles analytics collection for matchmaking quality monitoring and balance tuning.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATCHMAKING_ANALYTICS_TARGETS = void 0;
exports.aggregateMatchMetrics = aggregateMatchMetrics;
exports.generateWeaponStats = generateWeaponStats;
exports.detectBalanceIssues = detectBalanceIssues;
exports.exportAnalyticsReport = exportAnalyticsReport;
exports.logMatchData = logMatchData;
exports.logAbandonment = logAbandonment;
exports.logWeaponResult = logWeaponResult;
exports.logQueueTime = logQueueTime;
exports.rpcLogMatchData = rpcLogMatchData;
exports.rpcLogAbandonment = rpcLogAbandonment;
exports.rpcLogWeaponResult = rpcLogWeaponResult;
exports.rpcLogQueueTime = rpcLogQueueTime;
exports.rpcGetMatchQualityMetrics = rpcGetMatchQualityMetrics;
exports.rpcGetWeaponStats = rpcGetWeaponStats;
exports.rpcDetectBalanceIssues = rpcDetectBalanceIssues;
exports.rpcExportAnalyticsReport = rpcExportAnalyticsReport;
exports.registerMatchmakingAnalyticsEndpoints = registerMatchmakingAnalyticsEndpoints;
const audit_1 = require("./audit");
const metrics_1 = require("./metrics");
const validation_1 = require("./validation");
// --- Target Metrics ---
const TARGET_RATING_DIFF = 100; // Average rating difference target
const TARGET_COMPLETION_RATE = 0.9; // 90% completion rate target
const TARGET_WIN_RATE_VARIANCE = 0.1; // 10% variance target (45-55%)
const TARGET_QUEUE_TIME_MEDIAN = 60; // 60 seconds median queue time target
const TARGET_ABANDONMENT_RATE = 0.05; // 5% abandonment rate target
// --- Storage Keys ---
const COLLECTION_MATCH_DATA = 'matchmaking_match_data';
const COLLECTION_QUEUE_TIMES = 'matchmaking_queue_times';
const COLLECTION_WEAPON_STATS = 'matchmaking_weapon_stats';
const COLLECTION_BALANCE_ISSUES = 'matchmaking_balance_issues';
/**
 * Aggregates match quality metrics from stored data.
 *
 * @param nk - Nakama runtime module
 * @returns Match quality metrics
 */
async function aggregateMatchMetrics(nk) {
    try {
        // Read all match data
        const matchObjects = await nk.storageRead([
            {
                collection: COLLECTION_MATCH_DATA,
                key: '*',
                userId: '00000000-0000-0000-0000-000000000000', // System user
            },
        ]);
        // Read queue times
        const queueObjects = await nk.storageRead([
            {
                collection: COLLECTION_QUEUE_TIMES,
                key: '*',
                userId: '00000000-0000-0000-0000-000000000000',
            },
        ]);
        // Calculate metrics
        let totalMatches = matchObjects.length;
        let completedMatches = 0;
        let abandonedMatches = 0;
        let ratingDiffSum = 0;
        const ratingDiffs = [];
        const queueTimes = [];
        for (const obj of matchObjects) {
            const matchData = obj.value;
            if (matchData.completed !== false) {
                completedMatches++;
                ratingDiffSum += matchData.rating_diff;
                ratingDiffs.push(matchData.rating_diff);
            }
            else {
                abandonedMatches++;
            }
        }
        for (const obj of queueObjects) {
            const queueData = obj.value;
            queueTimes.push(queueData.queue_time);
        }
        const avgRatingDiff = totalMatches > 0 ? ratingDiffSum / totalMatches : 0;
        const medianQueueTime = calculateMedian(queueTimes);
        return {
            total_matches: totalMatches,
            completed_matches: completedMatches,
            abandoned_matches: abandonedMatches,
            avg_rating_diff: avgRatingDiff,
            median_queue_time: medianQueueTime,
            last_updated: Date.now(),
        };
    }
    catch (error) {
        console.error('Failed to aggregate match metrics:', error);
        return {
            total_matches: 0,
            completed_matches: 0,
            abandoned_matches: 0,
            avg_rating_diff: 0,
            median_queue_time: 0,
            last_updated: Date.now(),
        };
    }
}
/**
 * Generates weapon statistics for balance tuning.
 *
 * @param nk - Nakama runtime module
 * @returns Map of weapon_id to weapon statistics
 */
async function generateWeaponStats(nk) {
    try {
        const weaponObjects = await nk.storageRead([
            {
                collection: COLLECTION_WEAPON_STATS,
                key: '*',
                userId: '00000000-0000-0000-0000-000000000000',
            },
        ]);
        const weaponStats = {};
        for (const obj of weaponObjects) {
            const stats = obj.value;
            const winRate = stats.matches_played > 0 ? stats.wins / stats.matches_played : 0;
            weaponStats[stats.weapon_id] = {
                ...stats,
                win_rate: winRate,
            };
        }
        return weaponStats;
    }
    catch (error) {
        console.error('Failed to generate weapon stats:', error);
        return {};
    }
}
/**
 * Detects balance issues from collected analytics data.
 *
 * @param nk - Nakama runtime module
 * @returns Array of detected balance issues
 */
async function detectBalanceIssues(nk) {
    const issues = [];
    try {
        // Get weapon statistics
        const weaponStats = await generateWeaponStats(nk);
        // Check for weapon balance issues
        for (const [weaponId, stats] of Object.entries(weaponStats)) {
            if (stats.matches_played < 10) {
                continue; // Skip weapons with insufficient data
            }
            const winRate = stats.win_rate;
            // Check for high win rate (overpowered)
            if (winRate > 0.6) {
                const severity = winRate > 0.8 ? 'high' : winRate > 0.7 ? 'medium' : 'low';
                issues.push({
                    weapon_id: weaponId,
                    issue_type: 'high_win_rate',
                    severity,
                    description: `Weapon has ${Math.round(winRate * 100)}% win rate (${stats.matches_played} matches)`,
                    detected_at: Date.now(),
                });
            }
            // Check for low win rate (underpowered)
            else if (winRate < 0.4) {
                const severity = winRate < 0.2 ? 'high' : winRate < 0.3 ? 'medium' : 'low';
                issues.push({
                    weapon_id: weaponId,
                    issue_type: 'low_win_rate',
                    severity,
                    description: `Weapon has ${Math.round(winRate * 100)}% win rate (${stats.matches_played} matches)`,
                    detected_at: Date.now(),
                });
            }
        }
        // Check for overall match quality issues
        const qualityMetrics = await aggregateMatchMetrics(nk);
        if (qualityMetrics.avg_rating_diff > TARGET_RATING_DIFF * 1.5) {
            issues.push({
                weapon_id: 'system',
                issue_type: 'high_rating_diff',
                severity: 'medium',
                description: `Average rating difference (${qualityMetrics.avg_rating_diff.toFixed(1)}) exceeds target (${TARGET_RATING_DIFF})`,
                detected_at: Date.now(),
            });
        }
        const abandonmentRate = qualityMetrics.total_matches > 0
            ? qualityMetrics.abandoned_matches / qualityMetrics.total_matches
            : 0;
        if (abandonmentRate > TARGET_ABANDONMENT_RATE * 1.5) {
            issues.push({
                weapon_id: 'system',
                issue_type: 'high_abandonment_rate',
                severity: 'high',
                description: `Abandonment rate (${(abandonmentRate * 100).toFixed(1)}%) exceeds target (${TARGET_ABANDONMENT_RATE * 100}%)`,
                detected_at: Date.now(),
            });
        }
        // Store detected issues
        if (issues.length > 0) {
            await nk.storageWrite([
                {
                    collection: COLLECTION_BALANCE_ISSUES,
                    key: `issues_${Date.now()}`,
                    userId: '00000000-0000-0000-0000-000000000000',
                    value: JSON.stringify({ issues, timestamp: Date.now() }),
                    permissionRead: 2,
                    permissionWrite: 0,
                },
            ]);
        }
        return issues;
    }
    catch (error) {
        console.error('Failed to detect balance issues:', error);
        return [];
    }
}
/**
 * Exports comprehensive analytics report for admin review.
 *
 * @param nk - Nakama runtime module
 * @returns Analytics report
 */
async function exportAnalyticsReport(nk) {
    try {
        const qualityMetrics = await aggregateMatchMetrics(nk);
        const weaponStats = await generateWeaponStats(nk);
        const ratingDiffDistribution = await calculateRatingDiffDistribution(nk);
        const detectedIssues = await detectBalanceIssues(nk);
        return {
            quality_metrics: qualityMetrics,
            weapon_stats: weaponStats,
            rating_diff_distribution: ratingDiffDistribution,
            detected_issues: detectedIssues,
            export_timestamp: Date.now(),
        };
    }
    catch (error) {
        console.error('Failed to export analytics report:', error);
        throw error;
    }
}
/**
 * Calculates rating difference distribution.
 *
 * @param nk - Nakama runtime module
 * @returns Rating difference distribution
 */
async function calculateRatingDiffDistribution(nk) {
    try {
        const matchObjects = await nk.storageRead([
            {
                collection: COLLECTION_MATCH_DATA,
                key: '*',
                userId: '00000000-0000-0000-0000-000000000000',
            },
        ]);
        const distribution = {
            '0-50': 0,
            '51-100': 0,
            '101-150': 0,
            '151-200': 0,
            '200+': 0,
        };
        for (const obj of matchObjects) {
            const matchData = obj.value;
            const diff = matchData.rating_diff;
            if (diff <= 50) {
                distribution['0-50']++;
            }
            else if (diff <= 100) {
                distribution['51-100']++;
            }
            else if (diff <= 150) {
                distribution['101-150']++;
            }
            else if (diff <= 200) {
                distribution['151-200']++;
            }
            else {
                distribution['200+']++;
            }
        }
        return distribution;
    }
    catch (error) {
        console.error('Failed to calculate rating diff distribution:', error);
        return {
            '0-50': 0,
            '51-100': 0,
            '101-150': 0,
            '151-200': 0,
            '200+': 0,
        };
    }
}
/**
 * Calculates median value from array of numbers.
 *
 * @param values - Array of numbers
 * @returns Median value
 */
function calculateMedian(values) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}
/**
 * Logs match data to storage.
 *
 * @param nk - Nakama runtime module
 * @param request - Match data request
 */
async function logMatchData(nk, request) {
    try {
        await nk.storageWrite([
            {
                collection: COLLECTION_MATCH_DATA,
                key: request.match_id,
                userId: '00000000-0000-0000-0000-000000000000',
                value: JSON.stringify(request),
                permissionRead: 2,
                permissionWrite: 0,
            },
        ]);
        // Log audit trail
        await (0, audit_1.logAudit)(nk, '00000000-0000-0000-0000-000000000000', null, 'match_data_logged', 'match_data', {
            match_id: request.match_id,
            rating_diff: request.rating_diff,
            weapons: request.weapons,
            duration: request.duration,
        }, 'success');
    }
    catch (error) {
        console.error('Failed to log match data:', error);
    }
}
/**
 * Logs abandonment data to storage.
 *
 * @param nk - Nakama runtime module
 * @param request - Abandonment request
 */
async function logAbandonment(nk, request) {
    try {
        // Update match data to mark as abandoned
        const matchObjects = await nk.storageRead([
            {
                collection: COLLECTION_MATCH_DATA,
                key: request.match_id,
                userId: '00000000-0000-0000-0000-000000000000',
            },
        ]);
        if (matchObjects.length > 0) {
            const matchData = matchObjects[0].value;
            matchData.completed = false;
            matchData.abandoned = true;
            matchData.abandonment_reason = request.reason;
            await nk.storageWrite([
                {
                    collection: COLLECTION_MATCH_DATA,
                    key: request.match_id,
                    userId: '00000000-0000-0000-0000-000000000000',
                    value: JSON.stringify(matchData),
                    permissionRead: 2,
                    permissionWrite: 0,
                },
            ]);
        }
        // Log audit trail
        await (0, audit_1.logAudit)(nk, '00000000-0000-0000-0000-000000000000', null, 'abandonment_logged', 'abandonment', {
            match_id: request.match_id,
            reason: request.reason,
        }, 'success');
    }
    catch (error) {
        console.error('Failed to log abandonment:', error);
    }
}
/**
 * Logs weapon result data to storage.
 *
 * @param nk - Nakama runtime module
 * @param weaponId - Weapon identifier
 * @param isWin - True if weapon user won
 * @param ratingDiff - Rating difference for the match
 */
async function logWeaponResult(nk, weaponId, isWin, ratingDiff) {
    try {
        const statsKey = `weapon_stats_${weaponId}`;
        const objects = await nk.storageRead([
            {
                collection: COLLECTION_WEAPON_STATS,
                key: statsKey,
                userId: '00000000-0000-0000-0000-000000000000',
            },
        ]);
        let stats = {
            weapon_id: weaponId,
            matches_played: 0,
            wins: 0,
            losses: 0,
            win_rate: 0,
            avg_rating_diff: 0,
            last_updated: Date.now(),
        };
        if (objects.length > 0) {
            stats = objects[0].value;
        }
        // Update statistics
        stats.matches_played++;
        if (isWin) {
            stats.wins++;
        }
        else {
            stats.losses++;
        }
        // Update average rating difference
        stats.avg_rating_diff =
            (stats.avg_rating_diff * (stats.matches_played - 1) + ratingDiff) / stats.matches_played;
        stats.last_updated = Date.now();
        await nk.storageWrite([
            {
                collection: COLLECTION_WEAPON_STATS,
                key: statsKey,
                userId: '00000000-0000-0000-0000-000000000000',
                value: JSON.stringify(stats),
                permissionRead: 2,
                permissionWrite: 0,
            },
        ]);
    }
    catch (error) {
        console.error('Failed to log weapon result:', error);
    }
}
/**
 * Logs queue time data to storage.
 *
 * @param nk - Nakama runtime module
 * @param request - Queue time request
 */
async function logQueueTime(nk, request) {
    try {
        const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await nk.storageWrite([
            {
                collection: COLLECTION_QUEUE_TIMES,
                key: queueId,
                userId: '00000000-0000-0000-0000-000000000000',
                value: JSON.stringify(request),
                permissionRead: 2,
                permissionWrite: 0,
            },
        ]);
        // Prune old queue times (keep only last 10000)
        const allQueueObjects = await nk.storageRead([
            {
                collection: COLLECTION_QUEUE_TIMES,
                key: '*',
                userId: '00000000-0000-0000-0000-000000000000',
            },
        ]);
        if (allQueueObjects.length > 10000) {
            const toDelete = allQueueObjects.slice(0, allQueueObjects.length - 10000);
            for (const obj of toDelete) {
                await nk.storageDelete([
                    {
                        collection: COLLECTION_QUEUE_TIMES,
                        key: obj.key,
                        userId: '00000000-0000-0000-0000-000000000000',
                    },
                ]);
            }
        }
    }
    catch (error) {
        console.error('Failed to log queue time:', error);
    }
}
/**
 * RPC handler for logging match data.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
async function rpcLogMatchData(ctx, logger, nk, payload) {
    logger.debug('LogMatchData RPC called');
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.log_match_data, payload, 'LogMatchData');
    if (!validation.success) {
        return JSON.stringify(validation.error);
    }
    await logMatchData(nk, validation.data);
    return JSON.stringify({
        success: true,
        match_id: validation.data.match_id,
    });
}
/**
 * RPC handler for logging abandonment.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
async function rpcLogAbandonment(ctx, logger, nk, payload) {
    logger.debug('LogAbandonment RPC called');
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.log_abandonment, payload, 'LogAbandonment');
    if (!validation.success) {
        return JSON.stringify(validation.error);
    }
    await logAbandonment(nk, validation.data);
    return JSON.stringify({
        success: true,
        match_id: validation.data.match_id,
    });
}
/**
 * RPC handler for logging weapon result.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
async function rpcLogWeaponResult(ctx, logger, nk, payload) {
    logger.debug('LogWeaponResult RPC called');
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.log_weapon_result, payload, 'LogWeaponResult');
    if (!validation.success) {
        return JSON.stringify(validation.error);
    }
    await logWeaponResult(nk, validation.data.weapon_id, validation.data.is_win, validation.data.rating_diff || 0);
    return JSON.stringify({
        success: true,
        weapon_id: validation.data.weapon_id,
    });
}
/**
 * RPC handler for logging queue time.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
async function rpcLogQueueTime(ctx, logger, nk, payload) {
    logger.debug('LogQueueTime RPC called');
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.log_queue_time, payload, 'LogQueueTime');
    if (!validation.success) {
        return JSON.stringify(validation.error);
    }
    await logQueueTime(nk, validation.data);
    return JSON.stringify({
        success: true,
    });
}
/**
 * RPC handler for getting match quality metrics.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
async function rpcGetMatchQualityMetrics(ctx, logger, nk, _payload) {
    logger.debug('GetMatchQualityMetrics RPC called');
    try {
        const metrics = await aggregateMatchMetrics(nk);
        return JSON.stringify({
            success: true,
            metrics,
        });
    }
    catch (error) {
        logger.error('Failed to get match quality metrics: %s', error);
        return JSON.stringify({
            success: false,
            error: 'Failed to retrieve metrics',
        });
    }
}
/**
 * RPC handler for getting weapon statistics.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
async function rpcGetWeaponStats(ctx, logger, nk, payload) {
    logger.debug('GetWeaponStats RPC called');
    let weaponId;
    if (payload && payload.trim() !== '{}') {
        try {
            const parsed = JSON.parse(payload);
            weaponId = parsed.weapon_id;
        }
        catch {
            // Invalid JSON, ignore
        }
    }
    try {
        if (weaponId) {
            // Return stats for specific weapon
            const stats = await generateWeaponStats(nk);
            return JSON.stringify({
                success: true,
                weapon_id: weaponId,
                stats: stats[weaponId] || null,
            });
        }
        // Return all weapon stats
        const stats = await generateWeaponStats(nk);
        return JSON.stringify({
            success: true,
            stats,
        });
    }
    catch (error) {
        logger.error('Failed to get weapon stats: %s', error);
        return JSON.stringify({
            success: false,
            error: 'Failed to retrieve weapon stats',
        });
    }
}
/**
 * RPC handler for detecting balance issues.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
async function rpcDetectBalanceIssues(ctx, logger, nk, _payload) {
    logger.debug('DetectBalanceIssues RPC called');
    try {
        const issues = await detectBalanceIssues(nk);
        return JSON.stringify({
            success: true,
            issues,
            count: issues.length,
        });
    }
    catch (error) {
        logger.error('Failed to detect balance issues: %s', error);
        return JSON.stringify({
            success: false,
            error: 'Failed to detect balance issues',
        });
    }
}
/**
 * RPC handler for exporting analytics report.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
async function rpcExportAnalyticsReport(ctx, logger, nk, _payload) {
    logger.debug('ExportAnalyticsReport RPC called');
    try {
        const report = await exportAnalyticsReport(nk);
        return JSON.stringify({
            success: true,
            report,
        });
    }
    catch (error) {
        logger.error('Failed to export analytics report: %s', error);
        return JSON.stringify({
            success: false,
            error: 'Failed to export analytics report',
        });
    }
}
// Export target metrics constants
exports.MATCHMAKING_ANALYTICS_TARGETS = {
    TARGET_RATING_DIFF,
    TARGET_COMPLETION_RATE,
    TARGET_WIN_RATE_VARIANCE,
    TARGET_QUEUE_TIME_MEDIAN,
    TARGET_ABANDONMENT_RATE,
};
/**
 * Registers all matchmaking analytics RPC endpoints.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerMatchmakingAnalyticsEndpoints(initializer) {
    // Data logging endpoints
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/log_match_data', 'log_match_data', rpcLogMatchData);
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/log_abandonment', 'log_abandonment', rpcLogAbandonment);
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/log_weapon_result', 'log_weapon_result', rpcLogWeaponResult);
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/log_queue_time', 'log_queue_time', rpcLogQueueTime);
    // Analytics query endpoints
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/get_match_quality_metrics', 'get_match_quality_metrics', rpcGetMatchQualityMetrics);
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/get_weapon_stats', 'get_weapon_stats', rpcGetWeaponStats);
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/detect_balance_issues', 'detect_balance_issues', rpcDetectBalanceIssues);
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/export_analytics_report', 'export_analytics_report', rpcExportAnalyticsReport);
}
