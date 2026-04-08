/**
 * Nakama JavaScript modules index.
 * This file exports all RPC registration functions for Nakama.
 */

const player_rpc = require('./player_rpc');
const analytics = require('./analytics');
const rpg_system = require('./rpg_system');
const matchmaker = require('./matchmaker');
const combat_system = require('./combat_system');
const season_system = require('./season_system');
const store = require('./store');
const gear_system = require('./gear_system');
const metrics = require('./metrics');
const stage_tracking = require('./stage_tracking');
const notifications_rpc = require('./notifications_rpc');
const notification_scheduler = require('./notification_scheduler');
const error_insight_pipeline = require('./error_insight_pipeline');
const deployment_observability = require('./deployment_observability');
const progressive_rollout = require('./progressive_rollout');
const alerting = require('./alerting');
const health_monitor = require('./health_monitor');

// Export all - explicitly merge to ensure all functions are included
module.exports = {
  // Player RPCs
  registerRpcHealthCheck: player_rpc.registerRpcHealthCheck,
  registerRpcReportPlayer: player_rpc.registerRpcReportPlayer,
  registerRpcGetPlayerStats: player_rpc.registerRpcGetPlayerStats,
  registerRpcGetPlayerReports: player_rpc.registerRpcGetPlayerReports,
  // Analytics
  registerRpcMetrics: analytics.registerRpcMetrics,
  registerAnalyticsEndpoints: analytics.registerAnalyticsEndpoints,
  // RPG System
  registerRpcGainXP: rpg_system.registerRpcGainXP,
  registerRpcAllocateStats: rpg_system.registerRpcAllocateStats,
  // Matchmaker
  registerRpcListMatches: matchmaker.registerRpcListMatches,
  registerRpcCreateMatch: matchmaker.registerRpcCreateMatch,
  registerRpcAcceptMatch: matchmaker.registerRpcAcceptMatch,
  registerRpcGetPlayerRank: matchmaker.registerRpcGetPlayerRank,
  registerRpcCompleteMatch: matchmaker.registerRpcCompleteMatch,
  registerRpcSubmitCombatAction: matchmaker.registerRpcSubmitCombatAction,
  registerRpcGetMatchState: matchmaker.registerRpcGetMatchState,
  registerRpcPlayerDisconnect: matchmaker.registerRpcPlayerDisconnect,
  // Combat System
  registerReportPlayer: combat_system.registerReportPlayer,
  // Season System
  registerRpcGetSeasonInfo: season_system.registerRpcGetSeasonInfo,
  registerRpcGetLeaderboard: season_system.registerRpcGetLeaderboard,
  registerRpcUpdateRank: season_system.registerRpcUpdateRank,
  registerRpcGetSeasonRewards: season_system.registerRpcGetSeasonRewards,
  registerRpcClaimSeasonRewards: season_system.registerRpcClaimSeasonRewards,
  registerRpcEndSeason: season_system.registerRpcEndSeason,
  // Store / IAP
  registerRpcValidatePurchase: store.registerRpcValidatePurchase,
  registerRpcGetCurrency: store.registerRpcGetCurrency,
  registerRpcSpendGems: store.registerRpcSpendGems,
  registerRpcProcessPendingPurchases: store.registerRpcProcessPendingPurchases,
  registerRpcCheckRefunds: store.registerRpcCheckRefunds,
  registerRpcCheckSubscriptions: store.registerRpcCheckSubscriptions,
  registerRpcAppLaunchCheck: store.registerRpcAppLaunchCheck,
  registerRpcRevenueCatWebhook: store.registerRpcRevenueCatWebhook,
  // Gear System
  registerRpcGenerateGear: gear_system.registerRpcGenerateGear,
  registerRpcEquipGear: gear_system.registerRpcEquipGear,
  registerRpcUnequipGear: gear_system.registerRpcUnequipGear,
  registerRpcGetInventory: gear_system.registerRpcGetInventory,
  registerRpcUnlockModifierPool: gear_system.registerRpcUnlockModifierPool,
  registerRpcStageComplete: gear_system.registerRpcStageComplete,
  registerRpcGetUnlockedModifiers: gear_system.registerRpcGetUnlockedModifiers,
  // Stage Tracking - CAMPAIGN PERSISTENCE
  registerRpcCompleteStage: stage_tracking.registerRpcCompleteStage,
  registerRpcGetCompletedStages: stage_tracking.registerRpcGetCompletedStages,
  registerRpcGetCampaignProgress: stage_tracking.registerRpcGetCampaignProgress,
  // Notifications
  registerRpcMetrics: notifications_rpc.registerRpcMetrics,
  registerNotificationEndpoints: notifications_rpc.registerNotificationEndpoints,
  // Notifications Scheduler
  registerRpcMetrics2: notification_scheduler.registerRpcMetrics,
  // Error Insights
  registerRpcMetrics3: error_insight_pipeline.registerRpcMetrics,
  registerErrorInsightRpcs: error_insight_pipeline.registerErrorInsightRpcs,
  // Deployment Observability
  registerRpcMetrics4: deployment_observability.registerRpcMetrics,
  initializeDeploymentObservability: deployment_observability.initializeDeploymentObservability,
  // Progressive Rollout
  registerRpcMetrics5: progressive_rollout.registerRpcMetrics,
  initializeProgressiveRollout: progressive_rollout.initializeProgressiveRollout,
  // Alerting
  registerRpcMetrics6: alerting.registerRpcMetrics,
  initializeAlerting: alerting.initializeAlerting,
  // Health Monitoring
  registerRpcMetrics7: health_monitor.registerRpcMetrics,
  initializeHealthMonitoring: health_monitor.initializeHealthMonitoring,
};
