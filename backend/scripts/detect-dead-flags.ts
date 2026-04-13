/**
 * Dead Feature Flag Detection Script
 *
 * Scans the codebase to detect unused or dead feature flags.
 * Analyzes feature flag definitions and checks for usage in source code.
 *
 * Usage:
 *   npm run detect-dead-flags
 *   npm run detect-dead-flags:ci
 *
 * Exit codes:
 *   0 - No dead flags found or within threshold
 *   1 - Dead flags found exceeding threshold
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface FlagDefinition {
  name: string;
  file: string;
  line: number;
}

interface DeadFlagResult {
  flagName: string;
  definedIn: string;
  line: number;
  usageCount: number;
  isUsed: boolean;
}

const CI_MODE = process.argv.includes('--ci-mode');
const MIN_DEFINITION_LENGTH = 3; // Minimum characters for flag name
const THRESHOLD = CI_MODE ? 0 : 3; // Max unused flags before failure in CI

/**
 * Find all feature flag definitions in the codebase
 * Only looks in production code, not tests
 */
async function findFlagDefinitions(): Promise<FlagDefinition[]> {
  const flags: FlagDefinition[] = [];

  // Use absolute path to backend directory
  const backendDir = path.resolve(__dirname, '..');

  // Find TypeScript/JavaScript files, excluding tests
  const files = glob
    .sync('src/**/*.ts', { cwd: backendDir })
    .filter((f) => !f.includes('__tests__') && !f.includes('.test.') && !f.includes('.spec.'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(backendDir, file), 'utf-8');
    const lines = content.split('\n');

    // Skip files that are primarily metrics definitions
    if (
      file.includes('metrics.ts') ||
      file.includes('health_monitor.ts') ||
      file.includes('deployment_observability.ts') ||
      file.includes('n_plus_one_detection.ts') ||
      file.includes('progressive_rollout.ts')
    ) {
      // Still check for actual feature flag usage patterns
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for flag definitions in DEFAULT_FLAGS or feature flags config
        if (
          (line.includes("name: '") || line.includes('name: "')) &&
          (line.includes('enabled:') ||
            file.includes('feature-flags') ||
            file.includes('FeatureFlags'))
        ) {
          const match = line.match(/name:\s*['"]([a-zA-Z0-9_-]+)['"]/);
          if (match && match[1].length >= MIN_DEFINITION_LENGTH) {
            flags.push({
              name: match[1],
              file: file,
              line: i + 1,
            });
          }
        }
      }
      continue;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for flag definitions (in DEFAULT_FLAGS or similar)
      // Only match if it looks like a feature flag definition
      if (
        (line.includes("name: '") || line.includes('name: "')) &&
        (file.includes('feature-flags') || file.includes('FeatureFlags') || file.includes('flags:'))
      ) {
        const match = line.match(/name:\s*['"]([a-zA-Z0-9_-]+)['"]/);
        if (match && match[1].length >= MIN_DEFINITION_LENGTH) {
          flags.push({
            name: match[1],
            file: file,
            line: i + 1,
          });
        }
      }
    }
  }

  return flags;
}

/**
 * Count usage of each flag in the codebase
 * Only counts production code usage, not test code
 */
async function countFlagUsage(flagName: string): Promise<number> {
  let count = 0;

  const backendDir = path.resolve(__dirname, '..');
  // Exclude test files from usage counting
  const files = glob
    .sync('src/**/*.ts', { cwd: backendDir })
    .filter((f) => !f.includes('__tests__') && !f.includes('.test.') && !f.includes('.spec.'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(backendDir, file), 'utf-8');

    // Count occurrences of isFeatureEnabled(flagName)
    const isEnabledRegex = new RegExp(`isFeatureEnabled\\s*\\(\\s*['"]${flagName}['"]`, 'g');
    const isEnabledMatches = content.match(isEnabledRegex);
    if (isEnabledMatches) count += isEnabledMatches.length;

    // Count occurrences of getFeatureVariant(flagName)
    const variantRegex = new RegExp(`getFeatureVariant\\s*\\(\\s*['"]${flagName}['"]`, 'g');
    const variantMatches = content.match(variantRegex);
    if (variantMatches) count += variantMatches.length;

    // Count direct flag name references (only in feature flag definition files)
    if (file.includes('feature-flags') || file.includes('FeatureFlags')) {
      const nameRefRegex = new RegExp(`['"]${flagName}['"]`, 'g');
      const nameRefs = content.match(nameRefRegex);
      if (nameRefs) count += nameRefs.length;
    }
  }

  return count;
}

/**
 * Find dead/unused feature flags
 */
async function findDeadFlags(): Promise<DeadFlagResult[]> {
  const definitions = await findFlagDefinitions();
  const results: DeadFlagResult[] = [];

  console.log(`\n🔍 Found ${definitions.length} feature flag definitions\n`);

  for (const flag of definitions) {
    const usageCount = await countFlagUsage(flag.name);
    const isUsed = usageCount > 1; // More than 1 because definition counts as 1

    results.push({
      flagName: flag.name,
      definedIn: flag.file,
      line: flag.line,
      usageCount,
      isUsed,
    });

    if (!isUsed) {
      console.log(`  ⚠️  Dead flag: ${flag.name} (used ${usageCount} times)`);
    }
  }

  return results;
}

/**
 * Generate the dead flag report
 */
async function generateReport(): Promise<void> {
  console.log('=== Dead Feature Flag Detection ===\n');

  const results = await findDeadFlags();
  const deadFlags = results.filter((r) => !r.isUsed);

  console.log('\n📊 Summary:');
  console.log(`   Total flags: ${results.length}`);
  console.log(`   Active flags: ${results.length - deadFlags.length}`);
  console.log(`   Dead flags: ${deadFlags.length}`);

  if (deadFlags.length > 0) {
    console.log('\n⚠️  Dead Feature Flags:');
    for (const flag of deadFlags) {
      console.log(`   - ${flag.flagName}`);
      console.log(`     Defined in: ${flag.definedIn}:${flag.line}`);
    }
  }

  const CI_MODE = process.argv.includes('--ci-mode');

  // Check threshold
  if (deadFlags.length > THRESHOLD) {
    console.log(`\n❌ FAIL: Found ${deadFlags.length} dead flags (threshold: ${THRESHOLD})`);
    if (!CI_MODE) {
      console.log('   Run with --ci-mode to exit with error code');
    }
    process.exit(1);
  }

  console.log(`\n✅ PASS: Found ${deadFlags.length} dead flags (threshold: ${THRESHOLD})`);
  console.log('PASS'); // For script detection
  process.exit(0);
}

// Run if called directly
generateReport().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

export { findDeadFlags, generateReport };
