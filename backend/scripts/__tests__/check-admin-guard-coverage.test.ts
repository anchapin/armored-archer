/**
 * Unit + live-coverage tests for scripts/check-admin-guard-coverage.ts (issue #1145).
 *
 * Two layers, mirroring scripts/__tests__/validate-tracked-ignored-files.test.ts:
 *
 *  1. Unit tests against synthetic module sources — every rule
 *     (UNWRAPPED_PRIVILEGED_RPC, GUARD_RPC_ID_MISMATCH,
 *     GUARDED_NON_PRIVILEGED_RPC) fires on the exact incomplete-walk shapes
 *     it exists to catch, and stays silent for the legitimate shapes found
 *     in the real tree (player RPCs, the two player-callable rollout
 *     exceptions, multi-line wrapped registrations).
 *
 *  2. A live-tree regression test that runs the scanner over the real
 *     backend/src/modules directory and asserts zero violations. This is
 *     the coverage gate the issue asks for: it runs under `npm test`
 *     (jest roots include scripts/) and therefore under the required
 *     backend CI job, so a future module registering an unwrapped
 *     `admin_*`/`rollout_*`/`deployment_*`/`error_insights_*`/metrics/QA
 *     replay RPC fails the build instead of merging green.
 *
 * The live-tree test also pins the privileged-registration count so an
 * accidental classifier regression (e.g. dropping a prefix) is caught by
 * the expected count dropping, not just by silence.
 */

import * as path from 'path';
import {
  extractRegisterRpcCalls,
  isPrivilegedRpcId,
  scanModuleDirectory,
  scanSource,
} from '../check-admin-guard-coverage';

const MODULES_DIR = path.resolve(__dirname, '..', '..', 'src', 'modules');

const WRAPPED_SEASON_ADMIN = `import { withAdminGuard } from './admin_auth';
export function registerRpcAdminProbe(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    'armored_archer/admin_probe',
    withAdminGuard('armored_archer/admin_probe', rpcAdminProbe)
  );
}
`;

const UNWRAPPED_SEASON_ADMIN = `export function registerRpcAdminProbe(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/admin_probe', rpcAdminProbe);
}
`;

describe('isPrivilegedRpcId (ADR-0006 privileged id set)', () => {
  it('classifies the prefixed admin families as privileged', () => {
    expect(isPrivilegedRpcId('armored_archer/admin_get_season_state')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/admin_query_matches')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/rollout_create_flag')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/rollout_rollback')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/deployment_record')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/error_insights_dashboard')).toBe(true);
  });

  it('classifies the prefix-less privileged exact ids', () => {
    expect(isPrivilegedRpcId('armored_archer/metrics')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/n_plus_one_report')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/get_match_replay')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/list_match_replays')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/flag_match_for_qa')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/add_debug_notes')).toBe(true);
    expect(isPrivilegedRpcId('armored_archer/reconstruct_match_state')).toBe(true);
  });

  it('keeps the player-callable and scrape endpoints ungated', () => {
    expect(isPrivilegedRpcId('armored_archer/rollout_check')).toBe(false);
    expect(isPrivilegedRpcId('armored_archer/rollout_record_metrics')).toBe(false);
    expect(isPrivilegedRpcId('armored_archer/prometheus_metrics')).toBe(false);
    expect(isPrivilegedRpcId('armored_archer/get_queue_status')).toBe(false);
    expect(isPrivilegedRpcId('armored_archer/end_season')).toBe(false);
  });
});

describe('extractRegisterRpcCalls', () => {
  it('parses single-line and multi-line registrations and the registerRpcWithMetrics helper', () => {
    const source = [
      `initializer.registerRpc('armored_archer/join_pool', rpcJoin);`, // line 1
      `initializer.registerRpc(`, // line 2
      `  'armored_archer/admin_probe',`, // line 3
      `  withAdminGuard('armored_archer/admin_probe', rpcProbe)`, // line 4
      `);`, // line 5
      `registerRpcWithMetrics(initializer, 'armored_archer/track_event', 'track_event', rpcTrack);`, // line 6
    ].join('\n');
    const calls = extractRegisterRpcCalls(source);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({ rpcId: 'armored_archer/join_pool', line: 1, guarded: false });
    expect(calls[1]).toMatchObject({
      rpcId: 'armored_archer/admin_probe',
      line: 2,
      guarded: true,
      guardRpcId: 'armored_archer/admin_probe',
    });
    expect(calls[2]).toMatchObject({
      rpcId: 'armored_archer/track_event',
      kind: 'registerRpcWithMetrics',
      guarded: false,
    });
  });

  it('does not confuse .registerRpc with .registerRpcWithMetrics', () => {
    const source =
      `initializer.registerRpcWithMetrics(initializer, 'armored_archer/metrics2', 'm', h);` +
      `initializer.registerRpc('armored_archer/metrics', withAdminGuard('armored_archer/metrics', h));`;
    const calls = extractRegisterRpcCalls(source);
    expect(calls.map((c) => c.rpcId).sort()).toEqual(['armored_archer/metrics', 'armored_archer/metrics2']);
    expect(calls.find((c) => c.rpcId === 'armored_archer/metrics')?.guarded).toBe(true);
  });
});

