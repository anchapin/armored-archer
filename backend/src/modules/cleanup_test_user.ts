// Test-only cleanup: synchronous host calls per ADR-0008. Never deploy with
// TEST_FIXTURE_RPCS_ENABLED=true. Both registration and execution fail closed.
import { Runtime } from '../types/nakama';
import { observedSqlQuery } from '../utils/sql-observability';
import { isAdminUser } from './admin_auth';
import { testFixtureRpcsEnabled } from './test_fixtures';

const RPC_ID = 'armored_archer/cleanup_test_user';

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

// Only real SQL tables (see backend/data/*.sql). player_activity,
// season_rewards_claimed, respec_data, campaign_progress and audit_logs are
// Nakama storage collections, not tables; deleting them via SQL just logged
// "relation does not exist" errors. Their rows live in `storage`.
const CLEANUP_TABLES = [
  'storage',
  'unlocked_modifier_pools',
  'boss_defeats',
  'inventory',
  'inventory_items',
  'loadout',
  'player_stats',
  'stage_completion',
];

interface CleanupPayload {
  user_id?: string;
  userId?: string;
}

function failure(error: string): string {
  return JSON.stringify({ success: false, error });
}

export function cleanupTestUserEnabled(): boolean {
  return testFixtureRpcsEnabled(process.env);
}

export function rpcCleanupTestUser(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  if (!cleanupTestUserEnabled()) return failure('cleanup_disabled');
  if (!ctx.userId) return failure('not_authorized');

  let userId: string | undefined;
  try {
    const parsed = JSON.parse(payload || '{}') as CleanupPayload;
    userId = parsed.user_id ?? parsed.userId;
  } catch {
    return failure('invalid_payload');
  }
  if (!userId || typeof userId !== 'string') return failure('missing_user_id');

  // A public server key is never an admin identity. Cross-user cleanup uses
  // the existing parse-once allowlist; an empty or broken allowlist fails closed.
  try {
    if (userId !== ctx.userId && !isAdminUser(ctx.userId)) {
      return failure('not_authorized');
    }
  } catch {
    logger.error('Test cleanup authorization failed');
    return failure('not_authorized');
  }

  const completed = runCleanup(nk, logger, userId);
  if (!completed) return failure('cleanup_failed');
  return JSON.stringify({ success: true, user_id: userId, async: false });
}

export function registerRpcCleanupTestUser(initializer: Runtime.Initializer): void {
  if (!cleanupTestUserEnabled()) return;
  initializer.registerRpc('armored_archer/cleanup_test_user', rpcCleanupTestUser);
}

function runCleanup(nk: Runtime.Nakama, logger: Runtime.Logger, userId: string): boolean {
  let completed = true;
  for (const collection of CLEANUP_COLLECTIONS) {
    try {
      nk.storageDelete([{ collection, key: userId, userId }]);
    } catch {
      completed = false;
      logger.error('Test cleanup storage delete failed: collection=%s', collection);
    }
  }

  for (const table of CLEANUP_TABLES) {
    try {
      observedSqlQuery(
        nk,
        'cleanup_test_user.delete.' + table,
        `DELETE FROM ${table} WHERE user_id = $1`,
        [userId],
        { rpc: RPC_ID, logger }
      );
    } catch {
      completed = false;
    }
  }
  return completed;
}
