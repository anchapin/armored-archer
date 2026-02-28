import { InitModule, Runtime } from "./types/nakama";
import { registerRpcHealthCheck } from "./modules/player_rpc";
import { registerRpcGainXP, registerRpcAllocateStats, registerRpcGetPlayerStats } from "./modules/rpg_system";
import { 
  registerRpcListMatches, 
  registerRpcCreateMatch, 
  registerRpcAcceptMatch, 
  registerRpcGetPlayerRank 
} from "./modules/matchmaker";

const InitModule: InitModule = function(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, initializer: Runtime.Initializer) {
  logger.info("Armored Archer server module initialized");

  registerRpcHealthCheck(initializer);
  registerRpcGainXP(initializer);
  registerRpcAllocateStats(initializer);
  registerRpcGetPlayerStats(initializer);
  registerRpcListMatches(initializer);
  registerRpcCreateMatch(initializer);
  registerRpcAcceptMatch(initializer);
  registerRpcGetPlayerRank(initializer);
};

export default InitModule;
