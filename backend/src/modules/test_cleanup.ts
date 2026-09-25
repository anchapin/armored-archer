import { Runtime } from '../types/nakama';

const PLAYER_INVENTORY_COLLECTION = 'player_inventory';
const UNLOCKED_MODIFIER_POOLS_COLLECTION = 'unlocked_modifier_pools';

/**
 * Test-only RPC that cleans a user's Nakama storage AND PostgreSQL game tables.
 *
 * This is needed because the nakama-js client's deleteStorageObjects() hangs
 * indefinitely in Node.js (HTTP connection not properly closed). This RPC uses
 * the server's internal nk.storageDelete which doesn't have this issue.
 *
 * Cleans Nakama storage collections:
 * - player_inventory collection (user's gear, equipped_gear, unlocked_modifier_pools)
 * - unlocked_modifier_pools collection (modifier pool state)
 *
 * Cleans PostgreSQL tables (mirrors what cleanupDatabaseForUser does so tests
 * can use either approach):
 * - storage (Nakama internal storage table)
 * - unlocked_modifier_pools
 * - boss_defeats
 * - inventory
 * - loadout
 * - player_stats
 */
export async function rpcCleanupUserStorage(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  let userId: string;

  try {
    const parsed = JSON.parse(payload);
    userId = parsed.userId;
  } catch {
    return JSON.stringify({ success: false, error: 'Invalid payload: expected {userId: string}' });
  }

  if (!userId) {
    return JSON.stringify({ success: false, error: 'userId is required' });
  }

  logger.info(`Cleaning user data for: ${userId}`);

  // Clean Nakama storage collections (async, must await)
  try {
    await nk.storageDelete([
      {
        collection: PLAYER_INVENTORY_COLLECTION,
        key: userId,
        userId: userId,
      },
    ]);
  } catch (err) {
    logger.info(`player_inventory storage delete: ${(err as Error).message}`);
  }

  try {
    await nk.storageDelete([
      {
        collection: UNLOCKED_MODIFIER_POOLS_COLLECTION,
        key: userId,
        userId: userId,
      },
    ]);
  } catch (err) {
    logger.info(`unlocked_modifier_pools storage delete: ${(err as Error).message}`);
  }

  // Clean PostgreSQL game tables (mirrors cleanupDatabaseForUser in helpers.ts)
  const pgTables = [
    'storage',
    'unlocked_modifier_pools',
    'boss_defeats',
    'inventory',
    'loadout',
    'player_stats',
  ];

  for (const table of pgTables) {
    try {
      await nk.dbQuery(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
    } catch (err) {
      logger.info(`${table} delete: ${(err as Error).message}`);
    }
  }

  logger.info(`Successfully cleaned user data for: ${userId}`);

  return JSON.stringify({ success: true });
}

/**
 * Registers the test.cleanup_user_storage RPC.
 * This RPC is test-only and should only be registered in test environments.
 */
export function registerTestCleanupRpc(initializer: Runtime.Initializer): void {
  initializer.registerRpc('test.cleanup_user_storage', rpcCleanupUserStorage);
}
