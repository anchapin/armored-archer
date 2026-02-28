import { Runtime } from "../types/nakama";
import { safeParse, safeParsePayload, createErrorResponse } from "../utils/safeParse";

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

export interface PlayerCurrency {
  user_id: string;
  gems: number;
  gold: number;
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

function rpcValidatePurchase(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Validating purchase for user: %s", ctx.userId);

  const request = safeParsePayload<PurchaseRequest>(payload, logger, "validate_purchase");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }

  if (!request.product_id || !request.platform || !request.transaction_receipt) {
    return JSON.stringify({
      error: "Missing required fields"
    });
  }

  if (!GEM_BUNDLES[request.product_id]) {
    return JSON.stringify({
      error: "Invalid product ID"
    });
  }

  const gemBundle = GEM_BUNDLES[request.product_id];

  const objects = nk.storageRead([
    {
      collection: "player_currency",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);

  let playerCurrency: PlayerCurrency;

  if (objects.length === 0) {
    playerCurrency = {
      user_id: ctx.userId,
      gems: 0,
      gold: 0
    };
  } else {
    const parseResult = safeParse<PlayerCurrency>(objects[0].value ?? "{}", null, logger, "player_currency");
    if (!parseResult.success || !parseResult.data) {
      logger.error("Failed to parse player currency for user: %s", ctx.userId);
      playerCurrency = {
        user_id: ctx.userId,
        gems: 0,
        gold: 0
      };
    } else {
      playerCurrency = parseResult.data;
    }
  }

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

  const objects = nk.storageRead([
    {
      collection: "player_currency",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);

  if (objects.length === 0) {
    const newCurrency: PlayerCurrency = {
      user_id: ctx.userId,
      gems: 0,
      gold: 0
    };

    nk.storageWrite([
      {
        collection: "player_currency",
        key: ctx.userId,
        userId: ctx.userId,
        value: JSON.stringify(newCurrency)
      }
    ]);

    return JSON.stringify(newCurrency);
  }

  return objects[0].value ?? "{}";
}

function rpcSpendGems(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Spending gems for user: %s", ctx.userId);

  const request = safeParsePayload<{ amount: number }>(payload, logger, "spend_gems");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }

  if (typeof request.amount !== "number" || request.amount <= 0) {
    return JSON.stringify({
      error: "Invalid amount"
    });
  }

  const objects = nk.storageRead([
    {
      collection: "player_currency",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);

  if (objects.length === 0) {
    return JSON.stringify({
      error: "Player currency not found"
    });
  }

  const parseResult = safeParse<PlayerCurrency>(objects[0].value ?? "{}", null, logger, "player_currency");
  if (!parseResult.success || !parseResult.data) {
    logger.error("Failed to parse player currency for user: %s", ctx.userId);
    return createErrorResponse("INVALID_DATA", "Failed to parse player currency");
  }
  const playerCurrency: PlayerCurrency = parseResult.data;

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

  logger.info("User %s spent %d gems. New balance: %d", ctx.userId, request.amount, playerCurrency.gems);

  return JSON.stringify({
    success: true,
    new_balance: playerCurrency.gems,
    amount_spent: request.amount
  });
}
