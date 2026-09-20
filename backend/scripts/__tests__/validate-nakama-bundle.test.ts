/**
 * Unit tests for scripts/validate-nakama-bundle.js — issue #994.
 *
 * The validator is a CLI script (no module exports, runs validateBundle() at
 * require time), so these tests load its REAL source into a `vm` context with
 * stubbed `require('fs')`, a process.exit stub that records the code and then
 * aborts via a sentinel (exactly where the real exit would stop), and captured
 * console output. A follow-up script in the same context re-exports the
 * internal helpers for direct unit testing. The script itself is not modified.
 *
 * Fixtures formalize the manual TEST INJECTION verification from issue #957 /
 * PR #982 (recovered from the "test-injection debris" stash):
 *   - Fixture A: bundle-shaped JS whose strings/templates/comments merely
 *     LOOK like ES6 → validator must report no violations (exit 0).
 *   - Fixture B: Fixture A + real top-level ES6 patterns appended →
 *     validator must flag each expected pattern name (exit 1).
 */

import { readFileSync } from 'fs';
import * as nodePath from 'path';
import { createContext, runInContext } from 'vm';

const SCRIPT_PATH = nodePath.join(__dirname, '..', 'validate-nakama-bundle.js');
const FIXTURE_TRAPS_ONLY_PATH = nodePath.join(__dirname, 'fixtures', 'bundle-string-traps-only.js');

/** Real top-level ES6 patterns appended to Fixture A to build Fixture B. */
const REAL_ES6_BLOCK = `
// These are REAL top-level ES6 patterns (must be flagged).
const __realConst = 1;
let __realLet = 2;
class __RealClass { method() { return async () => { await 1; }; } }
const __realArrow = () => { return 1; };
const __realSingle = x => { return x; };
const __realTmpl = \`hello \${__realConst} world\`;
async function __realAsyncFn() { return 1; }
await Promise.resolve(1);
`;

interface StripResult {
  line: string;
  state: string;
}

interface BalancedExprResult {
  text: string;
  end: number;
}

interface Es6Pattern {
  pattern: RegExp;
  name: string;
  strict: boolean;
}

interface ValidatorInternals {
  stripNonCode: (line: string, state?: string) => StripResult;
  readBalancedExpr: (line: string, start: number) => BalancedExprResult;
  es6Patterns: Es6Pattern[];
}

interface ValidatorHarness extends ValidatorInternals {
  /** Every process.exit() code the script requested, in order. */
  exitCodes: number[];
  /** console.log output, one entry per call. */
  stdout: string[];
  /** console.error output, one entry per call. */
  stderr: string[];
  /** Paths handed to the stubbed fs.existsSync/readFileSync. */
  requestedPaths: string[];
}

/**
 * Execute validate-nakama-bundle.js in an isolated vm context against the
 * given bundle content. Pass `null` to simulate a missing bundle file.
 *
 * The stubbed process.exit records the requested code and then throws a
 * sentinel so execution stops exactly where the real process.exit would —
 * the script's early-exit "bundle not found" path must not fall through to
 * readFileSync.
 */
const EXIT_SENTINEL = { code: '__VALIDATOR_EXIT__' };

