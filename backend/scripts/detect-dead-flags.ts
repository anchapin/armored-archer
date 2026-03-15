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
 */
async function findFlagDefinitions(): Promise<FlagDefinition[]> {
  const flags: FlagDefinition[] = [];
  
  // Patterns to find feature flag definitions
  const definitionPatterns = [
    /name:\s*['"]([a-zA-Z0-9_]+)['"]/g,  // FeatureFlags.name
    /['"]([a-zA-Z0-9_]+)['"]:\s*\{[^}]*enabled/g, // enabled flags
    /feature.*flag.*['"]([a-zA-Z0-9_]+)['"]/gi,
  ];

  // Use absolute path to backend directory
  const backendDir = path.resolve(__dirname, '..');
  
  // Find TypeScript/JavaScript files
  const files = glob.sync('src/**/*.ts', { cwd: backendDir });
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(backendDir, file), 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip metric definitions (Prometheus metrics start with armored_archer_)
      if (line.includes("name: 'armored_archer_") || line.includes('name: "armored_archer_')) {
        continue;
      }
      
      // Skip gear rarity types and test-specific names
      if (line.includes("name: 'Common'") || line.includes("name: 'Rare'") || 
          line.includes("name: 'Legendary'") || line.includes("name: 'Fortification'") ||
          line.includes("name: 'invalid_stat'") || line.includes("name: 'player1")) {
        continue;
      }
      
      // Check for isFeatureEnabled calls (usage)
      const usageMatch = line.match(/isFeatureEnabled\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g);
      
      // Check for getFeatureVariant calls (usage)
      const variantMatch = line.match(/getFeatureVariant\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g);
      
      // Check for flag definitions (in DEFAULT_FLAGS or similar)
      if (line.includes("name: '") || line.includes('name: "')) {
        const match = line.match(/name:\s*['"]([a-zA-Z0-9_]+)['"]/);
        if (match) {
          flags.push({
            name: match[1],
            file: file,
            line: i + 1
          });
        }
      }
    }
  }
  
  return flags;
}

/**
 * Count usage of each flag in the codebase
 */
async function countFlagUsage(flagName: string): Promise<number> {
  let count = 0;
  
  const backendDir = path.resolve(__dirname, '..');
  const files = glob.sync('src/**/*.ts', { cwd: backendDir });
  
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
    
    // Count occurrences in flag definitions (not usage)
    if (!content.includes("name:") || !file.includes('feature-flags')) {
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
      isUsed
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
  const deadFlags = results.filter(r => !r.isUsed);
  
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
generateReport().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

export { findDeadFlags, generateReport };
