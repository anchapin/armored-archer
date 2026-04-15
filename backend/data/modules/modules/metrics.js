"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRpcMetrics = registerRpcMetrics;
exports.wrapRpcWithMetrics = wrapRpcWithMetrics;
exports.registerRpcWithMetrics = registerRpcWithMetrics;
exports.registerRpcWithRateLimit = registerRpcWithRateLimit;
exports.getMetricsRegistry = getMetricsRegistry;
exports.recordRateLimitViolation = recordRateLimitViolation;
exports.updateActiveUsersCount = updateActiveUsersCount;
exports.setActiveSessions = setActiveSessions;
exports.incrementNewRegistration = incrementNewRegistration;
exports.recordLoginAttempt = recordLoginAttempt;
exports.recordSessionDuration = recordSessionDuration;
exports.incrementMatchCreated = incrementMatchCreated;
exports.incrementMatchCompleted = incrementMatchCompleted;
exports.setMatchQueueSize = setMatchQueueSize;
exports.recordMatchWaitTime = recordMatchWaitTime;
exports.recordMatchPlayersCount = recordMatchPlayersCount;
exports.recordPurchase = recordPurchase;
exports.recordRevenue = recordRevenue;
exports.recordCurrencySpent = recordCurrencySpent;
exports.recordCurrencyEarned = recordCurrencyEarned;
exports.recordCombatAction = recordCombatAction;
exports.recordDamageDealt = recordDamageDealt;
exports.recordCombatDuration = recordCombatDuration;
exports.recordPveStageCompleted = recordPveStageCompleted;
exports.incrementPlayerLevelUp = incrementPlayerLevelUp;
exports.incrementGearUnlock = incrementGearUnlock;
exports.incrementSeasonParticipation = incrementSeasonParticipation;
exports.recordAnalyticsEvent = recordAnalyticsEvent;
exports.recordDatabaseQueryDuration = recordDatabaseQueryDuration;
exports.setCacheHitRatio = setCacheHitRatio;
const tslib_1 = require("tslib");
const prom_client_1 = require("prom-client");
const config_1 = require("../config");
const rateLimiter = tslib_1.__importStar(require("../utils/rateLimiter"));
const deployment_observability_1 = require("./deployment_observability");
const n_plus_one_detection_1 = require("./n_plus_one_detection");
const validation_1 = require("./validation");
const register = new prom_client_1.Registry();
(0, prom_client_1.collectDefaultMetrics)({ register });
// Initialize N+1 detection with metrics if enabled
if (config_1.config.nPlusOne && config_1.config.nPlusOne.enabled && config_1.config.nPlusOne.metricsEnabled) {
    (0, n_plus_one_detection_1.initializeNPlusOneDetectionWithMetrics)(register);
}
// ==========================================
// Core RPC Metrics
// ==========================================
const rpcCallsTotal = new prom_client_1.Counter({
    name: 'armored_archer_rpc_calls_total',
    help: 'Total number of RPC calls',
    labelNames: ['rpc', 'status'],
    registers: [register],
});
const rpcDurationSeconds = new prom_client_1.Histogram({
    name: 'armored_archer_rpc_duration_seconds',
    help: 'RPC call duration in seconds',
    labelNames: ['rpc'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [register],
});
const rpcErrorsTotal = new prom_client_1.Counter({
    name: 'armored_archer_rpc_errors_total',
    help: 'Total number of RPC errors',
    labelNames: ['rpc', 'error_type'],
    registers: [register],
});
// ==========================================
// Rate Limiting Metrics
// ==========================================
const rateLimitViolationsTotal = new prom_client_1.Counter({
    name: 'armored_archer_rate_limit_violations_total',
    help: 'Total number of rate limit violations',
    labelNames: ['rpc'],
    registers: [register],
});
const rateLimitActiveUsers = new prom_client_1.Gauge({
    name: 'armored_archer_rate_limit_active_users',
    help: 'Number of users currently being rate limited',
    registers: [register],
});
// ==========================================
// Player Metrics
// ==========================================
const playerActiveSessions = new prom_client_1.Gauge({
    name: 'armored_archer_player_active_sessions',
    help: 'Number of currently active player sessions',
    registers: [register],
});
const playerNewRegistrations = new prom_client_1.Counter({
    name: 'armored_archer_player_new_registrations_total',
    help: 'Total number of new player registrations',
    labelNames: ['platform'],
    registers: [register],
});
const playerLoginAttempts = new prom_client_1.Counter({
    name: 'armored_archer_player_login_attempts_total',
    help: 'Total number of player login attempts',
    labelNames: ['status'],
    registers: [register],
});
const playerSessionDuration = new prom_client_1.Histogram({
    name: 'armored_archer_player_session_duration_seconds',
    help: 'Player session duration in seconds',
    buckets: [30, 60, 120, 300, 600, 1800, 3600, 7200, 14400],
    registers: [register],
});
// ==========================================
// Match/Multiplayer Metrics
// ==========================================
const matchesCreatedTotal = new prom_client_1.Counter({
    name: 'armored_archer_matches_created_total',
    help: 'Total number of matches created',
    labelNames: ['match_type'],
    registers: [register],
});
const matchesCompletedTotal = new prom_client_1.Counter({
    name: 'armored_archer_matches_completed_total',
    help: 'Total number of matches completed',
    labelNames: ['match_type', 'result'],
    registers: [register],
});
const matchQueueSize = new prom_client_1.Gauge({
    name: 'armored_archer_match_queue_size',
    help: 'Current number of players in match queue',
    labelNames: ['match_type'],
    registers: [register],
});
const matchWaitTimeSeconds = new prom_client_1.Histogram({
    name: 'armored_archer_match_wait_time_seconds',
    help: 'Time players wait for match in seconds',
    labelNames: ['match_type'],
    buckets: [1, 5, 10, 30, 60, 120, 180, 300],
    registers: [register],
});
const matchPlayersCount = new prom_client_1.Histogram({
    name: 'armored_archer_match_players_count',
    help: 'Number of players per match',
    labelNames: ['match_type'],
    buckets: [1, 2, 4, 8, 16],
    registers: [register],
});
// ==========================================
// Economy/Store Metrics
// ==========================================
const purchasesTotal = new prom_client_1.Counter({
    name: 'armored_archer_purchases_total',
    help: 'Total number of purchases',
    labelNames: ['product_type', 'status'],
    registers: [register],
});
const purchaseRevenue = new prom_client_1.Counter({
    name: 'armored_archer_purchase_revenue_total',
    help: 'Total purchase revenue in cents',
    labelNames: ['currency', 'product_type'],
    registers: [register],
});
const currencySpent = new prom_client_1.Counter({
    name: 'armored_archer_currency_spent_total',
    help: 'Total in-game currency spent',
    labelNames: ['currency_type', 'reason'],
    registers: [register],
});
const currencyEarned = new prom_client_1.Counter({
    name: 'armored_archer_currency_earned_total',
    help: 'Total in-game currency earned',
    labelNames: ['currency_type', 'source'],
    registers: [register],
});
// ==========================================
// Combat/Gameplay Metrics
// ==========================================
const combatActionsTotal = new prom_client_1.Counter({
    name: 'armored_archer_combat_actions_total',
    help: 'Total number of combat actions',
    labelNames: ['action_type', 'result'],
    registers: [register],
});
const combatDamageDealt = new prom_client_1.Histogram({
    name: 'armored_archer_combat_damage_dealt',
    help: 'Damage dealt per action',
    labelNames: ['target_type'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [register],
});
const combatDuration = new prom_client_1.Histogram({
    name: 'armored_archer_combat_duration_seconds',
    help: 'Duration of combat encounters',
    buckets: [5, 10, 30, 60, 120, 300, 600],
    registers: [register],
});
const pveStagesCompleted = new prom_client_1.Counter({
    name: 'armored_archer_pve_stages_completed_total',
    help: 'Total number of PvE stages completed',
    labelNames: ['stage_difficulty', 'stars'],
    registers: [register],
});
// ==========================================
// Progression Metrics
// ==========================================
const playerLevelUps = new prom_client_1.Counter({
    name: 'armored_archer_player_level_ups_total',
    help: 'Total number of player level ups',
    registers: [register],
});
const gearUnlocks = new prom_client_1.Counter({
    name: 'armored_archer_gear_unlocks_total',
    help: 'Total number of gear items unlocked',
    labelNames: ['rarity'],
    registers: [register],
});
const seasonParticipation = new prom_client_1.Counter({
    name: 'armored_archer_season_participation_total',
    help: 'Total season participations',
    labelNames: ['season_id'],
    registers: [register],
});
// ==========================================
// Analytics Event Metrics
// ==========================================
const analyticsEventsTotal = new prom_client_1.Counter({
    name: 'armored_archer_analytics_events_total',
    help: 'Total number of analytics events',
    labelNames: ['event_category', 'event_name'],
    registers: [register],
});
// ==========================================
// Performance Metrics
// ==========================================
const databaseQueryDuration = new prom_client_1.Histogram({
    name: 'armored_archer_db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['query_type'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [register],
});
const cacheHitRatio = new prom_client_1.Gauge({
    name: 'armored_archer_cache_hit_ratio',
    help: 'Cache hit ratio (0-1)',
    labelNames: ['cache_type'],
    registers: [register],
});
// Register rate limiter callbacks
rateLimiter.setMetricsCallbacks(recordRateLimitViolation, updateActiveUsersCount);
function registerRpcMetrics(initializer) {
    initializer.registerRpc('armored_archer/metrics', rpcGetMetrics);
    initializer.registerRpc('armored_archer/n_plus_one_report', rpcGetNPlusOneReport);
}
// RPC handler for N+1 detection report
async function rpcGetNPlusOneReport(ctx, logger, _nk, _payload) {
    logger.info('N+1 report endpoint called by user: %s', ctx.userId);
    const report = (0, n_plus_one_detection_1.getNPlusOneReport)();
    return JSON.stringify(report, null, 2);
}
async function rpcGetMetrics(ctx, logger, _nk, payload) {
    logger.info('Metrics endpoint called by user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.health_check, payload, 'metrics');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('metrics', validation.error);
    }
    // Get base metrics in Prometheus text format
    const baseMetrics = await register.metrics();
    // Get deployment metrics
    const deploymentRegistry = (0, deployment_observability_1.getDeploymentRegistry)();
    const deploymentMetrics = await deploymentRegistry.metrics();
    // Combine both metrics (deployment metrics have different metric names to avoid conflicts)
    return baseMetrics + '\n# Deployment metrics\n' + deploymentMetrics;
}
function wrapRpcWithMetrics(rpcName, handler) {
    return async function (ctx, logger, nk, payload) {
        const endTimer = rpcDurationSeconds.startTimer({ rpc: rpcName });
        try {
            const result = await handler(ctx, logger, nk, payload);
            rpcCallsTotal.inc({ rpc: rpcName, status: 'success' });
            return result;
        }
        catch (error) {
            const errorType = error instanceof Error ? error.constructor.name : 'unknown';
            rpcCallsTotal.inc({ rpc: rpcName, status: 'error' });
            rpcErrorsTotal.inc({ rpc: rpcName, error_type: errorType });
            throw error;
        }
        finally {
            endTimer();
        }
    };
}
function registerRpcWithMetrics(initializer, rpcId, rpcName, handler) {
    const wrappedHandler = wrapRpcWithMetrics(rpcName, handler);
    initializer.registerRpc(rpcId, wrappedHandler);
}
function registerRpcWithRateLimit(initializer, rpcId, rpcName, handler) {
    if (!config_1.config.rateLimit.enabled) {
        registerRpcWithMetrics(initializer, rpcId, rpcName, handler);
        return;
    }
    const endpointConfig = config_1.config.rateLimit.endpoints[rpcName];
    if (endpointConfig) {
        rateLimiter.setEndpointRateLimit(rpcName, endpointConfig);
    }
    const wrappedWithRateLimit = rateLimiter.createRateLimitedRpcHandler(rpcName, handler);
    const wrappedWithMetrics = wrapRpcWithMetrics(rpcName, wrappedWithRateLimit);
    initializer.registerRpc(rpcId, wrappedWithMetrics);
}
function getMetricsRegistry() {
    return register;
}
function recordRateLimitViolation(rpcName) {
    rateLimitViolationsTotal.inc({ rpc: rpcName });
}
function updateActiveUsersCount(count) {
    rateLimitActiveUsers.set(count);
}
// ==========================================
// Player Metric Functions
// ==========================================
function setActiveSessions(count) {
    playerActiveSessions.set(count);
}
function incrementNewRegistration(platform) {
    playerNewRegistrations.inc({ platform });
}
function recordLoginAttempt(success) {
    playerLoginAttempts.inc({ status: success ? 'success' : 'failure' });
}
function recordSessionDuration(durationSeconds) {
    playerSessionDuration.observe(durationSeconds);
}
// ==========================================
// Match/Multiplayer Metric Functions
// ==========================================
function incrementMatchCreated(matchType) {
    matchesCreatedTotal.inc({ match_type: matchType });
}
function incrementMatchCompleted(matchType, result) {
    matchesCompletedTotal.inc({ match_type: matchType, result });
}
function setMatchQueueSize(matchType, size) {
    matchQueueSize.set({ match_type: matchType }, size);
}
function recordMatchWaitTime(matchType, waitTimeSeconds) {
    matchWaitTimeSeconds.observe({ match_type: matchType }, waitTimeSeconds);
}
function recordMatchPlayersCount(matchType, count) {
    matchPlayersCount.observe({ match_type: matchType }, count);
}
// ==========================================
// Economy/Store Metric Functions
// ==========================================
function recordPurchase(productType, success) {
    purchasesTotal.inc({ product_type: productType, status: success ? 'success' : 'failure' });
}
function recordRevenue(amount, currency, productType) {
    purchaseRevenue.inc({ currency, product_type: productType }, amount);
}
function recordCurrencySpent(currencyType, reason, amount) {
    currencySpent.inc({ currency_type: currencyType, reason }, amount);
}
function recordCurrencyEarned(currencyType, source, amount) {
    currencyEarned.inc({ currency_type: currencyType, source }, amount);
}
// ==========================================
// Combat/Gameplay Metric Functions
// ==========================================
function recordCombatAction(actionType, result) {
    combatActionsTotal.inc({ action_type: actionType, result });
}
function recordDamageDealt(targetType, damage) {
    combatDamageDealt.observe({ target_type: targetType }, damage);
}
function recordCombatDuration(durationSeconds) {
    combatDuration.observe(durationSeconds);
}
function recordPveStageCompleted(difficulty, stars) {
    pveStagesCompleted.inc({ stage_difficulty: difficulty, stars: String(stars) });
}
// ==========================================
// Progression Metric Functions
// ==========================================
function incrementPlayerLevelUp() {
    playerLevelUps.inc();
}
function incrementGearUnlock(rarity) {
    gearUnlocks.inc({ rarity });
}
function incrementSeasonParticipation(seasonId) {
    seasonParticipation.inc({ season_id: seasonId });
}
// ==========================================
// Analytics Event Metric Functions
// ==========================================
function recordAnalyticsEvent(eventCategory, eventName) {
    analyticsEventsTotal.inc({ event_category: eventCategory, event_name: eventName });
}
// ==========================================
// Performance Metric Functions
// ==========================================
function recordDatabaseQueryDuration(queryType, durationSeconds) {
    databaseQueryDuration.observe({ query_type: queryType }, durationSeconds);
}
function setCacheHitRatio(cacheType, ratio) {
    cacheHitRatio.set({ cache_type: cacheType }, ratio);
}
