// Test-only RPC: armored_archer/cleanup_test_user
// Clears a user's Nakama storage and game tables between integration tests.
// Mirrors backend/src/modules/test_cleanup.ts but is sync (Nakama JS runtime
// does not support async RPC handlers — see index.ts:770 / ADR-0008).
// Cleanup runs as fire-and-forget async work after the RPC returns the ack.

import { Runtime } from '../types/nakama';

const CLEANUP_COLLECTIONS = [
  'player_inventory',
  'unlocked_modifier_pools',
  'player_stats',
  'player_currency',
  'player_activity',
  'season_rewards_claimed',
  'respec_data',
  'campaign_progress',
  'loadout',
  'inventory',
  'catalog',
];

const CLEANUP_TABLES = [
  'storage',
  'unlocked_modifier_pools',
  'boss_defeats',
  'inventory',
  'loadout',
  'player_stats',
  'campaign_progress',
  'season_rewards_claimed',
  'player_activity',
  'respec_data',
  'audit_logs',
];

interface CleanupPayload {
  user_id?: string;
  userId?: string;
}

export function rpcCleanupTestUser(
  _ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  let userId: string | undefined;
  try {
    const parsed = JSON.parse(payload || '{}') as CleanupPayload;
    userId = parsed.user_id ?? parsed.userId;
  } catch {
    return JSON.stringify({ success: false, error: 'invalid_payload' });
  }
  if (!userId || typeof userId !== 'string') {
    return JSON.stringify({ success: false, error: 'missing_user_id' });
  }

  // Fire-and-forget async cleanup. The handler returns the ack immediately so
  // the sync wrapper contract is honored. Real cleanup happens via
  // nk.storageDelete (async) and nk.sqlQuery (async) below.
  void runCleanup(nk, logger, userId);

  return JSON.stringify({ success: true, user_id: userId, async: true });
}

export function registerRpcCleanupTestUser(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/cleanup_test_user', rpcCleanupTestUser);
}

async function runCleanup(
  nk: Runtime.Nakama,
  logger: Runtime.Logger,
  userId: string
): Promise<void> {
  logger.info(`cleanup_test_user: starting for ${userId}`);

  for (const collection of CLEANUP_COLLECTIONS) {
    try {
      await nk.storageDelete([{ collection, key: userId, userId }]);
    } catch (err) {
      logger.debug(`cleanup_test_user: ${collection} storage delete: ${(err as Error).message}`);
    }
  }

  for (const table of CLEANUP_TABLES) {
    try {
      await nk.sqlQuery(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
    } catch (err) {
      logger.debug(`cleanup_test_user: ${table} delete: ${(err as Error).message}`);
    }
  }

  logger.info(`cleanup_test_user: finished for ${userId}`);
}
