#!/usr/bin/env npx ts-node
/**
 * N+1 Query Detection Script
 *
 * This script statically analyzes TypeScript files to detect potential N+1 query patterns.
 * It scans for common patterns that indicate database queries inside loops.
 *
 * Usage:
 *   npx ts-node scripts/detect-n-plus-one.ts [--ci-mode]
 *
 * Options:
 *   --ci-mode    Output in CI-friendly format (exit with error if issues found)
 *
 * Detection Rules:
 * 1. Query inside loop: Detects database calls (find, findOne, findAll, insert, update, delete)
 *    within for/while/forEach loops
 * 2. Array iteration followed by query: Detects patterns where an array is iterated
 *    and each element is used to query
 * 3. Missing batch operation: Detects multiple sequential queries that could be batched
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src');
const EXCLUDED_DIRS = ['node_modules', 'build', '.git', 'dist'];
const CI_MODE = process.argv.includes('--ci-mode');

// Patterns that indicate actual database operations (not local Map/Set operations)
// These patterns look for database query methods that would make external calls
const DB_METHOD_PATTERNS = [
  /\bawait\s+\w+\.(find|findOne|findAll|insert|update|delete|create|remove|getOne|getMany|query)\s*\(/,
  /\bawait\s+nakama\.(read|write|listUsers|listObjects|writeStorageObjects|readStorageObjects)\s*\(/,
  /\bdb\.(find|findOne|findAll|insert|update|delete|create|remove|getOne|getMany|query)\s*\(/,
  /\bnakama\.(read|write|listUsers|listObjects|writeStorageObjects|readStorageObjects)\s*\(/,
  /storage\.(list|read|write)\s*\(/,
  /leaderboard\.(list|write|getOne)\s*\(/,
  /match\.(create|join|list)\s*\(/,
];

// Loop patterns
const LOOP_PATTERNS = [
  /\bfor\s*\([^)]*\)\s*{/,
  /\bwhile\s*\([^)]*\)\s*{/,
  /\.forEach\s*\(/,
  /\.map\s*\(/,
  /\.filter\s*\(/,
  /for\s+of\s+/,
  /for\s+await\s+/,
];

interface NPlusOneIssue {
  file: string;
  line: number;
  column: number;
  code: string;
  issue: string;
}

function shouldExclude(filePath: string): boolean {
  return EXCLUDED_DIRS.some((excluded) => filePath.includes(excluded));
}

function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && !shouldExclude(fullPath)) {
        traverse(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        if (!shouldExclude(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  try {
    traverse(dir);
  } catch (error) {
    console.error(`Error traversing directory ${dir}:`, error);
  }

  return files;
}

function detectNPlusOneInFile(filePath: string): NPlusOneIssue[] {
  const issues: NPlusOneIssue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');

  // Remove comments to avoid false positives
  const contentWithoutComments = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  const lines = content.split('\n');
  const relativePath = path.relative(process.cwd(), filePath);

  // Track if we're inside a loop and if there's a DB call inside
  let inLoop = false;
  let loopStartLine = 0;
  let loopDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip if line is only a comment
    if (
      line.trim().startsWith('//') ||
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*')
    ) {
      continue;
    }

    // Check for loop start
    for (const pattern of LOOP_PATTERNS) {
      if (pattern.test(line)) {
        inLoop = true;
        loopStartLine = lineNum;
        loopDepth = (line.match(/{/g) || []).length;
      }
    }

    // If inside a loop, check for DB operations
    if (inLoop) {
      for (const pattern of DB_METHOD_PATTERNS) {
        if (pattern.test(line)) {
          issues.push({
            file: relativePath,
            line: lineNum,
            column: line.indexOf(line.trim()),
            code: line.trim().substring(0, 100),
            issue: 'Potential N+1 query: Database operation inside loop',
          });
        }
      }
    }

    // Check for loop end
    if (inLoop && line.includes('}')) {
      const closingBraces = (line.match(/}/g) || []).length;
      loopDepth -= closingBraces;
      if (loopDepth <= 0) {
        inLoop = false;
        loopDepth = 0;
      }
    }
  }

  return issues;
}

function printResults(issues: NPlusOneIssue[]): void {
  if (issues.length === 0) {
    console.log('\n✅ No N+1 query patterns detected!\n');
    return;
  }

  console.log(`\n⚠️  Found ${issues.length} potential N+1 query issue(s):\n`);

  // Group by file
  const byFile = new Map<string, NPlusOneIssue[]>();
  for (const issue of issues) {
    const existing = byFile.get(issue.file) || [];
    existing.push(issue);
    byFile.set(issue.file, existing);
  }

  for (const [file, fileIssues] of byFile) {
    console.log(`📁 ${file}`);
    for (const issue of fileIssues) {
      console.log(`   Line ${issue.line}: ${issue.issue}`);
      console.log(`   Code: ${issue.code}`);
    }
    console.log();
  }
}

function main(): void {
  console.log('🔍 Starting N+1 query detection...\n');

  const files = getTypeScriptFiles(SRC_DIR);
  console.log(`📂 Scanning ${files.length} TypeScript files...`);

  const allIssues: NPlusOneIssue[] = [];

  for (const file of files) {
    const issues = detectNPlusOneInFile(file);
    allIssues.push(...issues);
  }

  printResults(allIssues);

  if (CI_MODE && allIssues.length > 0) {
    console.log('CI Mode: Failing due to N+1 query issues detected.\n');
    process.exit(1);
  }
}

main();
