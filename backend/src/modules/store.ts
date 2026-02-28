import { Runtime } from "../types/nakama";
import { safeParse, safeParsePayload, createErrorResponse } from "../utils/safeParse";
import { getCacheManager } from "../utils/cache";

export interface PlayerCurrency {
  user_id: string;
  gems: number;
  gold: number;
}

function getPlayerCurrencyWithCache(nk: Runtime.Nakama, userId: string, logger: Runtime.Logger): PlayerCurrency {
  const cacheManager = getCacheManager(logger);
  const cachedCurrency = cacheManager.get<PlayerCurrency>("player_currency", userId);

  if (cachedCurrency !== undefined) {
    return cachedCurrency;
  }

  const objects = nk.storageRead([
    {
      collection: "player_currency",
      key: userId,
      userId: userId
    }
  ]);

  let currency: PlayerCurrency;
  if (objects.length === 0 || !objects[0].value) {
    currency = {
      user_id: userId,
      gems: 0,
      gold: 0
    };
  } else {
    const parseResult = safeParse<PlayerCurrency>(objects[0].value, null, logger, "player_currency");
    currency = parseResult.success && parseResult.data ? parseResult.data : {
      user_id: userId,
      gems: 0,
      gold: 0
    };
  }

  cacheManager.set("player_currency", userId, currency);
  return currency;
}

function invalidateCurrencyCache(userId: string, logger: Runtime.Logger): void {
  const cacheManager = getCacheManager(logger);
  cacheManager.delete("player_currency", userId);
}

export interface GemBundle {
  product_id: string;
  gem_amount: number;
  price_usd: number;
}

export interface PurchaseRequest {
  product_id: string;
  platform: string; // "ios" or "android"
  transaction_receipt: string; // Base64 encoded receipt from RevenueCat
}

export const GEM_BUNDLES: Record<string, GemBundle> = {
  "com.armoredarcher.gems.small": {
    product_id: "com.armoredarcher.gems.small",
    gem_amount: 100,
    price_usd: 0.99
  },
  "com.armoredarcher.gems.medium": {
    product_id: "com.armoredarcher.gems.medium",
    gem_amount: 550,
    price_usd: 4.99
  },
  "com.armoredarcher.gems.large": {
    product_id: "com.armoredarcher.gems.large",
    gem_amount: 1200,
    price_usd: 9.99
  }
};

export function registerRpcValidatePurchase(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/validate_purchase", rpcValidatePurchase);
}

export function registerRpcGetCurrency(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/get_currency", rpcGetCurrency);
}

export function registerRpcSpendGems(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/spend_gems", rpcSpendGems);
}

function getStoreCatalog(logger: Runtime.Logger): Record<string, GemBundle> {
  const cacheManager = getCacheManager(logger);
  const cachedCatalog = cacheManager.get<Record<string, GemBundle>>("store_catalog", "gem_bundles");

  if (cachedCatalog !== undefined) {
    return cachedCatalog;
  }

  cacheManager.set("store_catalog", "gem_bundles", GEM_BUNDLES);
  return GEM_BUNDLES;
}

function rpcValidatePurchase(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Validating purchase for user: %s", ctx.userId);

  const request = safeParsePayload<PurchaseRequest>(payload, logger, "<rpc_name>");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }

  if (!request.product_id || !request.platform || !request.transaction_receipt) {
    return JSON.stringify({
      error: "Missing required fields"
    });
  }

  const catalog = getStoreCatalog(logger);

  if (!catalog[request.product_id]) {
    return JSON.stringify({
      error: "Invalid product ID"
    });
  }

  const gemBundle = catalog[request.product_id];
  const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
  playerCurrency.gems += gemBundle.gem_amount;

  nk.storageWrite([
    {
      collection: "player_currency",
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(playerCurrency)
    }
  ]);

  nk.walletUpdate(ctx.userId, {
    gems: gemBundle.gem_amount
  });

  invalidateCurrencyCache(ctx.userId, logger);

  logger.info("Purchase validated. User %s received %d gems", ctx.userId, gemBundle.gem_amount);

  return JSON.stringify({
    success: true,
    gems_awarded: gemBundle.gem_amount,
    new_balance: playerCurrency.gems,
    product_id: request.product_id
  });
}

function rpcGetCurrency(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Getting currency for user: %s", ctx.userId);

  const currency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);

  return JSON.stringify(currency);
}

function rpcSpendGems(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Spending gems for user: %s", ctx.userId);

  const parseResult = safeParse<{ amount: number }>(payload, null, logger, "spend_gems");
  if (!parseResult.success || !parseResult.data) {
    logger.error("Failed to parse data");
    return createErrorResponse("INVALID_DATA", "Failed to parse data");
  }
  const request = parseResult.data;

  if (typeof request.amount !== "number" || request.amount <= 0) {
    return JSON.stringify({
      error: "Invalid amount"
    });
  }

  const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);

  if (playerCurrency.gems < request.amount) {
    return JSON.stringify({
      error: "Insufficient gems"
    });
  }

  playerCurrency.gems -= request.amount;

  nk.storageWrite([
    {
      collection: "player_currency",
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(playerCurrency)
    }
  ]);

  invalidateCurrencyCache(ctx.userId, logger);

  logger.info("User %s spent %d gems. New balance: %d", ctx.userId, request.amount, playerCurrency.gems);

  return JSON.stringify({
    success: true,
    new_balance: playerCurrency.gems,
    amount_spent: request.amount
  });
}
