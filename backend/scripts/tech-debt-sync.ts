#!/usr/bin/env npx ts-node
/**
 * Tech Debt Sync Script
 *
 * This script synchronizes detected tech debt items to TECH_DEBT.md by:
 * 1. Reading the existing tech-debt-report.json
 * 2. Comparing with previous reports to track changes
 * 3. Updating TECH_DEBT.md with new high-priority items
 * 4. Generating GitHub issue drafts for new items
 *
 * Usage:
 *   npx ts-node scripts/tech-debt-sync.ts [--dry-run] [--create-issues]
 *
 * Options:
 *   --dry-run       Show what would be updated without making changes
 *   --create-issues Generate GitHub issue drafts for new items
 *   --min-severity  Minimum severity to sync (critical, high, medium, low)
 */

import * as fs from 'fs';
import * as path from 'path';

interface TechDebtIssue {
  file: string;
  line: number;
  type: string;
  severity: string;
  description: string;
  code: string;
  details?: string;
  dateAdded?: string;
  age?: number;
}

interface TechDebtReport {
  timestamp: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<string, number>;
  };
  issues: TechDebtIssue[];
}

interface TechDebtItem {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  dateIdentified: string;
  estimatedEffort: string;
  file?: string;
  line?: number;
  type?: string;
}

// Configuration
const BACKEND_DIR = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(BACKEND_DIR, '..');
const REPORT_PATH = path.join(BACKEND_DIR, 'tech-debt-report.json');
const TECH_DEBT_MD_PATH = path.join(PROJECT_ROOT, 'TECH_DEBT.md');
const PREV_REPORT_PATH = path.join(BACKEND_DIR, 'tech-debt-report-previous.json');

const DRY_RUN = process.argv.includes('--dry-run');
const CREATE_ISSUES = process.argv.includes('--create-issues');

// Get minimum severity from args
const severityIndex = process.argv.indexOf('--min-severity');
const MIN_SEVERITY = severityIndex >= 0 && process.argv[severityIndex + 1] 
  ? process.argv[severityIndex + 1] 
  : 'low';

const severityOrder = ['critical', 'high', 'medium', 'low'];
const minSeverityIndex = severityOrder.indexOf(MIN_SEVERITY);

function shouldInclude(severity: string): boolean {
  const issueSeverityIndex = severityOrder.indexOf(severity);
  return issueSeverityIndex >= 0 && issueSeverityIndex <= minSeverityIndex;
}

// Category mapping from type to TECH_DEBT.md categories
const categoryMap: Record<string, string> = {
  'deprecated': 'Deprecated APIs',
  'logging': 'Code Quality',
  'todo': 'Code Quality',
  'fixme': 'Code Quality',
  'hack': 'Code Quality',
  'xxx': 'Code Quality',
  'type-safety': 'Type Safety',
  'type-suppression': 'Type Safety',
  'error-handling': 'Code Quality',
  'marker': 'Code Quality'
};

// Estimated effort mapping
const effortMap: Record<string, string> = {
  'critical': '1 hour',
  'high': '2 hours',
  'medium': '4 hours',
  'low': '8 hours'
};

