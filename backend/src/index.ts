import { InitModule, Runtime } from "./types/nakama";
import "./config";
import { validateConfiguration } from "./modules/config_validation";
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

const InitModule: InitModule = function(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, initializer: Runtime.Initializer) {
  validateConfiguration(logger);

  logger.info("Armored Archer server module initialized");

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
};

export default InitModule;
