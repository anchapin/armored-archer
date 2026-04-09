#!/usr/bin/env node

/**
 * Test Report Generator
 * Generates comprehensive test coverage and results reports
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(BACKEND_DIR, 'tests', 'integration');
const REPORTS_DIR = path.join(BACKEND_DIR, 'reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

interface TestSuite {
  name: string;
  file: string;
  description: string;
  testCount: number;
  categories: string[];
  endpoints: string[];
  status: 'complete' | 'partial' | 'missing';
}

interface CoverageReport {
  totalSuites: number;
  completedSuites: number;
  partialSuites: number;
  missingSuites: number;
  totalTests: number;
  coveragePercentage: number;
  suites: TestSuite[];
}

// Test suite definitions based on Phase 1.4 plan
const EXPECTED_SUITES: TestSuite[] = [
  {
    name: 'Authentication Tests',
    file: 'authentication.test.ts',
    description: 'User authentication, session management, token refresh, logout',
    testCount: 0,
    categories: ['auth', 'security', 'session'],
    endpoints: ['authenticateEmail', 'refreshSession', 'rpc'],
    status: 'missing',
  },
  {
    name: 'Player System Tests',
    file: 'rpg_system.test.ts',
    description: 'Player stats, XP gain, level progression, stat allocation',
    testCount: 0,
    categories: ['player', 'rpg', 'progression'],
    endpoints: ['gain_xp', 'allocate_stats', 'get_player_stats', 'get_player_rank'],
    status: 'missing',
  },
  {
    name: 'Combat System Tests',
    file: 'combat_system.test.ts',
    description: 'Combat actions, turn management, damage calculation, match completion',
    testCount: 0,
    categories: ['combat', 'pvp', 'match'],
    endpoints: ['submit_combat_action', 'get_match_state', 'create_match', 'accept_match'],
    status: 'missing',
  },
  {
    name: 'Gear & Inventory Tests',
    file: 'gear_system.test.ts',
    description: 'Gear generation, inventory management, equip/unequip, modifiers',
    testCount: 0,
    categories: ['gear', 'inventory', 'equipment'],
    endpoints: [
      'generate_gear',
      'get_inventory',
      'equip_gear',
      'unequip_gear',
      'unlock_modifier_pool',
    ],
    status: 'missing',
  },
  {
    name: 'Matchmaking Tests',
    file: 'matchmaker.test.ts',
    description: 'Match creation, acceptance, listing, player ranking',
    testCount: 0,
    categories: ['matchmaking', 'pvp', 'ranking'],
    endpoints: ['create_match', 'accept_match', 'list_matches', 'get_player_rank'],
    status: 'missing',
  },
  {
    name: 'Season System Tests',
    file: 'season_system.test.ts',
    description: 'Season info, leaderboard, rewards, rank updates',
    testCount: 0,
    categories: ['season', 'leaderboard', 'rewards'],
    endpoints: [
      'get_season_info',
      'get_leaderboard',
      'update_rank',
      'get_season_rewards',
      'claim_season_rewards',
    ],
    status: 'missing',
  },
  {
    name: 'Store System Tests',
    file: 'store.test.ts',
    description: 'Currency management, purchase validation, gem spending',
    testCount: 0,
    categories: ['store', 'currency', 'iap'],
    endpoints: ['get_currency', 'validate_purchase', 'spend_gems'],
    status: 'missing',
  },
  {
    name: 'Performance Smoke Tests',
    file: 'performance_smoke.test.ts',
    description: 'Response times, concurrent users, sustained load',
    testCount: 0,
    categories: ['performance', 'load', 'smoke'],
    endpoints: ['all'],
    status: 'missing',
  },
  {
    name: 'Error Handling Tests',
    file: 'error_handling.test.ts',
    description: 'Validation errors, authentication errors, database errors, edge cases',
    testCount: 0,
    categories: ['errors', 'validation', 'security'],
    endpoints: ['all'],
    status: 'missing',
  },
  {
    name: 'Network Resilience Tests',
    file: 'network_resilience.test.ts',
    description: 'Connection handling, offline mode, reconnection, data consistency',
    testCount: 0,
    categories: ['network', 'resilience', 'offline'],
    endpoints: ['all'],
    status: 'missing',
  },
];

function countTestsInFile(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Count test() and it() calls
    const testMatches = content.match(/(test|it)\s*\(\s*['"`]/g);
    return testMatches ? testMatches.length : 0;
  } catch (error) {
    return 0;
  }
}

function checkSuiteStatus(suite: TestSuite): 'complete' | 'partial' | 'missing' {
  const filePath = path.join(TESTS_DIR, suite.file);

  if (!fs.existsSync(filePath)) {
    return 'missing';
  }

  const testCount = countTestsInFile(filePath);
  suite.testCount = testCount;

  // Consider complete if has reasonable number of tests
  if (testCount >= 10) {
    return 'complete';
  } else if (testCount > 0) {
    return 'partial';
  }

  return 'missing';
}

function generateCoverageReport(): CoverageReport {
  const suites = EXPECTED_SUITES.map((suite) => ({
    ...suite,
    status: checkSuiteStatus(suite),
  }));

  const completedSuites = suites.filter((s) => s.status === 'complete').length;
  const partialSuites = suites.filter((s) => s.status === 'partial').length;
  const missingSuites = suites.filter((s) => s.status === 'missing').length;
  const totalTests = suites.reduce((sum, s) => sum + s.testCount, 0);

  // Calculate coverage percentage (complete + 0.5 * partial)
  const coverageScore = completedSuites + partialSuites * 0.5;
  const coveragePercentage = (coverageScore / suites.length) * 100;

  return {
    totalSuites: suites.length,
    completedSuites,
    partialSuites,
    missingSuites,
    totalTests,
    coveragePercentage,
    suites,
  };
}

function generateMarkdownReport(report: CoverageReport): string {
  const date = new Date().toISOString().split('T')[0];

  let md = `# Test Coverage Report - Phase 1.4 Smoke Testing

**Generated:** ${new Date().toISOString()}
**Date:** ${date}

## Summary

| Metric | Value |
|--------|-------|
| Total Test Suites | ${report.totalSuites} |
| Completed Suites | ${report.completedSuites} |
| Partial Suites | ${report.partialSuites} |
| Missing Suites | ${report.missingSuites} |
| Total Tests | ${report.totalTests} |
| Coverage | ${report.coveragePercentage.toFixed(1)}% |

## Coverage Status

`;

  if (report.coveragePercentage >= 90) {
    md += `✅ **Excellent**: Test coverage is comprehensive\n\n`;
  } else if (report.coveragePercentage >= 70) {
    md += `⚠️ **Good**: Most areas covered, some gaps remain\n\n`;
  } else {
    md += `❌ **Needs Improvement**: Significant test coverage gaps\n\n`;
  }

  md += `## Test Suites Detail

| Suite Name | Status | Tests | Categories |
|------------|--------|-------|------------|
`;

  report.suites.forEach((suite) => {
    const statusIcon =
      suite.status === 'complete' ? '✅' : suite.status === 'partial' ? '⚠️' : '❌';
    md += `| ${suite.name} | ${statusIcon} ${suite.status} | ${suite.testCount} | ${suite.categories.join(', ')} |\n`;
  });

  md += `\n## Completed Suites

`;

  report.suites
    .filter((s) => s.status === 'complete')
    .forEach((suite) => {
      md += `### ${suite.name}

- **File**: \`${suite.file}\`
- **Tests**: ${suite.testCount}
- **Categories**: ${suite.categories.join(', ')}
- **Endpoints**: ${suite.endpoints.join(', ')}
- **Description**: ${suite.description}

`;
    });

  md += `## Partial Suites

`;

  const partial = report.suites.filter((s) => s.status === 'partial');
  if (partial.length === 0) {
    md += `None - all suites are either complete or missing\n\n`;
  } else {
    partial.forEach((suite) => {
      md += `### ${suite.name}

- **File**: \`${suite.file}\`
- **Tests**: ${suite.testCount}
- **Status**: Partial coverage
- **Recommendation**: Add more test cases for complete coverage

`;
    });
  }

  md += `## Missing Suites

`;

  const missing = report.suites.filter((s) => s.status === 'missing');
  if (missing.length === 0) {
    md += `None - all required test suites are implemented\n\n`;
  } else {
    missing.forEach((suite) => {
      md += `### ${suite.name}

- **File**: \`${suite.file}\`
- **Status**: ❌ Missing
- **Categories**: ${suite.categories.join(', ')}
- **Required Endpoints**: ${suite.endpoints.join(', ')}
- **Description**: ${suite.description}

`;
    });
  }

  md += `## Recommendations

`;

  if (missing.length > 0) {
    md += `1. **Create missing test suites**:\n`;
    missing.forEach((suite) => {
      md += `   - ${suite.name} (\`${suite.file}\`)\n`;
    });
    md += `\n`;
  }

  if (partial.length > 0) {
    md += `2. **Expand partial test suites**:\n`;
    partial.forEach((suite) => {
      md += `   - ${suite.name}: Add more test cases\n`;
    });
    md += `\n`;
  }

  if (report.coveragePercentage < 90) {
    md += `3. **Target**: Achieve 90%+ test coverage for Phase 1.4 completion\n\n`;
  }

  md += `## Next Steps

1. Review missing test suites and prioritize implementation
2. Expand partial suites with additional test cases
3. Run full smoke test suite: \`npm run test:integration\`
4. Generate test results: \`npm run test:integration -- --json\`
5. Review performance metrics against targets

---

*Report generated by test-coverage-report.ts*
`;

  return md;
}

function generateJsonReport(report: CoverageReport): string {
  return JSON.stringify(report, null, 2);
}

// Main execution
function main() {
  console.log('Generating Test Coverage Report...\n');

  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Generate report
  const report = generateCoverageReport();

  // Generate markdown report
  const mdReport = generateMarkdownReport(report);
  const mdPath = path.join(REPORTS_DIR, `test-coverage-${TIMESTAMP}.md`);
  fs.writeFileSync(mdPath, mdReport);
  console.log(`Markdown report saved to: ${mdPath}`);

  // Generate JSON report
  const jsonReport = generateJsonReport(report);
  const jsonPath = path.join(REPORTS_DIR, `test-coverage-${TIMESTAMP}.json`);
  fs.writeFileSync(jsonPath, jsonReport);
  console.log(`JSON report saved to: ${jsonPath}`);

  // Also save as latest
  fs.writeFileSync(path.join(REPORTS_DIR, 'test-coverage-latest.md'), mdReport);
  fs.writeFileSync(path.join(REPORTS_DIR, 'test-coverage-latest.json'), jsonReport);

  // Print summary
  console.log('\n=== Coverage Summary ===');
  console.log(`Total Suites: ${report.totalSuites}`);
  console.log(`Completed: ${report.completedSuites}`);
  console.log(`Partial: ${report.partialSuites}`);
  console.log(`Missing: ${report.missingSuites}`);
  console.log(`Total Tests: ${report.totalTests}`);
  console.log(`Coverage: ${report.coveragePercentage.toFixed(1)}%`);

  // Exit with appropriate code
  if (report.missingSuites > 0) {
    console.log('\n⚠️  Some test suites are missing!');
    process.exit(1);
  } else {
    console.log('\n✅ All test suites are present!');
    process.exit(0);
  }
}

main();