describe('scanSource rules', () => {
  it('flags an unwrapped privileged RPC (the issue #1145 scenario: incomplete 3-file walk, step 1 missing)', () => {
    const violations = scanSource('season_admin.ts', UNWRAPPED_SEASON_ADMIN);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('UNWRAPPED_PRIVILEGED_RPC');
    expect(violations[0].rpcId).toBe('armored_archer/admin_probe');
    expect(violations[0].line).toBe(2);
    expect(violations[0].message).toContain('withAdminGuard');
  });

  it('accepts a correctly wrapped privileged RPC', () => {
    expect(scanSource('season_admin.ts', WRAPPED_SEASON_ADMIN)).toEqual([]);
  });

  it('flags a guard label that does not match the registration id (mislabeled audit trail)', () => {
    const mislabeled = WRAPPED_SEASON_ADMIN.replace(
      "withAdminGuard('armored_archer/admin_probe'",
      "withAdminGuard('armored_archer/admin_other'"
    );
    const violations = scanSource('season_admin.ts', mislabeled);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('GUARD_RPC_ID_MISMATCH');
  });

  it('flags a wrapped RPC that is not in the privileged set (players could never call it)', () => {
    const wronglyGuarded = `initializer.registerRpc(
  'armored_archer/get_inventory',
  withAdminGuard('armored_archer/get_inventory', rpcGetInventory)
);`;
    const violations = scanSource('gear_system.ts', wronglyGuarded);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('GUARDED_NON_PRIVILEGED_RPC');
  });

  it('stays silent for player RPCs, the rollout exceptions, and http-key scrape endpoints', () => {
    const legit = [
      `initializer.registerRpc('armored_archer/get_queue_status', rpcGetQueueStatus);`,
      `initializer.registerRpc('armored_archer/rollout_check', rpcCheckFeatureFlag);`,
      `initializer.registerRpc('armored_archer/rollout_record_metrics', rpcRecordMetrics);`,
      `initializer.registerRpc('armored_archer/prometheus_metrics', rpcScrapeAppMetrics);`,
    ].join('\n');
    expect(scanSource('matchmaking_pool.ts', legit)).toEqual([]);
  });

  it('detects an unwrapped privileged id registered through registerRpcWithMetrics', () => {
    const source = `registerRpcWithMetrics(initializer, 'armored_archer/admin_probe', 'admin_probe', rpcProbe);`;
    const violations = scanSource('metrics.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('UNWRAPPED_PRIVILEGED_RPC');
  });
});

describe('live tree coverage (the regression gate)', () => {
  it('every privileged RPC registration in backend/src/modules is correctly admin-guarded', () => {
    const result = scanModuleDirectory(MODULES_DIR);
    // Deep-print violations on failure for an actionable CI message.
    expect(result.violations).toEqual([]);
  });

  it('still finds the known privileged registrations (classifier regression pin)', () => {
    const result = scanModuleDirectory(MODULES_DIR);
    // 29 privileged registrations at the time issue #1145 was implemented:
    // season_admin (4), matchmaker admin_query_matches (1), metrics (2),
    // deployment_observability (4), progressive_rollout flag mutators (8),
    // error_insight_pipeline (5), match_replay QA endpoints (5).
    // rollout_check / rollout_record_metrics / prometheus_* are deliberately
    // excluded (player-callable / http-key scrapes). If this drops without
    // the tree changing, the classifier lost a prefix or exact id.
    expect(result.privilegedCalls).toBeGreaterThanOrEqual(29);
    expect(result.scannedCalls).toBeGreaterThan(100);
  });
});