function loadValidator(bundleContent: string | null): ValidatorHarness {
  const raw = readFileSync(SCRIPT_PATH, 'utf8');
  // vm does not tolerate a shebang the way Node module loaders do.
  const source = raw.startsWith('#!') ? raw.replace(/^#![^\n]*/, '') : raw;

  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCodes: number[] = [];
  const requestedPaths: string[] = [];

  const sandbox: {
    __dirname: string;
    require: (name: string) => unknown;
    process: { exit: (code?: number) => void };
    console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  } = {
    // Mirrors the script's real location so BUNDLE_PATH resolves plausibly.
    __dirname: '/project/backend/scripts',
    require: (name: string): unknown => {
      if (name === 'fs') {
        return {
          existsSync: (p: string) => {
            requestedPaths.push(p);
            return bundleContent !== null;
          },
          readFileSync: (p: string) => {
            requestedPaths.push(p);
            if (bundleContent === null) {
              throw new Error(`ENOENT: no such file: ${p}`);
            }
            return bundleContent;
          },
        };
      }
      if (name === 'path') {
        return nodePath;
      }
      throw new Error(`loadValidator: unexpected require("${name}")`);
    },
    process: {
      exit: (code = 0) => {
        exitCodes.push(code);
        throw EXIT_SENTINEL;
      },
    },
    console: {
      log: (...args: unknown[]) => stdout.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => stderr.push(args.map(String).join(' ')),
    },
  };

  const context = createContext(sandbox);
  try {
    // Runs validateBundle() at the end; the exit stub aborts via the sentinel.
    runInContext(source, context, { filename: 'validate-nakama-bundle.js' });
  } catch (err) {
    if (err !== EXIT_SENTINEL) {
      throw err;
    }
  }

  // The script has no exports; re-export its top-level internals for unit
  // tests. Top-level const/function bindings are visible to later scripts
  // run in the same context.
  const internals = runInContext(
    '({ stripNonCode: stripNonCode, readBalancedExpr: readBalancedExpr, es6Patterns: es6Patterns })',
    context,
    { filename: 'validate-nakama-bundle-internals.js' }
  );
  if (
    typeof internals !== 'object' ||
    internals === null ||
    typeof internals.stripNonCode !== 'function' ||
    typeof internals.readBalancedExpr !== 'function' ||
    !Array.isArray(internals.es6Patterns)
  ) {
    throw new Error('validate-nakama-bundle.js did not expose its internals');
  }
  return { ...internals, exitCodes, stdout, stderr, requestedPaths };
}

describe('validate-nakama-bundle', () => {
  describe('string-context traps are not flagged (issue #957 regression)', () => {
    it('reports zero violations and exits 0 for string/template/comment traps', () => {
      const fixtureA = readFileSync(FIXTURE_TRAPS_ONLY_PATH, 'utf8');
      const harness = loadValidator(fixtureA);

      // Every registered pattern must be explicitly reported clean
      // (BigInt literal pattern added in #1135; see scripts/validate-nakama-bundle.js).
      expect(harness.es6Patterns.length).toBe(9);
      for (const { name } of harness.es6Patterns) {
        expect(harness.stdout.some((l) => l.includes(`${name}: No occurrences`))).toBe(true);
      }
      expect(harness.stderr).toHaveLength(0);
      expect(harness.stdout.some((l) => l.includes('Bundle validation PASSED'))).toBe(true);
      expect(harness.exitCodes).toEqual([0]);
    });
  });

  describe('real ES6 patterns are flagged (Fixture B)', () => {
    it('flags each expected pattern name with the expected count and exits 1', () => {
      const fixtureA = readFileSync(FIXTURE_TRAPS_ONLY_PATH, 'utf8');
      const harness = loadValidator(fixtureA + REAL_ES6_BLOCK);

      const expectedCounts: Record<string, number> = {
        'const declaration': 4,
        'let declaration': 1,
        'class declaration': 1,
        'async keyword': 1,
        'await keyword': 1,
        'arrow function': 2,
        'arrow function (single param)': 1,
        'template literal': 1,
      };

      for (const [name, count] of Object.entries(expectedCounts)) {
        expect(harness.stderr.some((l) => l.includes(`${name}: ${count} occurrences`))).toBe(true);
      }
      expect(
        harness.stderr.some((l) => l.includes('Bundle validation FAILED: 12 ES6+ patterns found'))
      ).toBe(true);
      expect(harness.exitCodes).toEqual([1]);
    });
  });

  describe('missing bundle handling', () => {
    it('exits 1 with a not-found message when the bundle is absent', () => {
      const harness = loadValidator(null);

      expect(harness.exitCodes).toEqual([1]);
      expect(harness.stderr.some((l) => l.includes('Bundle not found at'))).toBe(true);
      expect(harness.requestedPaths[0]).toMatch(/data[/]modules[/]index[.]js$/);
    });
  });

  describe('es6Patterns registry', () => {
    it('tracks exactly the eight documented ES6+ checks', () => {
      const harness = loadValidator('var ok = 1;\n');

      expect(harness.es6Patterns.map((p) => p.name)).toEqual([
        'const declaration',
        'let declaration',
        'class declaration',
        'async keyword',
        'await keyword',
        'arrow function',
        'arrow function (single param)',
        'template literal',
        'BigInt literal',
      ]);
    });
  });

  describe('stripNonCode', () => {
    it('passes plain code through unchanged', () => {
      const harness = loadValidator('var ok = 1;\n');

      expect(harness.stripNonCode('var x = 1;')).toEqual({ line: 'var x = 1;', state: 'code' });
    });

    it('blanks single-quoted string content but keeps the quotes', () => {
      const harness = loadValidator('var ok = 1;\n');

      const out = harness.stripNonCode("var s = 'const hidden = () => 1;';");
      expect(out.state).toBe('code');
      expect(out.line).not.toContain('const');
      expect(out.line).not.toContain('=>');
      expect(out.line.startsWith("var s = '")).toBe(true);
      expect(out.line.endsWith("';")).toBe(true);
    });

    it('treats escaped quotes and backslashes inside strings as content', () => {
      const harness = loadValidator('var ok = 1;\n');

      // JS line: var s = 'don\'t "q" \ x'; — 15 content chars → 15 spaces.
      const out = harness.stripNonCode("var s = 'don\\'t \"q\" \\\\ x';");
      expect(out.state).toBe('code');
      expect(out.line).not.toContain('don');
      expect(out.line).not.toContain('"q"');
      expect(out.line).toBe("var s = '" + ' '.repeat(15) + "';");
    });

    it('blanks double-quoted string content including nested quote chars', () => {
      const harness = loadValidator('var ok = 1;\n');

      const out = harness.stripNonCode('var s = "outer \'inner let x = 1;\' tail";');
      expect(out.state).toBe('code');
      expect(out.line).not.toContain('let');
      // 29 content chars between the double quotes → 29 spaces.
      expect(out.line).toBe('var s = "' + ' '.repeat(29) + '";');
    });

    it('blanks line comments and reports the lineComment carry state', () => {
      const harness = loadValidator('var ok = 1;\n');

      const out = harness.stripNonCode('var a = 1; // const hidden = 2; let h = () => {}');
      expect(out.state).toBe('lineComment');
      expect(out.line.trimEnd()).toBe('var a = 1;');
    });

    it('resets the lineComment carry state at the next line boundary', () => {
      const harness = loadValidator('var ok = 1;\n');

      const first = harness.stripNonCode('// a whole-line comment with class Fake {}');
      expect(first.state).toBe('lineComment');

      const second = harness.stripNonCode('var next = 2;', first.state);
      expect(second).toEqual({ line: 'var next = 2;', state: 'code' });
    });

    it('carries block-comment state across lines until the closing */', () => {
      const harness = loadValidator('var ok = 1;\n');

      const open = harness.stripNonCode('var a = 1; /* const hidden = 5;');
      expect(open.state).toBe('blockComment');
      expect(open.line).not.toContain('const');

      const closed = harness.stripNonCode(' let hiddenToo = 6; */ var b = 2;', open.state);
      expect(closed.state).toBe('code');
      expect(closed.line).not.toContain('hiddenToo');
      expect(closed.line).toContain('var b = 2;');
    });

    it('carries template-literal state across lines, blanking inner content', () => {
      const harness = loadValidator('var ok = 1;\n');

      const open = harness.stripNonCode('var t = `start of a long template');
      expect(open.state).toBe('template');

      const mid = harness.stripNonCode('const fake = 1; async () => await 2;', open.state);
      expect(mid.state).toBe('template');
      expect(mid.line).not.toMatch(/\S/);

      const close = harness.stripNonCode('end of template`; var after = 2;', mid.state);
      expect(close.state).toBe('code');
      expect(close.line).not.toContain('end of template');
      expect(close.line).toContain('`;');
      expect(close.line).toContain('var after = 2;');
    });

    it('preserves ${...} expressions but strips nested strings inside them', () => {
      const harness = loadValidator('var ok = 1;\n');

      const out = harness.stripNonCode("var t = `hi ${cond ? 'yes' : 'no'} bye`;");
      expect(out.state).toBe('code');
      expect(out.line).toContain("${cond ? '   ' : '  '}");
      expect(out.line).not.toContain('hi');
      expect(out.line).not.toContain('bye');
      expect(out.line).not.toContain('yes');
      expect(out.line).not.toContain('no');
    });
  });

  describe('readBalancedExpr', () => {
    it('reads to the brace matching nested openings', () => {
      const harness = loadValidator('var ok = 1;\n');

      expect(harness.readBalancedExpr('${{a:1}.a} rest', 2)).toEqual({ text: '{a:1}.a', end: 9 });
    });

    it('ignores braces inside quoted strings within the expression', () => {
      const harness = loadValidator('var ok = 1;\n');

      expect(harness.readBalancedExpr("${'{' } tail", 2)).toEqual({ text: "'{' ", end: 6 });
    });

    it('ignores braces inside nested template literals', () => {
      const harness = loadValidator('var ok = 1;\n');

      expect(harness.readBalancedExpr('${`a{b` } z', 2)).toEqual({ text: '`a{b` ', end: 8 });
    });
  });
});
