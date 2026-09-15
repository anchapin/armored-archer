/**
 * withAdminGuard coverage checker (issue #1145).
 *
 * ADR-0006 requires every privileged RPC — the `admin_*` season tools, the
 * `rollout_*` flag mutators, `metrics`/`n_plus_one_report`, the
 * `deployment_*` family, the `error_insights_*` family, and the QA replay
 * endpoints — to be wrapped in `withAdminGuard` at its registration site
 * inside the owning module. Adding a privileged RPC is a 3-file walk
 * (module wrap + allowlist test fixture + RPC_MAP.md row), and nothing in
 * the test suite previously failed when the walk was done incompletely —
 * a new module registering an unwrapped `admin_foo` RPC would merge green.
 *
 * This script closes that gap by statically scanning
 * `backend/src/modules/*.ts` for `registerRpc`/`registerRpcWithMetrics`
 * calls and enforcing three rules:
 *
 *  1. UNWRAPPED_PRIVILEGED_RPC   — the RPC id is privileged (per the
 *     classifier below) but the handler expression passed to registerRpc
 *     is not wrapped in `withAdminGuard(...)`.
 *  2. GUARD_RPC_ID_MISMATCH      — the handler IS wrapped, but the rpcId
 *     passed to `withAdminGuard('...')` differs from the registration id.
 *     A mismatched label corrupts audit records, metric labels, and log
 *     lines for that RPC (the guard never checks the label against the
 *     route, so this would otherwise drift silently).
 *  3. GUARDED_NON_PRIVILEGED_RPC — the handler is wrapped but the RPC id
 *     is not in the privileged set. Either a player-facing RPC was
 *     accidentally gated (players can never satisfy an allowlist) or the
 *     id list below is stale — both must be fixed, which keeps this
 *     classifier the single declared source of truth for privilege.
 *
 * A fourth, NON-failing warning (MISSING_ALLOWLIST_TEST_FIXTURE) reports
 * privileged modules whose sibling `__tests__/<module>.test.ts` lacks the
 * `resetAdminAllowlistCache` allowlist fixture (step 2 of the 3-file
 * walk). It is informational because several pre-existing modules do not
 * use the fixture yet (season_admin, match_replay, matchmaker); new RPCs
 * scaffolded via `scripts/new-admin-rpc.sh` always get it.
 *
 * CLI usage:
 *   npm run check:admin-coverage                     # scan, exit 1 on violations
 *   ts-node scripts/check-admin-guard-coverage.ts --json-output
 *   ts-node scripts/check-admin-guard-coverage.ts --is-privileged armored_archer/admin_foo
 *                                                   # exit 0 iff privileged (used by
 *                                                   # scripts/new-admin-rpc.sh)
 *
 * The colocated test in scripts/__tests__/check-admin-guard-coverage.test.ts
 * runs this scanner over the live module tree under `npm test`, so the
 * backend CI job (a required status check) fails the moment an unwrapped
 * privileged RPC lands.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Privilege classifier — the single declared source of truth
// ---------------------------------------------------------------------------

/**
 * Exact privileged ids with no shared name prefix. The QA replay endpoints
 * and the two metrics dumps use ordinary names, so they must be listed
 * explicitly. Keep in sync with the enumeration in ADR-0006 and the
 * comment block on `ADMIN_USER_IDS` in backend/.env.example.
 */
const PRIVILEGED_EXACT_IDS: ReadonlySet<string> = new Set([
  'armored_archer/metrics',
  'armored_archer/n_plus_one_report',
  'armored_archer/get_match_replay',
  'armored_archer/list_match_replays',
  'armored_archer/flag_match_for_qa',
  'armored_archer/add_debug_notes',
  'armored_archer/reconstruct_match_state',
]);

/**
 * Privileged id prefixes. `admin_*` (season tools, admin_query_matches),
 * `rollout_*` flag mutators, `deployment_*` telemetry/mutation, and
 * `error_insights_*`.
 */
