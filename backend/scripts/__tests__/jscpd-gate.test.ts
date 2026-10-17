import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  normalizeLine,
  fragmentLineHashes,
  evaluateGate,
  buildBaseline,
  describeClone,
  CloneEntry,
  BaselineV2,
} from '../jscpd-gate';

const CLONE_A: CloneEntry = {
  firstFile: { name: 'src/a.ts', start: 1, end: 6 },
  secondFile: { name: 'src/b.ts', start: 10, end: 15 },
  fragment:
    'const validation = validatePayload(schema, payload, label);\n' +
    'if (!validation.ok) {\n' +
    '  return createValidationErrorResponse(validation.error, label);\n' +
    '}\n' +
    'const data = validation.data;\n' +
    'return JSON.stringify({ ok: true, data });',
  lines: 6,
};

describe('normalizeLine', () => {
  it('collapses whitespace and strips line comments', () => {
    expect(normalizeLine('  const   x = 1; // init')).toBe('const x = 1;');
  });

  it('keeps identifiers and literals significant', () => {
    expect(normalizeLine('foo(1)')).not.toBe(normalizeLine('foo(2)'));
    expect(normalizeLine('rpcAlpha')).not.toBe(normalizeLine('rpcBeta'));
  });
});

describe('fragmentLineHashes', () => {
  it('hashes each meaningful line and skips blanks and comments', () => {
    const hashes = fragmentLineHashes('const a = 1;\n\n// note\nconst b = 2;');
    expect(hashes).toHaveLength(2);
  });

  it('skips jsdoc lines inside fragments', () => {
    const hashes = fragmentLineHashes('/**\n * RPC handler for logging events.\n */\nconst a = 1;');
    expect(hashes).toEqual(fragmentLineHashes('const a = 1;'));
  });

  it('is stable across indentation and block comments', () => {
    const a = fragmentLineHashes('if (!ok) {\n  return err;\n}');
    const b = fragmentLineHashes('/* header */\nif (!ok) {\n        return err;\n}');
    expect(a).toEqual(b);
  });
});

describe('buildBaseline + evaluateGate', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscpd-gate-test-'));
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src/b.ts'), Array.from({ length: 20 }, (_, i) => 'line' + (i + 1)).join('\n'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const baselineWith = (cloneCount: number, clones: CloneEntry[]): BaselineV2 => ({
    ...buildBaseline(clones, dir),
    cloneCount,
  });

  it('passes when count is within budget and all lines are known', () => {
    const r = evaluateGate([CLONE_A], baselineWith(1, [CLONE_A]), 0);
    expect(r.ok).toBe(true);
    expect(r.newContentClones).toHaveLength(0);
  });

  it('passes a re-paired, re-spanned clone of known content', () => {
    const moved: CloneEntry = {
      ...CLONE_A,
      firstFile: { name: 'src/c.ts', start: 400, end: 407 },
      secondFile: { name: 'src/d.ts', start: 90, end: 97 },
      fragment: CLONE_A.fragment + '\n' + CLONE_A.fragment.split('\n')[0],
    };
    const r = evaluateGate([moved], baselineWith(1, [CLONE_A]), 0);
    expect(r.ok).toBe(true);
  });

  it('fails when the clone count exceeds the budget', () => {
    const r = evaluateGate([CLONE_A, CLONE_A], baselineWith(1, [CLONE_A, CLONE_A]), 0);
    expect(r.ok).toBe(false);
    expect(r.countExceeded).toBe(true);
  });

  it('fails on brand-new duplicated content even at equal count', () => {
    const novel: CloneEntry = {
      ...CLONE_A,
      fragment: 'totally\nnovel\nduplicated\nblock\ngoes\nhere',
    };
    const r = evaluateGate([novel], baselineWith(1, [CLONE_A]), 0);
    expect(r.ok).toBe(false);
    expect(r.newContentClones).toHaveLength(1);
    expect(r.countExceeded).toBe(false);
  });

  it('tolerates up to 3 swept context lines in a re-spanned clone', () => {
    const swept: CloneEntry = {
      ...CLONE_A,
      fragment:
        'context one\ncontext two\ncontext three\n' + CLONE_A.fragment,
    };
    const r = evaluateGate([swept], baselineWith(2, [CLONE_A]), 0);
    expect(r.ok).toBe(true);
  });

  it('flags a clone with 4+ novel lines', () => {
    const sneaky: CloneEntry = {
      ...CLONE_A,
      fragment:
        'context one\ncontext two\ncontext three\nconst sneaky = brandNewLine();\n' +
        CLONE_A.fragment,
    };
    const r = evaluateGate([sneaky], baselineWith(2, [CLONE_A]), 0);
    expect(r.ok).toBe(false);
  });

  it('honors a nonzero new-content allowance', () => {
    const novel: CloneEntry = {
      ...CLONE_A,
      fragment: 'totally\nnovel\nduplicated\nblock\ngoes\nhere',
    };
    const r = evaluateGate([novel], baselineWith(1, [CLONE_A]), 1);
    expect(r.ok).toBe(true);
  });
});

describe('describeClone', () => {
  it('renders a compact location line', () => {
    expect(describeClone(CLONE_A)).toContain('src/a.ts:1 ~ src/b.ts:10');
    expect(describeClone(CLONE_A)).toContain('6L');
  });
});
