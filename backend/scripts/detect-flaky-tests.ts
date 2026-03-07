#!/usr/bin/env npx ts-node
/**
 * Flaky Test Detection Script
 * 
 * This script runs tests multiple times to identify non-deterministic failures.
 * It tracks flaky test history and generates reports.
 * 
 * Usage:
 *   npx ts-node scripts/detect-flaky-tests.ts [--runs=N] [--threshold=N] [--test-pattern=PATTERN]
 * 
 * Options:
 *   --runs=N          Number of times to run each test (default: 3)
 *   --threshold=N     Minimum failure rate to consider a test flaky (default: 0.33)
 *   --test-pattern    Regex pattern to filter which tests to analyze
 *   --verbose         Show detailed output
 *   --ci-mode        Output in CI-friendly format
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface FlakyTestResult {
  testName: string;
  runs: number;
  failures: number;
  failureRate: number;
  history: FlakyTestRun[];
}

interface FlakyTestRun {
  timestamp: string;
  success: boolean;
  duration: number;
  error?: string;
}

interface DetectionResult {
  flakyTests: FlakyTestResult[];
  summary: {
    totalTests: number;
    flakyTests: number;
    runsPerTest: number;
    threshold: number;
    executionTime: number;
  };
}

// Configuration
const DEFAULT_RUNS = 3;
const DEFAULT_THRESHOLD = 0.33;
const HISTORY_FILE = 'data/flaky-test-history.json';

class FlakyTestDetector {
  private runs: number;
  private threshold: number;
  private testPattern: RegExp | null = null;
  private verbose: boolean = false;
  private ciMode: boolean = false;
  private results: Map<string, FlakyTestResult> = new Map();
  private startTime: number = 0;

  constructor(args: string[]) {
    this.runs = this.parseIntArg(args, 'runs', DEFAULT_RUNS);
    this.threshold = this.parseFloatArg(args, 'threshold', DEFAULT_THRESHOLD);
    this.verbose = args.includes('--verbose') || args.includes('-v');
    this.ciMode = args.includes('--ci-mode');
    
    const patternArg = args.find(arg => arg.startsWith('--test-pattern='));
    if (patternArg) {
      const pattern = patternArg.split('=')[1];
      this.testPattern = new RegExp(pattern);
    }
  }

  private parseIntArg(args: string[], name: string, defaultValue: number): number {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    if (arg) {
      const value = parseInt(arg.split('=')[1], 10);
      return isNaN(value) ? defaultValue : value;
    }
    return defaultValue;
  }

  private parseFloatArg(args: string[], name: string, defaultValue: number): number {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    if (arg) {
      const value = parseFloat(arg.split('=')[1]);
      return isNaN(value) ? defaultValue : value;
    }
    return defaultValue;
  }

  /**
   * Get the list of test files to analyze
   */
  private getTestFiles(): string[] {
    const testDir = path.join(__dirname, '../src');
    const testFiles: string[] = [];

    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.match(/\.(spec|test)\.ts$/)) {
          testFiles.push(fullPath);
        }
      }
    };

    try {
      walkDir(testDir);
    } catch (error) {
      console.error(`Error reading test directory: ${error}`);
    }

    return testFiles;
  }

  /**
   * Extract test names from a test file
   */
  private getTestNamesFromFile(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const testNames: string[] = [];

    // Match Jest test()/it()/describe() patterns
    const testRegex = /(?:test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = testRegex.exec(content)) !== null) {
      const testName = match[1];
      if (!this.testPattern || this.testPattern.test(testName)) {
        testNames.push(testName);
      }
    }

    return testNames;
  }

  /**
   * Run a specific test and capture the result
   */
  private async runTest(testName: string): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Run Jest with the specific test name filter
      const escapedTestName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cmd = `npx jest --testNamePattern="${escapedTestName}" --no-coverage --passWithNoTests 2>&1`;
      
      execSync(cmd, { 
        cwd: path.join(__dirname, '..'),
        stdio: this.verbose ? 'inherit' : 'pipe',
        encoding: 'utf-8',
        timeout: 60000 // 60 second timeout
      });

      return {
        success: true,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message?.substring(0, 500) || 'Unknown error'
      };
    }
  }

  /**
   * Run all tests and collect results for flaky detection
   */
  async detectFlakyTests(): Promise<DetectionResult> {
    this.startTime = Date.now();
    console.log(`🔍 Starting flaky test detection...`);
    console.log(`   Runs per test: ${this.runs}`);
    console.log(`   Flaky threshold: ${(this.threshold * 100).toFixed(0)}%`);
    console.log('');

    // Get all test files
    const testFiles = this.getTestFiles();
    console.log(`📁 Found ${testFiles.length} test files`);

    // Collect all test names
    const allTestNames = new Set<string>();
    for (const file of testFiles) {
      const testNames = this.getTestNamesFromFile(file);
      testNames.forEach(name => allTestNames.add(name));
    }

    console.log(`📝 Found ${allTestNames.size} tests to analyze\n`);

    // If we have a test pattern filter, only run matching tests
    const testsToRun = this.testPattern 
      ? Array.from(allTestNames).filter(name => this.testPattern!.test(name))
      : Array.from(allTestNames);

    // Run each test multiple times
    for (const testName of testsToRun) {
      if (this.verbose) {
        console.log(`\n🔬 Testing: ${testName}`);
      }

      const history: FlakyTestRun[] = [];
      for (let i = 0; i < this.runs; i++) {
        if (this.verbose) {
          console.log(`   Run ${i + 1}/${this.runs}...`);
        }

        const result = await this.runTest(testName);
        history.push({
          timestamp: new Date().toISOString(),
          success: result.success,
          duration: result.duration,
          error: result.error
        });

        if (this.verbose) {
          console.log(`   Result: ${result.success ? '✅ PASS' : '❌ FAIL'} (${result.duration}ms)`);
        }
      }

      // Calculate failure rate
      const failures = history.filter(h => !h.success).length;
      const failureRate = failures / this.runs;

      // Only store if there were any failures or if test pattern is specified
      if (failures > 0 || this.testPattern) {
        this.results.set(testName, {
          testName,
          runs: this.runs,
          failures,
          failureRate,
          history
        });
      }
    }

    // Identify flaky tests
    const flakyTests = Array.from(this.results.values())
      .filter(result => result.failureRate >= this.threshold)
      .sort((a, b) => b.failureRate - a.failureRate);

    const executionTime = Date.now() - this.startTime;

    // Save history
    this.saveHistory(flakyTests);

    return {
      flakyTests,
      summary: {
        totalTests: testsToRun.length,
        flakyTests: flakyTests.length,
        runsPerTest: this.runs,
        threshold: this.threshold,
        executionTime
      }
    };
  }

  /**
   * Save flaky test history to file
   */
  private saveHistory(flakyTests: FlakyTestResult[]): void {
    const dataDir = path.join(__dirname, '..', 'data');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const historyPath = path.join(dataDir, HISTORY_FILE.replace('data/', ''));
    
    let existingHistory: Record<string, FlakyTestResult> = {};
    
    if (fs.existsSync(historyPath)) {
      try {
        existingHistory = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      } catch {
        existingHistory = {};
      }
    }

    // Update history with new results
    for (const result of flakyTests) {
      if (!existingHistory[result.testName]) {
        existingHistory[result.testName] = result;
      } else {
        // Merge history
        const existing = existingHistory[result.testName];
        existing.history = [...existing.history, ...result.history];
        // Keep last 30 runs
        existing.history = existing.history.slice(-30);
        existing.failures = existing.history.filter(h => !h.success).length;
        existing.runs = existing.history.length;
        existing.failureRate = existing.failures / existing.runs;
      }
    }

    fs.writeFileSync(historyPath, JSON.stringify(existingHistory, null, 2));
  }

  /**
   * Print the results in a human-readable format
   */
  printResults(result: DetectionResult): void {
    const { flakyTests, summary } = result;

    if (this.ciMode) {
      this.printCiFormat(result);
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 FLAKY TEST DETECTION RESULTS');
    console.log('='.repeat(60));

    console.log(`\n📈 Summary:`);
    console.log(`   Total tests analyzed: ${summary.totalTests}`);
    console.log(`   Flaky tests found: ${summary.flakyTests}`);
    console.log(`   Runs per test: ${summary.runsPerTest}`);
    console.log(`   Flaky threshold: ${(summary.threshold * 100).toFixed(0)}%`);
    console.log(`   Total execution time: ${(summary.executionTime / 1000).toFixed(1)}s`);

    if (flakyTests.length === 0) {
      console.log('\n✅ No flaky tests detected!');
      return;
    }

    console.log('\n⚠️  FLAKY TESTS DETECTED:');
    console.log('-'.repeat(60));

    for (const test of flakyTests) {
      const status = test.failureRate >= 0.5 ? '🔴' : test.failureRate >= 0.33 ? '🟡' : '🟢';
      console.log(`\n${status} ${test.testName}`);
      console.log(`   Failure rate: ${(test.failureRate * 100).toFixed(0)}% (${test.failures}/${test.runs} runs)`);
      
      if (test.history.length > 0) {
        const recentFailures = test.history.slice(-5).filter(h => !h.success).length;
        console.log(`   Recent failures: ${recentFailures}/5`);
      }

      if (this.verbose && test.history.length > 0) {
        console.log('   Run history:');
        for (const run of test.history.slice(-10)) {
          const icon = run.success ? '✅' : '❌';
          const time = new Date(run.timestamp).toLocaleTimeString();
          console.log(`     ${icon} ${time} (${run.duration}ms)`);
        }
      }
    }

    console.log('\n' + '-'.repeat(60));
    console.log('\n💡 Recommendations:');
    console.log('   1. Review the flaky tests and identify the cause of non-determinism');
    console.log('   2. Consider adding retry logic or mocking for timing-dependent code');
    console.log('   3. Check for shared mutable state between tests');
    console.log('   4. Look for race conditions or async issues');
    console.log('');
  }

  /**
   * Print results in CI-friendly format
   */
  private printCiFormat(result: DetectionResult): void {
    const { flakyTests, summary } = result;

    console.log(`FLAKY_TEST_DETECTION_START`);
    console.log(`total_tests=${summary.totalTests}`);
    console.log(`flaky_tests=${summary.flakyTests}`);
    console.log(`runs_per_test=${summary.runsPerTest}`);
    console.log(`flaky_threshold=${summary.threshold}`);
    console.log(`execution_time_ms=${summary.executionTime}`);

    if (flakyTests.length > 0) {
      console.log('flaky_tests=' + flakyTests.map(t => t.testName.replace(/ /g, '_')).join(','));
    } else {
      console.log('flaky_tests=');
    }

    console.log(`FLAKY_TEST_DETECTION_END`);

    // Exit with error if flaky tests found
    if (flakyTests.length > 0) {
      console.error(`\n❌ Found ${flakyTests.length} flaky tests!`);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Flaky Test Detection Script

Usage:
  npx ts-node scripts/detect-flaky-tests.ts [options]

Options:
  --runs=N          Number of times to run each test (default: 3)
  --threshold=N    Minimum failure rate to consider a test flaky (default: 0.33)
  --test-pattern   Regex pattern to filter which tests to analyze
  --verbose        Show detailed output
  --ci-mode        Output in CI-friendly format
  --help, -h       Show this help message

Examples:
  npx ts-node scripts/detect-flaky-tests.ts
  npx ts-node scripts/detect-flaky-tests.ts --runs=5 --threshold=0.4
  npx ts-node scripts/detect-flaky-tests.ts --test-pattern="combat"
  npx ts-node scripts/detect-flaky-tests.ts --ci-mode
`);
    process.exit(0);
  }

  const detector = new FlakyTestDetector(args);
  const result = await detector.detectFlakyTests();
  detector.printResults(result);
}

main().catch(console.error);
