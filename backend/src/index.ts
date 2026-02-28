import { InitModule, Runtime } from "@heroiclabs/nakama-js/runtime";
import { registerRpcHealthCheck, registerRpcGetPlayerStats } from "./modules/player_rpc";

const InitModule: InitModule = function(ctx: Runtime, logger: Runtime.Logger, nk: Runtime.Nakama, initializer: Runtime.Initializer) {
  logger.info("Armored Archer server module initialized");

  registerRpcHealthCheck(initializer);
  registerRpcGetPlayerStats(initializer);
};

export default InitModule;
