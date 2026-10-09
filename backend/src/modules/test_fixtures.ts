import { Runtime } from '../types/nakama';
import { listLeaderboardRecords } from '../utils/leaderboard-list';

/**
 * Test-only fixture RPC for integration tests (#1456).
 *
 * Season leaderboards are created authoritative, so a nakama-js client
 * cannot write or delete their records. The season integration suite
 * needs to seed scores for specific players, so this RPC exposes the
 * server-side leaderboard calls behind an explicit opt-in flag.
 *
 * Registered ONLY when `TEST_FIXTURE_RPCS_ENABLED=true` is present in the
 * bundle env (CI's integration job writes it into backend/.env). It must
 * never be set for a real deployment: any authenticated user could write
 * arbitrary leaderboard scores.
 *
 * Payload: { op: 'write' | 'delete' | 'list', leaderboard_id, ... }
 */
export const TEST_FIXTURE_RPC_ID = 'armored_archer/test_leaderboard_fixture';

export function testFixtureRpcsEnabled(env: { [key: string]: string | undefined }): boolean {
  return env.TEST_FIXTURE_RPCS_ENABLED === 'true';
}

interface FixturePayload {
  op?: string;
  leaderboard_id?: string;
  owner_id?: string;
  owner_ids?: string[];
  username?: string;
  score?: number;
  subscore?: number;
  metadata?: { [key: string]: string };
  limit?: number;
}

function fail(error: string): string {
  return JSON.stringify({ success: false, error });
}

function opWrite(nk: Runtime.Nakama, leaderboardId: string, body: FixturePayload): string {
  if (!body.owner_id) {
    return fail('owner_id is required');
  }
  // Same shape as season_system.ts; creating an existing board is a no-op.
  nk.leaderboardCreate(leaderboardId, true, 'desc', 'best', '', {});
  nk.leaderboardRecordWrite(
    leaderboardId,
    body.owner_id,
    body.username || '',
    Number(body.score) || 0,
    Number(body.subscore) || 0,
    body.metadata || {}
  );
  return JSON.stringify({ success: true });
}

function opDelete(nk: Runtime.Nakama, leaderboardId: string, body: FixturePayload): string {
  for (const ownerId of body.owner_ids || []) {
    try {
      nk.leaderboardRecordDelete(leaderboardId, ownerId);
    } catch {
      // Missing board or record: nothing to clean up.
    }
  }
  return JSON.stringify({ success: true });
}

function opList(nk: Runtime.Nakama, leaderboardId: string, body: FixturePayload): string {
  const { records } = listLeaderboardRecords(
    nk,
    leaderboardId,
    body.owner_ids || [],
    body.limit || 100
  );
  return JSON.stringify({ success: true, records: records || [] });
}

const OPS: Record<
  string,
  (nk: Runtime.Nakama, leaderboardId: string, body: FixturePayload) => string
> = {
  write: opWrite,
  delete: opDelete,
  list: opList,
};

export function rpcTestLeaderboardFixture(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  if (!ctx.userId) {
    return fail('Authentication required');
  }

  let body: FixturePayload;
  try {
    body = JSON.parse(payload || '{}');
  } catch {
    return fail('Invalid JSON payload');
  }

  if (!body.leaderboard_id) {
    return fail('leaderboard_id is required');
  }
  const handler = OPS[String(body.op)];
  if (!handler) {
    return fail(`Unknown op: ${String(body.op)}`);
  }

  try {
    return handler(nk, body.leaderboard_id, body);
  } catch (err) {
    logger.warn(`test_leaderboard_fixture ${String(body.op)} failed: ${(err as Error).message}`);
    return fail((err as Error).message);
  }
}

export function registerTestFixtureRpcs(
  initializer: Runtime.Initializer,
  logger: Runtime.Logger,
  env: { [key: string]: string | undefined }
): boolean {
  if (!testFixtureRpcsEnabled(env)) {
    return false;
  }
  logger.warn(
    'TEST_FIXTURE_RPCS_ENABLED=true: registering test-only leaderboard fixture RPC. ' +
      'This must never be enabled outside CI.'
  );
  // Literal id (not TEST_FIXTURE_RPC_ID): scripts/transpile-bundle.js finds
  // RPC ids by scanning for registerRpc('<id>'; a constant here is invisible
  // to it, so the RPC was never bridged and every call 404'd.
  initializer.registerRpc('armored_archer/test_leaderboard_fixture', rpcTestLeaderboardFixture);
  return true;
}
