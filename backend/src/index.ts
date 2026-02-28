import { InitModule, Runtime } from "./types/nakama";
import "./config";
import { validateRequiredConfig } from "./config";
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
import { registerRpcValidatePurchase, registerRpcGetCurrency, registerRpcSpendGems } from "./modules/store";
import {
  registerRpcGenerateGear,
  registerRpcEquipGear,
  registerRpcUnequipGear,
  registerRpcGetInventory,
  registerRpcUnlockModifierPool
} from "./modules/gear_system";
import { registerRpcMetrics } from "./modules/metrics";
import { initializeSentry } from "./config/errorTracking";
import { logger, logSystemEvent } from "./config/logger";

const InitModule: InitModule = function(ctx: Runtime.Context, loggerParam: Runtime.Logger, nk: Runtime.Nakama, initializer: Runtime.Initializer) {
  initializeSentry();
  logSystemEvent('info', 'Server initialization started');

  validateRequiredConfig();
  initializeCaches(loggerParam);

  logSystemEvent('info', 'Registering RPC handlers');

  registerRpcMetrics(initializer);
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
  registerRpcGenerateGear(initializer);
  registerRpcEquipGear(initializer);
  registerRpcUnequipGear(initializer);
  registerRpcGetInventory(initializer);
  registerRpcUnlockModifierPool(initializer);

  logSystemEvent('info', 'Armored Archer server module initialized');
};

export default InitModule;
