#!/usr/bin/env ts-node
/**
 * jscpd baseline gate (position-insensitive).
 *
 * Replaces `jscpd --baseline --fail-on-new-clones`, whose pair fingerprints
 * depend on line positions and clone-boundary spans: a large edit that shifts
 * lines re-pairs ubiquitous boilerplate (RPC handler signatures, validate
 * blocks) or widens a clone's span, and the unchanged content is reported as
 * "new".
 *
 * This gate keeps the same detector settings (.jscpd.backend.json) but
 * compares CONTENT instead of positions:
 *   1. Count ratchet: total clone count must not exceed the recorded budget.
 *      Any net new clone fails; removals lower the count and the budget is
 *      ratcheted down on the next baseline update.
 *   2. Line-content baseline: every non-empty normalized line of every
 *      reported clone fragment must already appear in some baselined clone.
 *      A brand-new duplicated block fails even if an old clone was removed
 *      elsewhere (count-neutral swap); re-paired or re-spanned clones of
 *      already-duplicated content pass.
 *
 * Baseline file format (version 2):
 *   { "version": 2, "cloneCount": number, "lines": { "<sha256-16>": 1 } }
 *
 * Regenerate after merging clone removals:
 *   cd backend && npm run detect-duplicate:update-baseline
 */
import { execFileSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface CloneFileSide {
  name: string;
  start: number;
  end: number;
}

export interface CloneEntry {
  firstFile: CloneFileSide;
  secondFile: CloneFileSide;
  fragment: string;
  lines: number;
}

export interface BaselineV2 {
  version: 2;
  cloneCount: number;
  lines: Record<string, 1>;
}

/** Remove block comments (they may span lines) before per-line work. */
function stripBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Normalize one line: drop trailing line comment, collapse whitespace. */
export function normalizeLine(line: string): string {
  return line.replace(/\/\/.*$/, '').replace(/\s+/g, ' ').trim();
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** Comment-only lines carry no duplication signal in weak mode. */
function isCommentLine(normalized: string): boolean {
  return normalized.startsWith('*') || normalized.startsWith('//') || normalized.startsWith('/*');
}

/** Hashes of the meaningful code lines of one clone fragment. */
export function fragmentLineHashes(fragment: string): string[] {
  return stripBlockComments(fragment)
    .split('\n')
    .map(normalizeLine)
    .filter((l) => l.length > 0 && !isCommentLine(l))
    .map(hashText);
}

/** Extract the exact lines a clone side spans from its source file. */
export function extractSideText(rootDir: string, side: CloneFileSide): string {
  const abs = path.resolve(rootDir, side.name);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  return lines.slice(side.start - 1, side.end).join('\n');
}

/**
 * A clone is new content only when at least this many of its fragment lines
 * are absent from the baseline. Detector min-lines is 5, so a genuinely new
 * clone contributes 5+ novel lines; large edits re-span existing clones and
 * sweep in 1-3 previously uncloned context lines, which must not fail.
 */
export const MIN_NOVEL_LINES = 4;

export interface GateResult {
  cloneCount: number;
  countBudget: number;
  countExceeded: boolean;
  newContentClones: CloneEntry[];
  ok: boolean;
}

export function evaluateGate(
  duplicates: CloneEntry[],
  baseline: BaselineV2,
  maxNewContent: number
): GateResult {
  const countExceeded = duplicates.length > baseline.cloneCount;
  const newContentClones = duplicates.filter(
    (d) =>
      fragmentLineHashes(d.fragment).filter((h) => baseline.lines[h] !== 1).length >=
      MIN_NOVEL_LINES
  );
  return {
    cloneCount: duplicates.length,
    countBudget: baseline.cloneCount,
    countExceeded,
    newContentClones,
    ok: !countExceeded && newContentClones.length <= maxNewContent,
  };
}

export function buildBaseline(duplicates: CloneEntry[], rootDir: string): BaselineV2 {
  const lines: Record<string, 1> = {};
  for (const d of duplicates) {
    for (const h of fragmentLineHashes(d.fragment)) {
      lines[h] = 1;
    }
    // Record the second side too: jscpd reports only one fragment per pair,
    // and re-pairing after edits can flip or rotate which side is reported.
    try {
      for (const h of fragmentLineHashes(extractSideText(rootDir, d.secondFile))) {
        lines[h] = 1;
      }
    } catch {
      // Second side unreadable (deleted file, odd range): first side only.
    }
  }
  return { version: 2, cloneCount: duplicates.length, lines };
}

export function describeClone(clone: CloneEntry): string {
  const firstLine = clone.fragment.split('\n').find((l) => l.trim().length > 0) ?? '';
  return (
    `  ${clone.lines}L ${clone.firstFile.name}:${clone.firstFile.start} ~ ` +
    `${clone.secondFile.name}:${clone.secondFile.start}  ${firstLine.trim().slice(0, 60)}`
  );
}

function runJscpd(config: string, rootDir: string): CloneEntry[] {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscpd-gate-'));
  execFileSync(
    'npx',
    ['jscpd', '--config', config, '--reporters', 'json', '--output', outDir, '.'],
    { cwd: rootDir, stdio: ['ignore', 'inherit', 'inherit'] }
  );
  const report = JSON.parse(
    fs.readFileSync(path.join(outDir, 'jscpd-report.json'), 'utf8')
  );
  fs.rmSync(outDir, { recursive: true, force: true });
  return report.duplicates as CloneEntry[];
}

function parseArgs(argv: string[]): {
  config: string;
  baseline: string;
  updateBaseline: boolean;
  maxNewContent: number;
} {
  const args = {
    config: '.jscpd.backend.json',
    baseline: '.jscpd-baseline.json',
    updateBaseline: false,
    maxNewContent: 0,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = argv[++i];
    else if (argv[i] === '--baseline') args.baseline = argv[++i];
    else if (argv[i] === '--update-baseline') args.updateBaseline = true;
    else if (argv[i] === '--fail-on-new-clones') args.maxNewContent = Number(argv[++i]);
  }
  return args;
}

/* istanbul ignore next -- CLI entrypoint */
function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const duplicates = runJscpd(args.config, rootDir);

  if (args.updateBaseline) {
    const next = buildBaseline(duplicates, rootDir);
    let added = 0;
    let removed = 0;
    if (fs.existsSync(args.baseline)) {
      const prev = JSON.parse(fs.readFileSync(args.baseline, 'utf8')) as Partial<BaselineV2>;
      for (const h of Object.keys(next.lines)) if (!prev.lines?.[h]) added++;
      for (const h of Object.keys(prev.lines ?? {})) if (!next.lines[h]) removed++;
    }
    fs.writeFileSync(args.baseline, JSON.stringify(next, null, 2) + '\n');
    console.log(
      `Baseline ${args.baseline} updated: ${added} line hashes added, ${removed} removed ` +
        `(${Object.keys(next.lines).length} total, clone budget ${next.cloneCount})`
    );
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(args.baseline, 'utf8')) as BaselineV2;
  if (baseline.version !== 2 || typeof baseline.cloneCount !== 'number' || !baseline.lines) {
    console.error(
      `${args.baseline} is not a version-2 content baseline. ` +
        'Regenerate with: npm run detect-duplicate:update-baseline'
    );
    process.exit(1);
  }

  const result = evaluateGate(duplicates, baseline, args.maxNewContent);
  if (!result.ok) {
    if (result.countExceeded) {
      console.error(
        `ERROR: clone count rose to ${result.cloneCount} ` +
          `(budget ${result.countBudget}). Remove clones or ratchet the baseline down.`
      );
    }
    if (result.newContentClones.length > args.maxNewContent) {
      console.error(
        `ERROR: ${result.newContentClones.length} clones contain duplicated lines ` +
          `absent from the baseline (allowed: ${args.maxNewContent}):`
      );
      for (const c of result.newContentClones.slice(0, 20)) {
        console.error(describeClone(c));
      }
    }
    process.exit(1);
  }
  console.log(
    `jscpd gate OK: ${result.cloneCount} clones (budget ${result.countBudget}), no new duplicated content.`
  );
}

/* istanbul ignore next -- CLI entrypoint */
if (require.main === module) {
  main();
}