const PRIVILEGED_PREFIXES: readonly string[] = [
  'armored_archer/admin_',
  'armored_archer/rollout_',
  'armored_archer/deployment_',
  'armored_archer/error_insights_',
];

/**
 * Deliberately player-callable ids that would otherwise match a privileged
 * prefix. Both are server-side scoped instead of admin-gated (see
 * RPC_MAP.md §"Admin Authorization"):
 *  - rollout_check          — hard-scoped to the session user (issue #1156)
 *  - rollout_record_metrics — delta-only client telemetry (issue #1149)
 */
const PLAYER_CALLABLE_EXCEPTIONS: ReadonlySet<string> = new Set([
  'armored_archer/rollout_check',
  'armored_archer/rollout_record_metrics',
]);

/** Whether an RPC id must be registered behind `withAdminGuard`. */
export function isPrivilegedRpcId(rpcId: string): boolean {
  if (PLAYER_CALLABLE_EXCEPTIONS.has(rpcId)) {
    return false;
  }
  if (PRIVILEGED_EXACT_IDS.has(rpcId)) {
    return true;
  }
  return PRIVILEGED_PREFIXES.some((prefix) => rpcId.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Source scanning
// ---------------------------------------------------------------------------

/** One parsed registration call site. */
export interface RpcCallSite {
  /** Registration id (first string argument), e.g. 'armored_archer/metrics'. */
  rpcId: string;
  /** 1-based line number of the `registerRpc(` token in the source. */
  line: number;
  /** True when the handler argument contains a `withAdminGuard(` call. */
  guarded: boolean;
  /** The rpcId label inside `withAdminGuard('...', handler)` when guarded. */
  guardRpcId: string | null;
  /** Which registration helper was used ('registerRpc' | 'registerRpcWithMetrics'). */
  kind: 'registerRpc' | 'registerRpcWithMetrics';
}

/** A failing rule violation. */
export interface CoverageViolation {
  rule:
    | 'UNWRAPPED_PRIVILEGED_RPC'
    | 'GUARD_RPC_ID_MISMATCH'
    | 'GUARDED_NON_PRIVILEGED_RPC';
  file: string;
  line: number;
  rpcId: string;
  message: string;
}

/** A non-failing advisory. */
export interface CoverageWarning {
  rule: 'MISSING_ALLOWLIST_TEST_FIXTURE';
  file: string;
  message: string;
}

export interface ScanResult {
  violations: CoverageViolation[];
  warnings: CoverageWarning[];
  /** Number of registration call sites scanned (for the report footer). */
  scannedCalls: number;
  /** Number of privileged (admin-guarded by policy) call sites found. */
  privilegedCalls: number;
}

/** Registration helpers whose call sites the scanner understands. */
const REGISTRATION_HELPERS = ['registerRpcWithMetrics', 'registerRpc'] as const;

/**
 * Extract the substring of a balanced argument list starting at `openIndex`
 * (the index of the opening parenthesis), honoring nested parentheses and
 * string/template literals. Returns the arguments text without the outer
 * parens, or null when the call is malformed/unterminated.
 */
function extractBalancedArgs(source: string, openIndex: number): string | null {
  let depth = 0;
  let i = openIndex;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote !== null) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, i);
      }
    }
    i += 1;
  }
  return null;
}

/** Parse one argument-list text into top-level comma-separated arguments. */
function splitTopLevelArgs(argsText: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < argsText.length; i += 1) {
    const ch = argsText[i];
    if (quote !== null) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
    } else if (ch === ',' && depth === 0) {
      args.push(argsText.slice(start, i));
      start = i + 1;
    }
  }
  args.push(argsText.slice(start));
  return args;
}

