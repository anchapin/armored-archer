import { InitModule, Runtime } from './types/nakama';

// Polyfill for CommonJS compatibility in Nakama
if (typeof (globalThis as any).exports === 'undefined') {
  (globalThis as any).exports = {};
}
import './config';
import { validateRequiredConfig, config } from './config';
import { initializeCaches } from './utils/cache';
import {
  registerRpcHealthCheck,
  registerRpcReportPlayer,
  registerRpcGetPlayerReports,
  registerRpcGetPlayerStats,
} from './modules/player_rpc';
import {
  registerRpcGainXP,
  registerRpcAllocateStats,
  registerRpcRespecStats,
  registerRpcSaveBuild,
  registerRpcLoadBuild,
  registerRpcGetBuilds,
} from './modules/rpg_system';
import {
  registerRpcListMatches,
  registerRpcCreateMatch,
  registerRpcAcceptMatch,
  registerRpcGetPlayerRank,
  registerRpcCompleteMatch,
} from './modules/matchmaker';
import {
  registerRpcJoinPool,
  registerRpcLeavePool,
  registerRpcGetQueueStatus,
} from './modules/matchmaking_pool';
import {
  registerRpcSubmitCombatAction,
  registerRpcGetMatchState,
  registerRpcPlayerDisconnect,
} from './modules/combat_system';
import {
  registerRpcGetSeasonInfo,
  registerRpcGetLeaderboard,
  registerRpcUpdateRank,
  registerRpcGetSeasonRewards,
  registerRpcClaimSeasonRewards,
  registerRpcEndSeason,
} from './modules/season_system';
import {
  registerRpcValidatePurchase,
  registerRpcGetCurrency,
  registerRpcSpendGems,
  registerRpcProcessPendingPurchases,
  registerRpcCheckRefunds,
  registerRpcCheckSubscriptions,
  registerRpcAppLaunchCheck,
  registerRpcRevenueCatWebhook,
  rpcProcessPendingPurchases,
  rpcCheckRefunds,
  rpcCheckSubscriptions,
  rpcAppLaunchCheck,
} from './modules/store';
import {
  registerRpcGenerateGear,
  registerRpcEquipGear,
  registerRpcUnequipGear,
  registerRpcGetInventory,
  registerRpcUnlockModifierPool,
  registerRpcStageComplete,
  registerRpcGetUnlockedModifiers,
} from './modules/gear_system';
import { registerRpcMetrics, registerRpcWithRateLimit } from './modules/metrics';
import { registerDeploymentObservability, initializeDeploymentObservability } from './modules/deployment_observability';
import { registerProgressiveRollout, initializeProgressiveRollout } from './modules/progressive_rollout';
import { initializeAlerting } from './modules/alerting';
import { initializeHealthMonitoring } from './modules/health_monitor';
import { registerAnalyticsEndpoints } from './modules/analytics';
import { registerMatchmakingAnalyticsEndpoints } from './modules/matchmaking_analytics';
import { initializeSentry } from './config/errorTracking';
import { initializeTracing } from './config/tracing';
import { logger, logSystemEvent } from './config/logger';
import { createStructuredLogger, StructuredLogger } from './config/structuredLogger';
import { registerErrorInsightRpcs, initializeErrorInsightsPipeline } from './modules/error_insight_pipeline';
import {
  registerRpcCompleteStage,
  registerRpcGetCompletedStages,
  registerRpcGetCampaignProgress,
} from './modules/stage_tracking';
import { initializeNotifications, registerNotificationEndpoints } from './modules/notifications_rpc';
import { startNotificationScheduler, stopNotificationScheduler } from './modules/notification_scheduler';
import {
  registerRpcSyncDifficulty,
  registerRpcTrackMatchOutcome,
  registerRpcGetPlayerPerformance,
} from './modules/dynamic_difficulty';

// Global structured logger instance for use by all modules
let globalStructuredLogger: StructuredLogger | null = null;

/**
 * Gets the global structured logger instance.
 * Must be initialized during module startup.
 * Returns a no-op logger in test environment if not initialized.
 *
 * @returns The global StructuredLogger instance
 * @throws Error if not initialized (only in production)
 */
export function getStructuredLogger(): StructuredLogger {
  if (!globalStructuredLogger) {
    // In test environment, return a no-op logger to prevent test failures
    // Note: Tests should still work if they want to verify logging by
    // manually calling initializeStructuredLogger with a mock
    if (process.env.NODE_ENV === 'test') {
      return createNoOpLogger();
    }
    throw new Error('StructuredLogger not initialized. Call initializeStructuredLogger first.');
  }
  return globalStructuredLogger;
}

