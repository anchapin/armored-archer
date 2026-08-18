#!/usr/bin/env npx ts-node
/**
 * Tracked-but-ignored Files Validation Script
 *
 * Fails when any file is BOTH tracked by git AND matched by a .gitignore rule
 * (i.e. `git ls-files -i -c --exclude-standard` output is non-empty).
 * Tracked-but-ignored files are a secrets-leak vector: .gitignore alone cannot
 * untrack an already-committed file, so CI must guard against regressions
 * (issue #1032 — backend/.env.{alpha,beta,development,staging} were tracked).
 *
 * This script only enumerates FILE PATHS from the git index; it never reads,
 * prints, or copies file contents.
 *
 * Usage:
 *   npx ts-node scripts/validate-tracked-ignored-files.ts [--ci-mode] [--json-output]
 *
 * Options:
 *   --ci-mode       Exit with error if validation fails
 *   --json-output   Output only JSON report (for programmatic use)
 */

import { execSync } from 'child_process';
import * as path from 'path';

// Configuration
const ROOT_DIR = path.join(__dirname, '..', '..');
const CI_MODE = process.argv.includes('--ci-mode');
const JSON_OUTPUT = process.argv.includes('--json-output');

const GIT_COMMAND = 'git ls-files -i -c --exclude-standard';

/** Injectable git runner so unit tests can stub the subprocess. */
export type GitRunner = (command: string, cwd: string) => string;

export interface ValidationIssue {
  type: 'error' | 'warning';
  category: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  command: string;
  repoRoot: string;
  trackedIgnoredFiles: string[];
  issues: ValidationIssue[];
}

const defaultGitRunner: GitRunner = (command: string, cwd: string): string =>
  execSync(command, { cwd, encoding: 'utf8' });

/**
 * List files that are tracked (in the index) while also matching an ignore
 * rule. Returns sorted, de-duplicated relative paths; empty when clean.
 */
export function getTrackedIgnoredFiles(
  rootDir: string,
  runGit: GitRunner = defaultGitRunner,
): string[] {
  const output = runGit(GIT_COMMAND, rootDir);
  const seen = new Set<string>();
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (line.length > 0) {
      seen.add(line);
    }
  }
  return Array.from(seen).sort();
}

/**
 * Run the tracked-but-ignored validation against the given repository root.
 * Returns a structured result; never throws, never reads file contents.
 */
export function validateTrackedIgnoredFiles(
  rootDir: string = ROOT_DIR,
  runGit: GitRunner = defaultGitRunner,
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    command: GIT_COMMAND,
    repoRoot: rootDir,
    trackedIgnoredFiles: [],
    issues: [],
  };

  let files: string[];
  try {
    files = getTrackedIgnoredFiles(rootDir, runGit);
  } catch (error) {
    result.valid = false;
    const detail = error instanceof Error ? error.message : String(error);
    result.issues.push({
      type: 'error',
      category: 'git',
      message: `Failed to run \`${GIT_COMMAND}\` in ${rootDir}: ${detail}`,
    });
    return result;
  }

  result.trackedIgnoredFiles = files;

  if (files.length > 0) {
    result.valid = false;
    for (const file of files) {
      result.issues.push({
        type: 'error',
        category: 'tracked-ignored',
        message: `File is tracked but ignored: ${file}`,
      });
    }
    result.issues.push({
      type: 'error',
      category: 'tracked-ignored',
      message:
        `${files.length} tracked-but-ignored file(s) found. An ignored file that is ` +
        'already committed bypasses .gitignore protection — untrack it with ' +
        '`git rm --cached <file>` and commit the removal (see issue #1032). ' +
        'If it may contain secrets, rotation is required; do not print file contents.',
    });
  }

  return result;
}

function printResults(result: ValidationResult): void {
  console.log(`\n🔍 Tracked-but-ignored files check (${result.command})`);
  console.log(`   Repo root: ${result.repoRoot}`);

  if (result.trackedIgnoredFiles.length > 0) {
    console.log('\n   ❌ Files both tracked and ignored:');
    for (const file of result.trackedIgnoredFiles) {
      console.log(`      - ${file}`);
    }
  } else {
    console.log('   No tracked-but-ignored files.');
  }

  for (const issue of result.issues) {
    console.log(`   ${issue.type === 'error' ? '❌' : '⚠️'} [${issue.category}] ${issue.message}`);
  }

  console.log(`\n${result.valid ? '✅ Validation passed!' : '❌ Validation failed!'}\n`);
}

function generateJSONReport(result: ValidationResult): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      valid: result.valid,
      command: result.command,
      repoRoot: result.repoRoot,
      trackedIgnoredFiles: result.trackedIgnoredFiles,
      issues: result.issues,
      summary: {
        trackedIgnoredFileCount: result.trackedIgnoredFiles.length,
        errors: result.issues.filter((i) => i.type === 'error').length,
        warnings: result.issues.filter((i) => i.type === 'warning').length,
      },
    },
    null,
    2,
  );
}

function main(): void {
  const result = validateTrackedIgnoredFiles();

  if (JSON_OUTPUT) {
    console.log(generateJSONReport(result));
  } else {
    printResults(result);
  }

  if (CI_MODE && !result.valid) {
    console.log('❌ CI Mode: Validation failed. Exiting with error.\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
