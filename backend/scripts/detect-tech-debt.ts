#!/usr/bin/env npx ts-node
/**
 * Tech Debt Detection Script
 *
 * This script detects technical debt in the codebase including:
 * - Deprecated API usage (@deprecated markers)
 * - TODO/FIXME/HACK comments that indicate incomplete work
 * - Code quality issues
 * - Missing error handling
 *
 * Usage:
 *   npx ts-node scripts/detect-tech-debt.ts [--ci-mode]
 *
 * Options:
 *   --ci-mode    Output in CI-friendly format (exit with error if issues found)
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const BACKEND_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(BACKEND_DIR, 'src');
const EXCLUDED_DIRS = ['node_modules', 'build', '.git', 'dist', '__mocks__', '__tests__'];
const CI_MODE = process.argv.includes('--ci-mode');

// Tech debt patterns to detect
const DEPRECATED_PATTERNS = [
  {
    // @deprecated JSDoc tag
    pattern: /@deprecated/,
    type: 'deprecated',
    severity: 'medium',
    description: 'Deprecated API usage detected'
  },
  {
    // Deprecated function calls in code
    pattern: /(captureExceptionLegacy|captureMessageLegacy|logRpcErrorLegacy)\s*\(/,
    type: 'deprecated',
    severity: 'medium',
    description: 'Using deprecated function'
  },
  {
    // console.log warnings that should be replaced
    pattern: /console\.(log|warn|error)\s*\(/,
    type: 'logging',
    severity: 'low',
    description: 'Console logging should use proper logger'
  },
  {
    // TODO comments
    pattern: /\/\/\s*TODO/,
    type: 'todo',
    severity: 'low',
    description: 'TODO comment found - work incomplete'
  },
  {
    // FIXME comments
    pattern: /\/\/\s*FIXME/,
    type: 'fixme',
    severity: 'medium',
    description: 'FIXME comment found - bug needs fixing'
  },
  {
    // HACK comments
    pattern: /\/\/\s*HACK/,
    type: 'hack',
    severity: 'medium',
    description: 'HACK comment found - workaround in code'
  },
  {
    // XXX comments
    pattern: /\/\/\s*XXX/,
    type: 'xxx',
    severity: 'low',
    description: 'XXX comment found - needs attention'
  },
  {
    // Any() type usage - type safety issue
    pattern: /\b:\s*any\b/,
    type: 'type-safety',
    severity: 'low',
    description: 'Using any type - reduces type safety'
  },
  {
    // @ts-ignore or @ts-expect-error - type errors being suppressed
    pattern: /\/\/\s*@ts-(ignore|expect-error)/,
    type: 'type-suppression',
    severity: 'low',
    description: 'TypeScript error being suppressed'
  },
  {
    // Empty catch block - error swallowing
    pattern: /catch\s*\([^)]*\)\s*{\s*}/,
    type: 'error-handling',
    severity: 'high',
    description: 'Empty catch block - errors are being swallowed'
  },
  {
    // TODO-FIXME: combined patterns in comments
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG):/i,
    type: 'marker',
    severity: 'low',
    description: 'Marker comment found'
  }
];

interface TechDebtIssue {
  file: string;
  line: number;
  column: number;
  code: string;
  type: string;
  severity: string;
  description: string;
}

function shouldExclude(filePath: string): boolean {
  return EXCLUDED_DIRS.some(excluded => filePath.includes(excluded));
}

function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    try {
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
    } catch (error) {
      // Skip directories we can't read
    }
  }

  traverse(dir);
  return files;
}

function detectTechDebtInFile(filePath: string): TechDebtIssue[] {
  const issues: TechDebtIssue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(BACKEND_DIR, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip test files for most checks (they can have todos)
    const isTestFile = relativePath.includes('__tests__') || relativePath.endsWith('.test.ts');

    for (const config of DEPRECATED_PATTERNS) {
      // Skip certain checks in test files
      if (isTestFile && ['todo', 'fixme', 'hack', 'xxx', 'marker'].includes(config.type)) {
        continue;
      }

      if (config.pattern.test(line)) {
        // For severity 'high', always report
        // For others, skip if it's just a minor issue in a test file
        issues.push({
          file: relativePath,
          line: lineNum,
          column: line.indexOf(line.trim()),
          code: line.trim().substring(0, 100),
          type: config.type,
          severity: config.severity,
          description: config.description
        });
      }
    }
  }

  return issues;
}

function categorizeIssues(issues: TechDebtIssue[]): Map<string, TechDebtIssue[]> {
  const categories = new Map<string, TechDebtIssue[]>();
  
  for (const issue of issues) {
    const existing = categories.get(issue.type) || [];
    existing.push(issue);
    categories.set(issue.type, existing);
  }
  
  return categories;
}

function countBySeverity(issues: TechDebtIssue[]): Record<string, number> {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  
  for (const issue of issues) {
    if (counts[issue.severity as keyof typeof counts] !== undefined) {
      counts[issue.severity as keyof typeof counts]++;
    }
  }
  
  return counts;
}

function printResults(issues: TechDebtIssue[]): void {
  if (issues.length === 0) {
    console.log('\n✅ No technical debt detected!\n');
    return;
  }

  const severityCounts = countBySeverity(issues);
  console.log(`\n⚠️  Found ${issues.length} technical debt issue(s):`);
  console.log(`   Critical: ${severityCounts.critical}, High: ${severityCounts.high}, Medium: ${severityCounts.medium}, Low: ${severityCounts.low}\n`);

  // Group by type
  const categories = categorizeIssues(issues);

  const severityOrder = ['critical', 'high', 'medium', 'low'];
  
  for (const severity of severityOrder) {
    for (const [type, typeIssues] of categories) {
      const filtered = typeIssues.filter(i => i.severity === severity);
      if (filtered.length === 0) continue;
      
      const severityEmoji = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🟢';
      console.log(`${severityEmoji} ${severity.toUpperCase()} - ${type} (${filtered.length} issues)`);
      
      // Group by file
      const byFile = new Map<string, TechDebtIssue[]>();
      for (const issue of filtered) {
        const existing = byFile.get(issue.file) || [];
        existing.push(issue);
        byFile.set(issue.file, existing);
      }
      
      for (const [file, fileIssues] of byFile) {
        console.log(`  📁 ${file}`);
        for (const issue of fileIssues.slice(0, 3)) { // Limit to 3 per file
          console.log(`     Line ${issue.line}: ${issue.description}`);
          console.log(`     Code: ${issue.code}`);
        }
        if (fileIssues.length > 3) {
          console.log(`     ... and ${fileIssues.length - 3} more`);
        }
      }
      console.log();
    }
  }

  console.log('\n📝 To address these issues:');
  console.log('   - Review and update deprecated APIs');
  console.log('   - Complete TODO items or create issues for tracking');
  console.log('   - Fix or document HACK/FIXME workarounds');
  console.log('   - Replace console logging with proper logger');
  console.log('   - Add proper error handling instead of empty catch blocks');
}

function generateJSONReport(issues: TechDebtIssue[]): string {
  const severityCounts = countBySeverity(issues);
  const categories = categorizeIssues(issues);
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: issues.length,
      critical: severityCounts.critical,
      high: severityCounts.high,
      medium: severityCounts.medium,
      low: severityCounts.low,
      byCategory: Object.fromEntries(
        Array.from(categories.entries()).map(([type, items]) => [type, items.length])
      )
    },
    issues: issues.map(issue => ({
      file: issue.file,
      line: issue.line,
      type: issue.type,
      severity: issue.severity,
      description: issue.description,
      code: issue.code
    }))
  };
  
  return JSON.stringify(report, null, 2);
}

function main(): void {
  console.log('🔍 Starting technical debt detection...\n');

  const files = getTypeScriptFiles(SRC_DIR);
  console.log(`📂 Scanning ${files.length} TypeScript files...`);

  const allIssues: TechDebtIssue[] = [];

  for (const file of files) {
    const issues = detectTechDebtInFile(file);
    allIssues.push(...issues);
  }

  printResults(allIssues);

  // Generate JSON report
  const jsonReport = generateJSONReport(allIssues);
  
  // Save JSON report
  const reportPath = path.join(BACKEND_DIR, 'tech-debt-report.json');
  fs.writeFileSync(reportPath, jsonReport);
  console.log(`📊 JSON report saved to: ${reportPath}`);

  if (CI_MODE && allIssues.length > 0) {
    const severityCounts = countBySeverity(allIssues);
    // Fail on critical and high severity issues only
    if (severityCounts.critical > 0 || severityCounts.high > 0) {
      console.log('\n❌ CI Mode: Failing due to critical/high severity tech debt issues.\n');
      process.exit(1);
    } else {
      console.log('\n⚠️  CI Mode: Low/medium severity issues found but not failing build.\n');
    }
  }
}

main();