/**
 * Creates a no-op logger for test environments
 */
function createNoOpLogger(): StructuredLogger {
  const noOpFunc = () => {};
  return {
    info: noOpFunc,
    warn: noOpFunc,
    error: noOpFunc,
    debug: noOpFunc,
    child: () => createNoOpLogger(),
    logRpcEntry: noOpFunc,
    logRpcExit: noOpFunc,
    logRpcError: noOpFunc,
    logSystemEvent: noOpFunc,
    logCacheOperation: noOpFunc,
    logDatabaseOperation: noOpFunc,
  } as unknown as StructuredLogger;
}

/**
 * Check if structured logger has been initialized
 * Useful for tests that want to verify logging
 */
export function isStructuredLoggerInitialized(): boolean {
  return globalStructuredLogger !== null;
}

/**
 * Initializes the global structured logger with the Nakama runtime logger.
 *
 * @param runtimeLogger - The Nakama Runtime.Logger instance
 * @param serviceName - Name of the service
 */
export function initializeStructuredLogger(runtimeLogger: Runtime.Logger, serviceName: string = 'armored-archer-backend'): void {
  globalStructuredLogger = createStructuredLogger(runtimeLogger, serviceName, {
    environment: process.env.NODE_ENV || 'development',
  });
}

const InitModule: InitModule = function (
  ctx: Runtime.Context,
  loggerParam: Runtime.Logger,
  nk: Runtime.Nakama,
  initializer: Runtime.Initializer
) {
  initializeSentry();
  initializeTracing();
  initializeAlerting(loggerParam);
  initializeStructuredLogger(loggerParam);
  logSystemEvent('info', 'Server initialization started');

  validateRequiredConfig();
  initializeCaches(loggerParam);
  initializeDeploymentObservability(loggerParam);
  initializeHealthMonitoring(loggerParam);
  initializeErrorInsightsPipeline(loggerParam);
  initializeProgressiveRollout(loggerParam);
  initializeNotifications();

  if (config.rateLimit.enabled) {
    logSystemEvent('info', 'Rate limiting enabled', {
      defaultMaxRequests: config.rateLimit.defaultMaxRequests,
      defaultWindowMs: config.rateLimit.defaultWindowMs,
      endpointsConfigured: Object.keys(config.rateLimit.endpoints).length,
    });
  } else {
    logSystemEvent('info', 'Rate limiting disabled');
  }

  logSystemEvent('info', 'Registering RPC handlers');

  registerRpcMetrics(initializer);
  registerDeploymentObservability(initializer);
  registerProgressiveRollout(initializer);
  registerAnalyticsEndpoints(initializer);
  registerMatchmakingAnalyticsEndpoints(initializer);
  registerErrorInsightRpcs(initializer);
  registerNotificationEndpoints(initializer);

  if (config.rateLimit.enabled) {
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/health_check',
      'health_check',
      rpcHealthCheckWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/get_player_stats',
      'get_player_stats',
      rpcGetPlayerStatsWrapper
    );
    registerRpcWithRateLimit(initializer, 'armored_archer/gain_xp', 'gain_xp', rpcGainXPWrapper);
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/allocate_stats',
      'allocate_stats',
      rpcAllocateStatsWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/respec_stats',
      'respec_stats',
      rpcRespecStatsWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/save_build',
      'save_build',
      rpcSaveBuildWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/load_build',
      'load_build',
      rpcLoadBuildWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/get_builds',
      'get_builds',
      rpcGetBuildsWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/submit_combat_action',
      'submit_combat_action',
      rpcSubmitCombatActionWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/get_match_state',
      'get_match_state',
      rpcGetMatchStateWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/create_match',
      'create_match',
      rpcCreateMatchWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/accept_match',
      'accept_match',
      rpcAcceptMatchWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/get_leaderboard',
      'get_leaderboard',
      rpcGetLeaderboardWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/validate_purchase',
      'validate_purchase',
      rpcValidatePurchaseWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/spend_gems',
      'spend_gems',
      rpcSpendGemsWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/process_pending_purchases',
      'process_pending_purchases',
      rpcProcessPendingPurchases
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/check_refunds',
      'check_refunds',
      rpcCheckRefunds
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/check_subscriptions',
      'check_subscriptions',
      rpcCheckSubscriptions
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/app_launch_check',
      'app_launch_check',
      rpcAppLaunchCheck
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/revenuecat_webhook',
      'revenuecat_webhook',
      rpcRevenueCatWebhookWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/generate_gear',
      'generate_gear',
      rpcGenerateGearWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/equip_gear',
      'equip_gear',
      rpcEquipGearWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/stage_complete',
      'stage_complete',
      rpcStageCompleteWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/complete_stage',
      'complete_stage',
      rpcCompleteStageWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/get_campaign_progress',
      'get_campaign_progress',
      rpcGetCampaignProgressWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/get_campaign_progress',
      'get_campaign_progress',
      rpcGetCampaignProgressWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/report_player',
      'report_player',
      rpcReportPlayerWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/sync_difficulty',
      'sync_difficulty',
      rpcSyncDifficultyWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/track_match_outcome',
      'track_match_outcome',
      rpcTrackMatchOutcomeWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/get_player_performance',
      'get_player_performance',
      rpcGetPlayerPerformanceWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/get_player_reports',
      'get_player_reports',
      rpcGetPlayerReportsWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/track_event',
      'track_event',
      rpcTrackEventWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/get_analytics_summary',
      'get_analytics_summary',
      rpcGetAnalyticsSummaryWrapper
    );
    registerRpcWithRateLimit(
      initializer,
      'armored_archer/track_revenue',
      'track_revenue',
      rpcTrackRevenueWrapper
    );
  } else {
    registerRpcHealthCheck(initializer);
    registerRpcGainXP(initializer);
    registerRpcAllocateStats(initializer);
    registerRpcRespecStats(initializer);
    registerRpcSaveBuild(initializer);
    registerRpcLoadBuild(initializer);
    registerRpcGetBuilds(initializer);
    registerRpcGetPlayerStats(initializer);
    registerRpcListMatches(initializer);
    registerRpcCreateMatch(initializer);
    registerRpcAcceptMatch(initializer);
    registerRpcGetPlayerRank(initializer);
    registerRpcCompleteMatch(initializer);
    registerRpcSubmitCombatAction(initializer);
    registerRpcGetMatchState(initializer);
    registerRpcPlayerDisconnect(initializer);
    registerRpcGetSeasonInfo(initializer);
    registerRpcGetLeaderboard(initializer);
    registerRpcUpdateRank(initializer);
    registerRpcGetSeasonRewards(initializer);
    registerRpcClaimSeasonRewards(initializer);
    registerRpcEndSeason(initializer);
    registerRpcValidatePurchase(initializer);
    registerRpcGetCurrency(initializer);
    registerRpcSpendGems(initializer);
    registerRpcProcessPendingPurchases(initializer);
    registerRpcCheckRefunds(initializer);
    registerRpcCheckSubscriptions(initializer);
    registerRpcAppLaunchCheck(initializer);
    registerRpcRevenueCatWebhook(initializer);
    registerRpcGenerateGear(initializer);
    registerRpcEquipGear(initializer);
    registerRpcUnequipGear(initializer);
    registerRpcGetInventory(initializer);
    registerRpcUnlockModifierPool(initializer);
    registerRpcStageComplete(initializer);
    registerRpcGetUnlockedModifiers(initializer);
    registerRpcReportPlayer(initializer);
    registerRpcGetPlayerReports(initializer);
    registerRpcCompleteStage(initializer);
    registerRpcGetCompletedStages(initializer);
    registerRpcGetCampaignProgress(initializer);
    registerRpcJoinPool(initializer);
    registerRpcLeavePool(initializer);
    registerRpcGetQueueStatus(initializer);
    registerRpcSyncDifficulty(initializer);
    registerRpcTrackMatchOutcome(initializer);
    registerRpcGetPlayerPerformance(initializer);
  }

  logSystemEvent('info', 'Armored Archer server module initialized');
};

function rpcHealthCheckWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcHealthCheck } = require('./modules/player_rpc');
  return rpcHealthCheck(ctx, logger, nk, payload);
}

function rpcGetPlayerStatsWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGetPlayerStats } = require('./modules/player_rpc');
  return rpcGetPlayerStats(ctx, logger, nk, payload);
}

function rpcGainXPWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGainXP } = require('./modules/rpg_system');
  return rpcGainXP(ctx, logger, nk, payload);
}

function rpcAllocateStatsWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcAllocateStats } = require('./modules/rpg_system');
  return rpcAllocateStats(ctx, logger, nk, payload);
}

function rpcRespecStatsWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcRespecStats } = require('./modules/rpg_system');
  return rpcRespecStats(ctx, logger, nk, payload);
}

function rpcSaveBuildWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcSaveBuild } = require('./modules/rpg_system');
  return rpcSaveBuild(ctx, logger, nk, payload);
}

function rpcLoadBuildWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcLoadBuild } = require('./modules/rpg_system');
  return rpcLoadBuild(ctx, logger, nk, payload);
}

function rpcGetBuildsWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGetBuilds } = require('./modules/rpg_system');
  return rpcGetBuilds(ctx, logger, nk, payload);
}

function rpcSubmitCombatActionWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcSubmitCombatAction } = require('./modules/combat_system');
  return rpcSubmitCombatAction(ctx, logger, nk, payload);
}

function rpcGetMatchStateWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGetMatchState } = require('./modules/combat_system');
  return rpcGetMatchState(ctx, logger, nk, payload);
}

function rpcCreateMatchWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcCreateMatch } = require('./modules/matchmaker');
  return rpcCreateMatch(ctx, logger, nk, payload);
}

function rpcAcceptMatchWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcAcceptMatch } = require('./modules/matchmaker');
  return rpcAcceptMatch(ctx, logger, nk, payload);
}

function rpcGetLeaderboardWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGetLeaderboard } = require('./modules/season_system');
  return rpcGetLeaderboard(ctx, logger, nk, payload);
}

async function rpcValidatePurchaseWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  const { rpcValidatePurchase } = require('./modules/store');
  return await rpcValidatePurchase(ctx, logger, nk, payload);
}

function rpcSpendGemsWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcSpendGems } = require('./modules/store');
  return rpcSpendGems(ctx, logger, nk, payload);
}

async function rpcRevenueCatWebhookWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  const { rpcRevenueCatWebhook } = require('./modules/store');
  return await rpcRevenueCatWebhook(ctx, logger, nk, payload);
}

function rpcGenerateGearWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGenerateGear } = require('./modules/gear_system');
  return rpcGenerateGear(ctx, logger, nk, payload);
}

function rpcEquipGearWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcEquipGear } = require('./modules/gear_system');
  return rpcEquipGear(ctx, logger, nk, payload);
}

function rpcStageCompleteWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcStageComplete } = require('./modules/gear_system');
  return rpcStageComplete(ctx, logger, nk, payload);
}

function rpcCompleteStageWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcCompleteStage } = require('./modules/stage_tracking');
  return rpcCompleteStage(ctx, logger, nk, payload);
}

function rpcGetCampaignProgressWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGetCampaignProgress } = require('./modules/stage_tracking');
  return rpcGetCampaignProgress(ctx, logger, nk, payload);
}

function rpcReportPlayerWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcReportPlayer } = require('./modules/player_rpc');
  return rpcReportPlayer(ctx, logger, nk, payload);
}

function rpcGetPlayerReportsWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGetPlayerReports } = require('./modules/player_rpc');
  return rpcGetPlayerReports(ctx, logger, nk, payload);
}

function rpcTrackEventWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcTrackEvent } = require('./modules/analytics');
  return rpcTrackEvent(ctx, logger, nk, payload);
}

function rpcGetAnalyticsSummaryWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGetAnalyticsSummary } = require('./modules/analytics');
  return rpcGetAnalyticsSummary(ctx, logger, nk, payload);
}

function rpcTrackRevenueWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcTrackRevenue } = require('./modules/analytics');
  return rpcTrackRevenue(ctx, logger, nk, payload);
}

function rpcSyncDifficultyWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcSyncDifficulty } = require('./modules/dynamic_difficulty');
  return rpcSyncDifficulty(ctx, logger, nk, payload);
}

function rpcTrackMatchOutcomeWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcTrackMatchOutcome } = require('./modules/dynamic_difficulty');
  return rpcTrackMatchOutcome(ctx, logger, nk, payload);
}

function rpcGetPlayerPerformanceWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  const { rpcGetPlayerPerformance } = require('./modules/dynamic_difficulty');
  return rpcGetPlayerPerformance(ctx, logger, nk, payload);
}

// Register RPC to start notification scheduler (can be called externally)
function startNotificationSchedulerWrapper(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  try {
    startNotificationScheduler(nk, 60000); // Run every minute
    return JSON.stringify({ success: true });
  } catch (error) {
    logger.error('Failed to start notification scheduler', { error: String(error) });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

export default InitModule;
