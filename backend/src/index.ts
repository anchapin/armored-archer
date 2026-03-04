import { InitModule, Runtime } from "./types/nakama";
import "./config";
import { validateRequiredConfig, config } from "./config";
import { initializeCaches } from "./utils/cache";
import { registerRpcHealthCheck } from "./modules/player_rpc";
import { registerRpcGainXP, registerRpcAllocateStats, registerRpcGetPlayerStats } from "./modules/rpg_system";
import {
  registerRpcListMatches,
  registerRpcCreateMatch,
  registerRpcAcceptMatch,
  registerRpcGetPlayerRank
} from "./modules/matchmaker";
import {
  registerRpcSubmitCombatAction,
  registerRpcGetMatchState
} from "./modules/combat_system";
import {
  registerRpcGetSeasonInfo,
  registerRpcGetLeaderboard,
  registerRpcUpdateRank,
  registerRpcGetSeasonRewards,
  registerRpcClaimSeasonRewards,
  registerRpcEndSeason
} from "./modules/season_system";
import { registerRpcValidatePurchase, registerRpcGetCurrency, registerRpcSpendGems, registerRpcRegisterPendingPurchase, registerRpcProcessPendingPurchases, registerRpcCheckRefunds, registerRpcCheckSubscriptions, registerRpcAppLaunchCheck } from "./modules/store";
import {
  registerRpcGenerateGear,
  registerRpcEquipGear,
  registerRpcUnequipGear,
  registerRpcGetInventory,
  registerRpcUnlockModifierPool
} from "./modules/gear_system";
import { registerRpcMetrics, registerRpcWithRateLimit } from "./modules/metrics";
import { initializeSentry } from "./config/errorTracking";
import { logger, logSystemEvent } from "./config/logger";

const InitModule: InitModule = function(ctx: Runtime.Context, loggerParam: Runtime.Logger, nk: Runtime.Nakama, initializer: Runtime.Initializer) {
  initializeSentry();
  logSystemEvent('info', 'Server initialization started');

  validateRequiredConfig();
  initializeCaches(loggerParam);
  
  if (config.rateLimit.enabled) {
    logSystemEvent('info', 'Rate limiting enabled', {
      defaultMaxRequests: config.rateLimit.defaultMaxRequests,
      defaultWindowMs: config.rateLimit.defaultWindowMs,
      endpointsConfigured: Object.keys(config.rateLimit.endpoints).length
    });
  } else {
    logSystemEvent('info', 'Rate limiting disabled');
  }

  logSystemEvent('info', 'Registering RPC handlers');

  registerRpcMetrics(initializer);
  
  if (config.rateLimit.enabled) {
    registerRpcWithRateLimit(initializer, "armored_archer/health_check", "health_check", rpcHealthCheckWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/get_player_stats", "get_player_stats", rpcGetPlayerStatsWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/gain_xp", "gain_xp", rpcGainXPWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/allocate_stats", "allocate_stats", rpcAllocateStatsWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/submit_combat_action", "submit_combat_action", rpcSubmitCombatActionWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/get_match_state", "get_match_state", rpcGetMatchStateWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/create_match", "create_match", rpcCreateMatchWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/accept_match", "accept_match", rpcAcceptMatchWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/get_leaderboard", "get_leaderboard", rpcGetLeaderboardWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/validate_purchase", "validate_purchase", rpcValidatePurchaseWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/spend_gems", "spend_gems", rpcSpendGemsWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/register_pending_purchase", "register_pending_purchase", rpcRegisterPendingPurchaseWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/process_pending_purchases", "process_pending_purchases", rpcProcessPendingPurchasesWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/check_refunds", "check_refunds", rpcCheckRefundsWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/check_subscriptions", "check_subscriptions", rpcCheckSubscriptionsWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/app_launch_check", "app_launch_check", rpcAppLaunchCheckWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/generate_gear", "generate_gear", rpcGenerateGearWrapper);
    registerRpcWithRateLimit(initializer, "armored_archer/equip_gear", "equip_gear", rpcEquipGearWrapper);
  } else {
    registerRpcHealthCheck(initializer);
    registerRpcGainXP(initializer);
    registerRpcAllocateStats(initializer);
    registerRpcGetPlayerStats(initializer);
    registerRpcListMatches(initializer);
    registerRpcCreateMatch(initializer);
    registerRpcAcceptMatch(initializer);
    registerRpcGetPlayerRank(initializer);
    registerRpcSubmitCombatAction(initializer);
    registerRpcGetMatchState(initializer);
    registerRpcGetSeasonInfo(initializer);
    registerRpcGetLeaderboard(initializer);
    registerRpcUpdateRank(initializer);
    registerRpcGetSeasonRewards(initializer);
    registerRpcClaimSeasonRewards(initializer);
    registerRpcEndSeason(initializer);
    registerRpcValidatePurchase(initializer);
    registerRpcGetCurrency(initializer);
    registerRpcSpendGems(initializer);
    registerRpcRegisterPendingPurchase(initializer);
    registerRpcProcessPendingPurchases(initializer);
    registerRpcCheckRefunds(initializer);
    registerRpcCheckSubscriptions(initializer);
    registerRpcAppLaunchCheck(initializer);
    registerRpcGenerateGear(initializer);
    registerRpcEquipGear(initializer);
    registerRpcUnequipGear(initializer);
    registerRpcGetInventory(initializer);
    registerRpcUnlockModifierPool(initializer);
  }

  logSystemEvent('info', 'Armored Archer server module initialized');
};

function rpcHealthCheckWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcHealthCheck } = require("./modules/player_rpc");
  return rpcHealthCheck(ctx, logger, nk, payload);
}

function rpcGetPlayerStatsWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcGetPlayerStats } = require("./modules/player_rpc");
  return rpcGetPlayerStats(ctx, logger, nk, payload);
}

function rpcGainXPWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcGainXP } = require("./modules/rpg_system");
  return rpcGainXP(ctx, logger, nk, payload);
}

function rpcAllocateStatsWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcAllocateStats } = require("./modules/rpg_system");
  return rpcAllocateStats(ctx, logger, nk, payload);
}

function rpcSubmitCombatActionWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcSubmitCombatAction } = require("./modules/combat_system");
  return rpcSubmitCombatAction(ctx, logger, nk, payload);
}

function rpcGetMatchStateWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcGetMatchState } = require("./modules/combat_system");
  return rpcGetMatchState(ctx, logger, nk, payload);
}

function rpcCreateMatchWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcCreateMatch } = require("./modules/matchmaker");
  return rpcCreateMatch(ctx, logger, nk, payload);
}

function rpcAcceptMatchWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcAcceptMatch } = require("./modules/matchmaker");
  return rpcAcceptMatch(ctx, logger, nk, payload);
}

function rpcGetLeaderboardWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcGetLeaderboard } = require("./modules/season_system");
  return rpcGetLeaderboard(ctx, logger, nk, payload);
}

function rpcValidatePurchaseWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcValidatePurchase } = require("./modules/store");
  return rpcValidatePurchase(ctx, logger, nk, payload);
}

function rpcSpendGemsWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcSpendGems } = require("./modules/store");
  return rpcSpendGems(ctx, logger, nk, payload);
}

function rpcRegisterPendingPurchaseWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcRegisterPendingPurchase } = require("./modules/store");
  return rpcRegisterPendingPurchase(ctx, logger, nk, payload);
}

function rpcProcessPendingPurchasesWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcProcessPendingPurchases } = require("./modules/store");
  return rpcProcessPendingPurchases(ctx, logger, nk, payload);
}

function rpcCheckRefundsWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcCheckRefunds } = require("./modules/store");
  return rpcCheckRefunds(ctx, logger, nk, payload);
}

function rpcCheckSubscriptionsWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcCheckSubscriptions } = require("./modules/store");
  return rpcCheckSubscriptions(ctx, logger, nk, payload);
}

function rpcAppLaunchCheckWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcAppLaunchCheck } = require("./modules/store");
  return rpcAppLaunchCheck(ctx, logger, nk, payload);
}

function rpcGenerateGearWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcGenerateGear } = require("./modules/gear_system");
  return rpcGenerateGear(ctx, logger, nk, payload);
}

function rpcEquipGearWrapper(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  const { rpcEquipGear } = require("./modules/gear_system");
  return rpcEquipGear(ctx, logger, nk, payload);
}

export default InitModule;
