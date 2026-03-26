#!/usr/bin/env npx ts-node
/**
 * Flaky Test Report Generator
 * 
 * Aggregates flaky test data from backend and Godot tests,
 * generates reports, and provides visualization of flaky test trends.
 * 
 * Usage:
 *   npx ts-node scripts/flaky-test-report.ts [--format=html|json|markdown]
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestRun {
  timestamp: string;
  success: boolean;
  duration: number;
  error?: string;
}

interface FlakyTestResult {
  testName: string;
  runs: number;
  failures: number;
  failureRate: number;
  history: TestRun[];
}

interface ReportData {
  backend: {
    flakyTests: FlakyTestResult[];
    lastUpdated: string;
  };
  godot: {
    flakyTests: FlakyTestResult[];
    lastUpdated: string;
  };
  generatedAt: string;
}

const BACKEND_HISTORY_FILE = path.join(__dirname, '../backend/data/flaky-test-history.json');
const GODOT_HISTORY_FILE = path.join(__dirname, '../data/godot-flaky-test-history.json');
const REPORT_OUTPUT_FILE = path.join(__dirname, '../docs/flaky-tests-report.md');

class FlakyTestReport {
  /**
   * Load flaky test history from a file
   */
  private loadHistory(filePath: string): FlakyTestResult[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Handle both array and object formats
      if (Array.isArray(parsed)) {
        return parsed;
      }
      
      // If it's an object with test names as keys
      return Object.values(parsed) as FlakyTestResult[];
    } catch (error) {
      console.error(`Error loading history from ${filePath}:`, error);
      return [];
    }
  }
  
  /**
   * Generate the combined report data
   */
  generateReportData(): ReportData {
    const backendTests = this.loadHistory(BACKEND_HISTORY_FILE);
    const godotTests = this.loadHistory(GODOT_HISTORY_FILE);
    
    return {
      backend: {
        flakyTests: backendTests.filter(t => t.failureRate > 0),
        lastUpdated: this.getLastUpdated(BACKEND_HISTORY_FILE)
      },
      godot: {
        flakyTests: godotTests.filter(t => t.failureRate > 0),
        lastUpdated: this.getLastUpdated(GODOT_HISTORY_FILE)
      },
      generatedAt: new Date().toISOString()
    };
  }
  
  /**
   * Get last modified time of a file
   */
  private getLastUpdated(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      return 'Never';
    }
    
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString();
  }
  
  /**
   * Generate markdown report
   */
  generateMarkdownReport(data: ReportData): string {
    const lines: string[] = [];
    
    lines.push('# Flaky Test Report');
    lines.push('');
    lines.push(`Generated: ${new Date(data.generatedAt).toLocaleString()}`);
    lines.push('');
    
    // Summary
    const totalBackend = data.backend.flakyTests.length;
    const totalGodot = data.godot.flakyTests.length;
    const totalFlaky = totalBackend + totalGodot;
    
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Category | Flaky Tests |`);
    lines.push(`|----------|-------------|`);
    lines.push(`| Backend (TypeScript/Jest) | ${totalBackend} |`);
    lines.push(`| Godot (GDScript) | ${totalGodot} |`);
    lines.push(`| **Total** | **${totalFlaky}** |`);
    lines.push('');
    
    // Backend flaky tests
    lines.push('## Backend Flaky Tests (TypeScript/Jest)');
    lines.push('');
    
    if (data.backend.flakyTests.length === 0) {
      lines.push('No flaky tests detected in backend.');
    } else {
      lines.push('| Test Name | Failure Rate | Runs | Failures |');
      lines.push(`|-----------|--------------|------|----------|`);
      
      for (const test of data.backend.flakyTests) {
        const rate = (test.failureRate * 100).toFixed(0);
        lines.push(`| ${test.testName} | ${rate}% | ${test.runs} | ${test.failures} |`);
      }
    }
    
    lines.push('');
    lines.push(`_Last updated: ${data.backend.lastUpdated}_`);
    lines.push('');
    
    // Godot flaky tests
    lines.push('## Godot Flaky Tests (GDScript)');
    lines.push('');
    
    if (data.godot.flakyTests.length === 0) {
      lines.push('No flaky tests detected in Godot.');
    } else {
      lines.push('| Test Name | Failure Rate | Runs | Failures |');
      lines.push(`|-----------|--------------|------|----------|`);
      
      for (const test of data.godot.flakyTests) {
        const rate = (test.failureRate * 100).toFixed(0);
        lines.push(`| ${test.testName} | ${rate}% | ${test.runs} | ${test.failures} |`);
      }
    }
    
    lines.push('');
    lines.push(`_Last updated: ${data.godot.lastUpdated}_`);
    lines.push('');
    
    // Recommendations
    lines.push('## Recommendations');
    lines.push('');
    lines.push('If flaky tests are detected:');
    lines.push('');
    lines.push('1. **Identify the root cause**: Review test logs and error messages');
    lines.push('2. **Check for timing issues**: Look for race conditions, async issues');
    lines.push('3. **Review test isolation**: Ensure tests don\'t share mutable state');
    lines.push('4. **Add retry logic**: Consider adding automatic retries for known flaky tests');
    lines.push('5. **Fix or mark as known flaky**: Either fix the test or document the flakiness');
    lines.push('');
    
    // How to run detection
    lines.push('## Running Flaky Test Detection');
    lines.push('');
    lines.push('### Backend Tests');
    lines.push('```bash');
    lines.push('cd backend');
    lines.push('npm run test:flaky');
    lines.push('```');
    lines.push('');
    lines.push('### Godot Tests');
    lines.push('```bash');
    lines.push('python3 scripts/detect_godot_flaky_tests.py');
    lines.push('```');
    lines.push('');
    
    return lines.join('\n');
  }
  
  /**
   * Generate JSON report
   */
  generateJsonReport(data: ReportData): string {
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Generate HTML report
   */
  generateHtmlReport(data: ReportData): string {
    const totalBackend = data.backend.flakyTests.length;
    const totalGodot = data.godot.flakyTests.length;
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flaky Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; }
    h2 { color: #555; margin-top: 30px; }
    .summary {
      display: flex;
      gap: 20px;
      margin: 20px 0;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h3 { margin-top: 0; }
    .count {
      font-size: 48px;
      font-weight: bold;
      color: #2196F3;
    }
    .count.warning { color: #ff9800; }
    .count.error { color: #f44336; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th { background: #f5f5f5; font-weight: 600; }
    .rate-low { color: #4caf50; }
    .rate-medium { color: #ff9800; }
    .rate-high { color: #f44336; }
    .timestamp { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <h1>🧪 Flaky Test Report</h1>
  <p class="timestamp">Generated: ${new Date(data.generatedAt).toLocaleString()}</p>
  
  <div class="summary">
    <div class="card">
      <h3>Backend (Jest)</h3>
      <div class="count ${totalBackend > 0 ? 'warning' : ''}">${totalBackend}</div>
      <p>Flaky tests</p>
    </div>
    <div class="card">
      <h3>Godot (GDScript)</h3>
      <div class="count ${totalGodot > 0 ? 'warning' : ''}">${totalGodot}</div>
      <p>Flaky tests</p>
    </div>
  </div>
  
  <h2>Backend Flaky Tests</h2>
  ${this.renderTestTable(data.backend.flakyTests)}
  
  <h2>Godot Flaky Tests</h2>
  ${this.renderTestTable(data.godot.flakyTests)}
  
  <h2>Running Detection</h2>
  <pre>cd backend && npm run test:flaky</pre>
  <pre>python3 scripts/detect_godot_flaky_tests.py</pre>
</body>
</html>
`;
    return html;
  }
  
  /**
   * Render test table HTML
   */
  private renderTestTable(tests: FlakyTestResult[]): string {
    if (tests.length === 0) {
      return '<p>No flaky tests detected.</p>';
    }
    
    let html = '<table><thead><tr><th>Test Name</th><th>Failure Rate</th><th>Runs</th><th>Failures</th></tr></thead><tbody>';
    
    for (const test of tests) {
      const rate = test.failureRate * 100;
      const rateClass = rate >= 50 ? 'rate-high' : rate >= 30 ? 'rate-medium' : 'rate-low';
      
      html += `
        <tr>
          <td>${test.testName}</td>
          <td class="${rateClass}">${rate.toFixed(0)}%</td>
          <td>${test.runs}</td>
          <td>${test.failures}</td>
        </tr>
      `;
    }
    
    html += '</tbody></table>';
    return html;
  }
  
  /**
   * Run the report generator
   */
  async run(format: string = 'markdown'): Promise<void> {
    console.log('📊 Generating flaky test report...');
    
    const data = this.generateReportData();
    
    switch (format) {
      case 'json':
        console.log(this.generateJsonReport(data));
        break;
        
      case 'html':
        console.log('Generating HTML report...');
        const html = this.generateHtmlReport(data);
        const htmlFile = path.join(__dirname, '../docs/flaky-tests-report.html');
        fs.writeFileSync(htmlFile, html);
        console.log(`HTML report saved to: ${htmlFile}`);
        break;
        
      case 'markdown':
      default:
        const markdown = this.generateMarkdownReport(data);
        fs.writeFileSync(REPORT_OUTPUT_FILE, markdown);
        console.log(`Markdown report saved to: ${REPORT_OUTPUT_FILE}`);
        console.log(markdown);
        break;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const formatArg = args.find(arg => arg.startsWith('--format='));
  const format = formatArg ? formatArg.split('=')[1] : 'markdown';
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Flaky Test Report Generator

Usage:
  npx ts-node scripts/flaky-test-report.ts [options]

Options:
  --format=FORMAT   Output format: markdown, html, json (default: markdown)
  --help, -h        Show this help message

Examples:
  npx ts-node scripts/flaky-test-report.ts
  npx ts-node scripts/flaky-test-report.ts --format=html
  npx ts-node scripts/flaky-test-report.ts --format=json
`);
    process.exit(0);
  }
  
  const reporter = new FlakyTestReport();
  await reporter.run(format);
}

main().catch(console.error);
