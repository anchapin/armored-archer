/**
 * Module-boundary ESLint rule test (issue #1086).
 *
 * Verifies the `no-restricted-imports` block in eslint.config.js that
 * guards the matchmaker ↔ season_leaderboard ↔ season_system cycle:
 * season_leaderboard.ts must never reach back into matchmaker.
 *
 * Implementation note: ESLint's flat-config loader uses dynamic import,
 * which Jest's VM blocks, and loading the project's CJS eslint.config.js
 * via require() pulls in plugins (e.g. eslint-plugin-jsdoc) that Jest's
 * TS transformer cannot handle. The cleanest way to exercise the
 * *actual* rule object that ships is to run the eslint CLI in a child
 * process. The rule's `files` glob is a literal path
 * (`src/modules/season_leaderboard.ts`), so we swap the real file's
 * contents for each test snippet and restore from a backup afterwards.
 * Tests within this file run serially by Jest's default, so the
 * backup/restore is safe; the file's final state matches the
 * checked-out source on disk.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TARGET_FILE = path.join(BACKEND_ROOT, 'src/modules/season_leaderboard.ts');
const ORIGINAL = fs.readFileSync(TARGET_FILE, 'utf8');

interface LintOutcome {
  /** Number of `no-restricted-imports` errors reported by eslint. */
  errors: number;
  /** First error message (or empty string if no error). */
  message: string;
}

/** Lint `code` as if it lived at `asPath` and return only the boundary errors. */
function lintSnippet(code: string, asPath: string): LintOutcome {
  const realAsPath = path.join(BACKEND_ROOT, asPath);
  const backup = realAsPath + '.bak';
  fs.copyFileSync(realAsPath, backup);
  fs.writeFileSync(realAsPath, code);

  try {
    let raw = '';
    try {
      raw = execFileSync(
        'npx',
        [
          '--no-install',
          'eslint',
          '--no-config-lookup',
          '--config',
          'eslint.config.js',
          '--format',
          'json',
          realAsPath,
        ],
        { cwd: BACKEND_ROOT, encoding: 'utf8' }
      );
    } catch (err: unknown) {
      // eslint exits non-zero on errors — the JSON still comes through on stdout.
      const e = err as { stdout?: string };
      raw = e.stdout ?? '';
    }

    interface EslintResult {
      messages: Array<{ ruleId: string | null; message: string }>;
    }
    const parsed: EslintResult[] = raw.trim() ? (JSON.parse(raw) as EslintResult[]) : [];
    const ruleErrors = parsed.flatMap((r) =>
      r.messages.filter((m) => m.ruleId === 'no-restricted-imports')
    );

    return {
      errors: ruleErrors.length,
      message: ruleErrors[0]?.message ?? '',
    };
  } finally {
    fs.copyFileSync(backup, realAsPath);
    fs.unlinkSync(backup);
  }
}

/**
 * Restore the original file content after each test as a defense-in-depth:
 * if any individual test throws mid-execution, the afterEach still
 * guarantees we don't leave a polluting snippet on disk for the next
 * developer who runs the linter.
 */
afterEach(() => {
  const current = fs.readFileSync(TARGET_FILE, 'utf8');
  if (current !== ORIGINAL) {
    fs.writeFileSync(TARGET_FILE, ORIGINAL);
  }
});

describe('eslint boundary rule — matchmaker ↔ season_leaderboard cycle (issue #1086)', () => {
  it('rejects season_leaderboard.ts importing ./matchmaker (re-introduces the cycle)', () => {
    const out = lintSnippet(
      "import { calculateRank } from './matchmaker';\nexport const x = calculateRank;",
      'src/modules/season_leaderboard.ts'
    );

    expect(out.errors).toBe(1);
    expect(out.message).toMatch(/matchmaker/);
    expect(out.message).toMatch(/1086/);
    expect(out.message).toMatch(/rank/i);
  });

  it('rejects season_leaderboard.ts importing ./matchmaker via a type-only import', () => {
    // The rule's `paths` matcher applies to all import forms (value,
    // type, side-effect). A type-only re-import would still close the
    // cycle once TS erases the import kind at runtime.
    const out = lintSnippet(
      "import type { PvPMatch } from './matchmaker';\nexport const x: PvPMatch | null = null;",
      'src/modules/season_leaderboard.ts'
    );

    expect(out.errors).toBe(1);
    expect(out.message).toMatch(/matchmaker/);
  });

  it('allows season_leaderboard.ts importing ./rank (the replacement path)', () => {
    const out = lintSnippet(
      "import { calculateRank } from './rank';\nexport const x = calculateRank;",
      'src/modules/season_leaderboard.ts'
    );

    expect(out.errors).toBe(0);
  });

  it('does not over-fire: the rule is scoped to season_leaderboard.ts only', () => {
    // matchmaker.ts itself imports ./rank (and re-exports calculateRank).
    // Importing ./matchmaker from inside matchmaker.ts is a no-op import
    // and must not trip the boundary rule — that would mean the rule is
    // unscoped and would block legitimate internal usage elsewhere.
    const out = lintSnippet(
      "import { foo } from './matchmaker';\nexport const x = foo;",
      'src/modules/matchmaker.ts'
    );

    expect(out.errors).toBe(0);
  });
});