function loadReport(): TechDebtReport | null {
  try {
    if (!fs.existsSync(REPORT_PATH)) {
      console.log('⚠️  No tech-debt-report.json found. Run detect-tech-debt.ts first.');
      return null;
    }
    const content = fs.readFileSync(REPORT_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Error loading report:', error);
    return null;
  }
}

function loadPreviousReport(): TechDebtReport | null {
  try {
    if (!fs.existsSync(PREV_REPORT_PATH)) {
      return null;
    }
    const content = fs.readFileSync(PREV_REPORT_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function loadExistingTechDebtItems(): TechDebtItem[] {
  const items: TechDebtItem[] = [];
  try {
    const content = fs.readFileSync(TECH_DEBT_MD_PATH, 'utf-8');
    // Parse the table from TECH_DEBT.md
    const tableMatch = content.match(/\| ID \| Category \| Title \| Description \| Severity \| Status \| Date Identified \| Estimated Effort \|\n\|[-|\s]+\|\n/);
    if (!tableMatch) return items;

    const tableStart = content.indexOf(tableMatch[0]) + tableMatch[0].length;
    const activeDebtStart = content.indexOf('### Historical Debt');
    const tableContent = activeDebtStart > 0 
      ? content.substring(tableStart, activeDebtStart)
      : content.substring(tableStart);

    const lines = tableContent.split('\n');
    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 8 && /^[A-Z]+-\d+$/.test(parts[0])) {
        items.push({
          id: parts[0],
          category: parts[1],
          title: parts[2],
          description: parts[3],
          severity: parts[4],
          status: parts[5],
          dateIdentified: parts[6],
          estimatedEffort: parts[7]
        });
      }
    }
  } catch {
    // File might not exist or be parseable
  }
  return items;
}

function getNextTechDebtId(existingItems: TechDebtItem[]): string {
  const activeItems = existingItems.filter(item => item.id.startsWith('TD-') && !item.id.startsWith('TD-1'));
  let maxNum = 0;
  for (const item of activeItems) {
    const match = item.id.match(/TD-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `TD-${String(maxNum + 1).padStart(3, '0')}`;
}

function findNewIssues(current: TechDebtReport, previous: TechDebtReport | null, existing: TechDebtItem[]): TechDebtIssue[] {
  const newIssues: TechDebtIssue[] = [];
  const existingKeys = new Set(existing.map(e => `${e.file}:${e.line}:${e.type}`));
  
  for (const issue of current.issues) {
    const key = `${issue.file}:${issue.line}:${issue.type}`;
    if (!existingKeys.has(key) && shouldInclude(issue.severity)) {
      // Check if this is new (not in previous report)
      if (previous) {
        const wasInPrevious = previous.issues.some(p => 
          p.file === issue.file && p.line === issue.line && p.type === issue.type
        );
        if (!wasInPrevious) {
          newIssues.push(issue);
        }
      } else {
        newIssues.push(issue);
      }
    }
  }
  
  return newIssues;
}

function generateIssueBody(issue: TechDebtIssue, id: string): string {
  return `## Tech Debt Issue: ${id}

### Details
- **Type**: ${issue.type}
- **Severity**: ${issue.severity}
- **Category**: ${categoryMap[issue.type] || 'Code Quality'}
- **File**: \`${issue.file}:${issue.line}\`
- **Date Identified**: ${new Date().toISOString().split('T')[0]}
- **Estimated Effort**: ${effortMap[issue.severity] || 'Unknown'}

### Description
${issue.description}

### Code
\`\`\`typescript
${issue.code}
\`\`\`

${issue.details ? `### Additional Details\n${issue.details}\n` : ''}

### Action Items
- [ ] Investigate and understand the issue
- [ ] Create a plan to address the debt
- [ ] Implement the fix or create a tracking issue
- [ ] Update TECH_DEBT.md when resolved

---
*Generated by tech-debt-sync.ts*
`;
}

function generateGitHubIssues(newIssues: TechDebtIssue[], existingItems: TechDebtItem[]): void {
  const issuesDir = path.join(BACKEND_DIR, 'tech-debt-issues');
  
  if (!fs.existsSync(issuesDir)) {
    fs.mkdirSync(issuesDir, { recursive: true });
  }

  console.log(`\n📝 Generating GitHub issue drafts...\n`);
  
  for (const issue of newIssues) {
    const id = getNextTechDebtId(existingItems);
    const filename = `${id}-${issue.type}-${issue.file.split('/').pop()}.md`;
    const filepath = path.join(issuesDir, filename);
    
    const content = generateIssueBody(issue, id);
    fs.writeFileSync(filepath, content);
    
    console.log(`   ✅ Created: ${filepath}`);
    existingItems.push({
      id,
      category: categoryMap[issue.type] || 'Code Quality',
      title: issue.description,
      description: issue.details || issue.description,
      severity: issue.severity,
      status: 'Open',
      dateIdentified: new Date().toISOString().split('T')[0],
      estimatedEffort: effortMap[issue.severity] || 'Unknown',
      file: issue.file,
      line: issue.line
    });
  }
  
  console.log(`\n📁 Issue drafts saved to: ${issuesDir}`);
  console.log('   Review and create issues on GitHub, then update TECH_DEBT.md');
}

function updateTechDebtMd(newIssues: TechDebtIssue[], existingItems: TechDebtItem[]): void {
  if (newIssues.length === 0) {
    console.log('\n✅ No new tech debt items to sync.');
    return;
  }

  console.log(`\n📝 Syncing ${newIssues.length} new item(s) to TECH_DEBT.md...\n`);
  
  try {
    let content = fs.readFileSync(TECH_DEBT_MD_PATH, 'utf-8');
    
    // Find the table position
    const tableStart = content.indexOf('| ID | Category | Title | Description | Severity | Status | Date Identified | Estimated Effort |');
    if (tableStart === -1) {
      console.log('⚠️  Could not find tech debt table in TECH_DEBT.md');
      return;
    }
    
    // Find end of header line
    const headerEnd = content.indexOf('\n', tableStart) + 1;
    const separatorEnd = content.indexOf('\n', headerEnd) + 1;
    
    // Find the start of Historical Debt section
    const historicalStart = content.indexOf('### Historical Debt');
    
    let tableContent = '';
    if (historicalStart > 0) {
      tableContent = content.substring(separatorEnd, historicalStart).trimEnd();
    } else {
      // Find end of table (empty line or next section)
      const remaining = content.substring(separatorEnd);
      const nextSection = remaining.search(/\n###\s/);
      tableContent = nextSection > 0 ? remaining.substring(0, nextSection).trimEnd() : remaining.trimEnd();
    }
    
    // Add new items to the table
    const today = new Date().toISOString().split('T')[0];
    
    for (const issue of newIssues) {
      const id = getNextTechDebtId(existingItems);
      const category = categoryMap[issue.type] || 'Code Quality';
      const title = issue.details || issue.description;
      const description = issue.description;
      const severity = issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1);
      const effort = effortMap[issue.severity] || '4 hours';
      
      const newRow = `| ${id} | ${category} | ${title} | ${description} | ${severity} | Open | ${today} | ${effort} |\n`;
      tableContent = newRow + tableContent;
      
      // Add to existing items for tracking
      existingItems.push({
        id,
        category,
        title,
        description,
        severity,
        status: 'Open',
        dateIdentified: today,
        estimatedEffort: effort,
        file: issue.file,
        line: issue.line
      });
      
      console.log(`   ✅ Added: ${id} - ${title}`);
    }
    
    // Rebuild content
    if (historicalStart > 0) {
      content = content.substring(0, separatorEnd) + tableContent + '\n' + content.substring(historicalStart);
    } else {
      content = content.substring(0, separatorEnd) + tableContent + '\n';
    }
    
    if (DRY_RUN) {
      console.log('\n🔍 Dry run - not writing changes:');
      console.log(content.substring(tableStart, tableStart + 500) + '...\n');
    } else {
      fs.writeFileSync(TECH_DEBT_MD_PATH, content);
      console.log(`\n✅ Updated: ${TECH_DEBT_MD_PATH}`);
    }
  } catch (error) {
    console.error('❌ Error updating TECH_DEBT.md:', error);
  }
}

function savePreviousReport(current: TechDebtReport): void {
  if (!DRY_RUN) {
    fs.writeFileSync(PREV_REPORT_PATH, JSON.stringify(current, null, 2));
  }
}

function main(): void {
  console.log('🔄 Tech Debt Sync Tool\n');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Min Severity: ${MIN_SEVERITY}\n`);

  const currentReport = loadReport();
  if (!currentReport) {
    console.log('\n💡 Run "npm run tech-debt:report" first to generate a report.\n');
    process.exit(1);
  }

  const previousReport = loadPreviousReport();
  const existingItems = loadExistingTechDebtItems();
  
  console.log(`📊 Current Report:`);
  console.log(`   Total: ${currentReport.summary.total} issues`);
  console.log(`   Critical: ${currentReport.summary.critical}`);
  console.log(`   High: ${currentReport.summary.high}`);
  console.log(`   Medium: ${currentReport.summary.medium}`);
  console.log(`   Low: ${currentReport.summary.low}`);
  
  if (previousReport) {
    console.log(`\n📊 Previous Report: ${previousReport.summary.total} issues`);
  }
  
  console.log(`\n📋 Existing Tech Debt Items: ${existingItems.length}`);

  // Find new issues
  const newIssues = findNewIssues(currentReport, previousReport, existingItems);
  
  if (newIssues.length === 0) {
    console.log('\n✅ No new tech debt items detected.');
    savePreviousReport(currentReport);
    return;
  }

  console.log(`\n🆕 New Issues Found: ${newIssues.length}`);
  
  // Group by severity
  const bySeverity: Record<string, TechDebtIssue[]> = {};
  for (const issue of newIssues) {
    if (!bySeverity[issue.severity]) {
      bySeverity[issue.severity] = [];
    }
    bySeverity[issue.severity].push(issue);
  }
  
  for (const severity of severityOrder) {
    if (bySeverity[severity]) {
      console.log(`   ${severity}: ${bySeverity[severity].length}`);
    }
  }

  // Create GitHub issue drafts if requested
  if (CREATE_ISSUES) {
    generateGitHubIssues(newIssues, existingItems);
  }

  // Update TECH_DEBT.md
  updateTechDebtMd(newIssues, existingItems);

  // Save current report as previous for next run
  savePreviousReport(currentReport);
  
  console.log('\n✅ Tech debt sync complete!\n');
}

main();
