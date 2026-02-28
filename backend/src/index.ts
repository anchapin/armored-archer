import { InitModule, Runtime } from "@heroiclabs/nakama-js/runtime";
import { registerRpcHealthCheck } from "./modules/player_rpc";
import { registerRpcGainXP, registerRpcAllocateStats, registerRpcGetPlayerStats } from "./modules/rpg_system";

const InitModule: InitModule = function(ctx: Runtime, logger: Runtime.Logger, nk: Runtime.Nakama, initializer: Runtime.Initializer) {
  logger.info("Armored Archer server module initialized");

  registerRpcHealthCheck(initializer);
  registerRpcGainXP(initializer);
  registerRpcAllocateStats(initializer);
  registerRpcGetPlayerStats(initializer);
};

export default InitModule;