/** Extract a plain string literal's value from an argument expression. */
function parseStringArg(arg: string): string | null {
  const match = /^\s*(['"])([^'"]*)\1\s*$/.exec(arg);
  return match === null ? null : match[2];
}

/**
 * Find every `initializer.registerRpc(...)` and
 * `registerRpcWithMetrics(initializer, id, name, handler)` call site in a
 * module source. Anonymous dynamic registrations (rare) are out of scope.
 */
export function extractRegisterRpcCalls(source: string): RpcCallSite[] {
  const calls: RpcCallSite[] = [];
  for (const helper of REGISTRATION_HELPERS) {
    const needle = helper === 'registerRpc' ? '.registerRpc(' : `${helper}(`;
    let searchFrom = 0;
    for (;;) {
      const idx = source.indexOf(needle, searchFrom);
      if (idx === -1) {
        break;
      }
      searchFrom = idx + needle.length;
      // NOTE: '.registerRpc(' cannot collide with '.registerRpcWithMetrics('
      // because the needle requires '(' immediately after 'registerRpc'.
      const argsText = extractBalancedArgs(source, idx + needle.length - 1);
      if (argsText === null) {
        continue;
      }
      const args = splitTopLevelArgs(argsText);
      // registerRpc(id, handler)              → id is args[0], handler args[1]
      // registerRpcWithMetrics(init, id, ..., handler) → id is args[1], handler last
      const idIndex = helper === 'registerRpc' ? 0 : 1;
      const rpcId = parseStringArg(args[idIndex] ?? '');
      if (rpcId === null) {
        continue; // dynamic id — out of scope for the static checker
      }
      const handlerArg =
        helper === 'registerRpc' ? args[1] ?? '' : args[args.length - 1] ?? '';
      const guardMatch = /withAdminGuard\s*\(\s*(['"])([^'"]*)\1/.exec(handlerArg);
      calls.push({
        rpcId,
        line: source.slice(0, idx).split('\n').length,
        guarded: guardMatch !== null,
        guardRpcId: guardMatch === null ? null : guardMatch[2],
        kind: helper,
      });
    }
  }
  calls.sort((a, b) => a.line - b.line);
  return calls;
}

/**
 * Scan one module's source text and return any rule violations.
 * `fileName` is used only for reporting.
 */
export function scanSource(fileName: string, source: string): CoverageViolation[] {
  const violations: CoverageViolation[] = [];
  for (const call of extractRegisterRpcCalls(source)) {
    if (isPrivilegedRpcId(call.rpcId)) {
      if (!call.guarded) {
        violations.push({
          rule: 'UNWRAPPED_PRIVILEGED_RPC',
          file: fileName,
          line: call.line,
          rpcId: call.rpcId,
          message:
            `${call.rpcId} is a privileged RPC per ADR-0006 but its ${call.kind} ` +
            'handler is not wrapped in withAdminGuard — see ADR-0006 §Policy 9 ' +
            "(the guard must wrap the handler at the registration site inside the " +
            'owning module). Scaffold the full 3-file walk with scripts/new-admin-rpc.sh.',
        });
      } else if (call.guardRpcId !== null && call.guardRpcId !== call.rpcId) {
        violations.push({
          rule: 'GUARD_RPC_ID_MISMATCH',
          file: fileName,
          line: call.line,
          rpcId: call.rpcId,
          message:
            `${call.rpcId} is registered under withAdminGuard('${call.guardRpcId}') — ` +
            'the guard label must equal the registration id or audit records, ' +
            'metric labels, and log lines will be attributed to the wrong RPC.',
        });
      }
    } else if (call.guarded) {
      violations.push({
        rule: 'GUARDED_NON_PRIVILEGED_RPC',
        file: fileName,
        line: call.line,
        rpcId: call.rpcId,
        message:
          `${call.rpcId} is wrapped in withAdminGuard but is not in the privileged ` +
          'id set of backend/scripts/check-admin-guard-coverage.ts. Either a ' +
          'player-facing RPC is now unreachable for players (the allowlist can ' +
          'never authorize them) or the RPC is genuinely admin-only and its id ' +
          'must be added to PRIVILEGED_EXACT_IDS / PRIVILEGED_PREFIXES.',
      });
    }
  }
  return violations;
}

/** File names that never contain registrations and are skipped by the scan. */
const SCAN_SKIP_FILES = new Set(['admin_auth.ts']);

/**
 * Scan a modules directory (default backend/src/modules) — every
 * top-level *.ts except admin_auth.ts and __tests__/__mocks__ subtrees —
 * and additionally warn when a privileged module's sibling test file is
 * missing the resetAdminAllowlistCache fixture.
 */
export function scanModuleDirectory(modulesDir: string): ScanResult {
  const violations: CoverageViolation[] = [];
  const warnings: CoverageWarning[] = [];
  let scannedCalls = 0;
  let privilegedCalls = 0;

  const entries = fs
    .readdirSync(modulesDir)
    .filter((f) => f.endsWith('.ts') && !SCAN_SKIP_FILES.has(f))
    .sort();

  for (const fileName of entries) {
    const filePath = path.join(modulesDir, fileName);
    const source = fs.readFileSync(filePath, 'utf8');
    const calls = extractRegisterRpcCalls(source);
    scannedCalls += calls.length;
    const privileged = calls.filter((c) => isPrivilegedRpcId(c.rpcId));
    privilegedCalls += privileged.length;
    violations.push(...scanSource(filePath, source));

    if (privileged.length > 0) {
      const testPath = path.join(modulesDir, '__tests__', fileName.replace(/\.ts$/, '.test.ts'));
      const hasFixture =
        fs.existsSync(testPath) && fs.readFileSync(testPath, 'utf8').includes('resetAdminAllowlistCache');
      if (!hasFixture) {
        warnings.push({
          rule: 'MISSING_ALLOWLIST_TEST_FIXTURE',
          file: filePath,
          message:
            `${fileName} registers ${privileged.length} privileged RPC(s) ` +
            `(${privileged.map((p) => p.rpcId).join(', ')}) but ${testPath} ` +
            'does not exist or does not use the resetAdminAllowlistCache ' +
            'allowlist fixture (step 2 of the 3-file walk — see issue #1145).',
        });
      }
    }
  }

  return { violations, warnings, scannedCalls, privilegedCalls };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const ARGS = process.argv.slice(2);

function hasFlag(flag: string): boolean {
  return ARGS.includes(flag);
}

function flagValue(flag: string): string | null {
  const idx = ARGS.indexOf(flag);
  return idx === -1 || idx + 1 >= ARGS.length ? null : ARGS[idx + 1];
}

function main(): void {
  const isPrivilegedProbe = flagValue('--is-privileged');
  if (isPrivilegedProbe !== null) {
    if (isPrivilegedRpcId(isPrivilegedProbe)) {
      console.log(`${isPrivilegedProbe}: privileged (must be wrapped in withAdminGuard)`);
      process.exit(0);
    }
    console.log(
      `${isPrivilegedProbe}: NOT privileged — scripts/new-admin-rpc.sh only scaffolds ` +
        'admin-guarded RPCs (see backend/scripts/check-admin-guard-coverage.ts)',
    );
    process.exit(1);
  }

  const modulesDir = path.resolve(__dirname, '..', 'src', 'modules');
  const result = scanModuleDirectory(modulesDir);

  if (hasFlag('--json-output')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const v of result.violations) {
      console.error(`❌ [${v.rule}] ${v.file}:${v.line} (${v.rpcId})\n   ${v.message}\n`);
    }
    for (const w of result.warnings) {
      console.warn(`⚠️  [${w.rule}] ${w.file}\n   ${w.message}\n`);
    }
    console.log(
      `Scanned ${result.scannedCalls} RPC registrations (${result.privilegedCalls} privileged): ` +
        `${result.violations.length} violation(s), ${result.warnings.length} warning(s).`,
    );
  }

  if (result.violations.length > 0) {
    console.error(
      '\nwithAdminGuard coverage check FAILED — every privileged RPC must be wrapped ' +
        '(ADR-0006). Run scripts/new-admin-rpc.sh to scaffold the full 3-file walk.',
    );
    process.exit(1);
  }
  console.log('✅ withAdminGuard coverage check passed (ADR-0006 / issue #1145).');
}

if (require.main === module) {
  main();
}
