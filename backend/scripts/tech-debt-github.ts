#!/usr/bin/env npx ts-node
/**
 * GitHub Issue Integration Script
 *
 * This script creates GitHub issues from tech debt items.
 * It can work in two modes:
 * 1. Generate issue templates locally (no API needed)
 * 2. Create issues directly via GitHub API (requires GITHUB_TOKEN)
 *
 * Usage:
 *   npx ts-node scripts/tech-debt-github.ts [--create-issues] [--dry-run]
 *   npx ts-node scripts/tech-debt-github.ts --list-templates
 *
 * Options:
 *   --create-issues  Create issues on GitHub (requires GITHUB_TOKEN env var)
 *   --dry-run        Show what would be created without making changes
 *   --list-templates List available issue templates
 *   --min-severity   Minimum severity to create issues for (critical, high, medium)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

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

// Configuration
const BACKEND_DIR = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(BACKEND_DIR, '..');
const REPORT_PATH = path.join(BACKEND_DIR, 'tech-debt-report.json');
const GITHUB_REPO = process.env.GITHUB_REPO || 'owner/armored-archer';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const CREATE_ISSUES = process.argv.includes('--create-issues');
const DRY_RUN = process.argv.includes('--dry-run');
const LIST_TEMPLATES = process.argv.includes('--list-templates');

// Get minimum severity from args
const severityIndex = process.argv.indexOf('--min-severity');
const MIN_SEVERITY = severityIndex >= 0 && process.argv[severityIndex + 1] 
  ? process.argv[severityIndex + 1] 
  : 'high';

const severityOrder = ['critical', 'high', 'medium', 'low'];
const minSeverityIndex = severityOrder.indexOf(MIN_SEVERITY);

function shouldInclude(severity: string): boolean {
  const issueSeverityIndex = severityOrder.indexOf(severity);
  return issueSeverityIndex >= 0 && issueSeverityIndex <= minSeverityIndex;
}

// Labels for GitHub issues
const severityLabels: Record<string, string> = {
  'critical': 'severity:critical',
  'high': 'severity:high',
  'medium': 'severity:medium',
  'low': 'severity:low'
};

const typeLabels: Record<string, string> = {
  'deprecated': 'type:deprecated',
  'logging': 'type:code-quality',
  'todo': 'type:todo',
  'fixme': 'type:fixme',
  'hack': 'type:hack',
  'xxx': 'type:xxx',
  'type-safety': 'type:type-safety',
  'type-suppression': 'type:type-safety',
  'error-handling': 'type:error-handling',
  'marker': 'type:code-quality'
};

const categoryLabels: Record<string, string> = {
  'deprecated': 'category:deprecated-apis',
  'logging': 'category:code-quality',
  'todo': 'category:code-quality',
  'fixme': 'category:code-quality',
  'hack': 'category:code-quality',
  'xxx': 'category:code-quality',
  'type-safety': 'category:type-safety',
  'type-suppression': 'category:type-safety',
  'error-handling': 'category:code-quality',
  'marker': 'category:code-quality'
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

function generateIssueTitle(issue: TechDebtIssue): string {
  const severity = issue.severity.toUpperCase();
  const type = issue.type.toUpperCase();
  return `[${severity}] ${type}: ${issue.description.substring(0, 50)}`;
}

function generateIssueBody(issue: TechDebtIssue): string {
  const labels = [
    severityLabels[issue.severity] || 'type:other',
    typeLabels[issue.type] || 'type:other',
    'tech-debt'
  ].filter(Boolean);

  return `## Technical Debt Item

### Details
| Property | Value |
|---------|-------|
| **Type** | ${issue.type} |
| **Severity** | ${issue.severity} |
| **File** | \`${issue.file}:${issue.line}\` |
| **Date Detected** | ${new Date().toISOString().split('T')[0]} |
${issue.age !== undefined ? `| **Age** | ${issue.age} days |` : ''}
${issue.details ? `| **Details** | ${issue.details} |` : ''}

### Description
${issue.description}

### Code
\`\`\`typescript
${issue.code}
\`\`\`

### Recommended Actions
- [ ] Review and understand the issue
- [ ] Estimate effort required
- [ ] Create a plan to address
- [ ] Implement fix or document reason for deferral
- [ ] Update TECH_DEBT.md when resolved

---
*Auto-generated from tech debt detection report*`;
}

function getIssueLabels(issue: TechDebtIssue): string[] {
  const labels = ['tech-debt'];
  
  if (severityLabels[issue.severity]) {
    labels.push(severityLabels[issue.severity]);
  }
  
  if (typeLabels[issue.type]) {
    labels.push(typeLabels[issue.type]);
  }
  
  if (categoryLabels[issue.type]) {
    labels.push(categoryLabels[issue.type]);
  }
  
  return labels;
}

function createGitHubIssue(title: string, body: string, labels: string[]): Promise<{ number: number; url: string } | null> {
  return new Promise((resolve) => {
    if (!GITHUB_TOKEN) {
      console.log('   ⚠️  No GITHUB_TOKEN found, skipping API call');
      resolve(null);
      return;
    }

    const [owner, repo] = GITHUB_REPO.split('/');
    const postData = JSON.stringify({
      owner,
      repo,
      title,
      body,
      labels
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/issues`,
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'tech-debt-sync-script'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 201) {
          const response = JSON.parse(data);
          resolve({
            number: response.number,
            url: response.html_url
          });
        } else {
          console.log(`   ❌ Failed to create issue: ${res.statusCode}`);
          console.log(`   Response: ${data.substring(0, 200)}`);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Error creating issue: ${error.message}`);
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

async function createIssues(issues: TechDebtIssue[]): Promise<void> {
  const issuesDir = path.join(BACKEND_DIR, 'github-issues');
  
  if (!fs.existsSync(issuesDir)) {
    fs.mkdirSync(issuesDir, { recursive: true });
  }

  console.log(`\n📝 Creating GitHub issues...\n`);
  
  let createdCount = 0;
  let skippedCount = 0;

  for (const issue of issues) {
    const title = generateIssueTitle(issue);
    const body = generateIssueBody(issue);
    const labels = getIssueLabels(issue);

    console.log(`\n🔄 ${issue.severity.toUpperCase()} - ${issue.type}`);
    console.log(`   Title: ${title}`);
    console.log(`   Labels: ${labels.join(', ')}`);
    console.log(`   File: ${issue.file}:${issue.line}`);

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would create issue`);
      // Save draft locally anyway
      const filename = `${issue.type}-${issue.line}.md`;
      const filepath = path.join(issuesDir, filename);
      fs.writeFileSync(filepath, `# ${title}\n\n${body}\n\n---\nLabels: ${labels.join(', ')}`);
      skippedCount++;
      continue;
    }

    if (CREATE_ISSUES && GITHUB_TOKEN) {
      const result = await createGitHubIssue(title, body, labels);
      if (result) {
        console.log(`   ✅ Created: #${result.number} - ${result.url}`);
        createdCount++;
      } else {
        // Save draft locally as fallback
        const filename = `${issue.type}-${issue.line}.md`;
        const filepath = path.join(issuesDir, filename);
        fs.writeFileSync(filepath, `# ${title}\n\n${body}\n\n---\nLabels: ${labels.join(', ')}`);
        console.log(`   💾 Saved draft locally: ${filepath}`);
        skippedCount++;
      }
    } else {
      // Save draft locally
      const filename = `${issue.type}-${issue.line}.md`;
      const filepath = path.join(issuesDir, filename);
      fs.writeFileSync(filepath, `# ${title}\n\n${body}\n\n---\nLabels: ${labels.join(', ')}`);
      console.log(`   💾 Saved draft: ${filepath}`);
      skippedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Created: ${createdCount}`);
  console.log(`   Drafts/Skipped: ${skippedCount}`);
  console.log(`\n📁 Issue drafts saved to: ${issuesDir}`);
}

function listTemplates(): void {
  console.log('\n📋 Available Issue Templates:\n');
  console.log('1. Bug Report - For critical/error-handling issues');
  console.log('2. Feature Request - For code quality improvements');
  console.log('3. Technical Debt - For all tech debt items');
  console.log('\nUse --create-issues with GITHUB_TOKEN to create issues directly.\n');
}

async function main(): Promise<void> {
  console.log('🐙 GitHub Tech Debt Issue Creator\n');
  console.log(`   Repository: ${GITHUB_REPO}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : CREATE_ISSUES ? 'LIVE' : 'PREVIEW'}`);
  console.log(`   Min Severity: ${MIN_SEVERITY}`);
  console.log(`   GitHub Token: ${GITHUB_TOKEN ? '✓ Set' : '✗ Not Set'}\n`);

  if (LIST_TEMPLATES) {
    listTemplates();
    return;
  }

  const report = loadReport();
  if (!report) {
    console.log('\n💡 Run "npm run tech-debt:report" first to generate a report.\n');
    process.exit(1);
  }

  // Filter issues by severity
  const relevantIssues = report.issues.filter(issue => 
    shouldInclude(issue.severity) && 
    (issue.type === 'deprecated' || issue.type === 'fixme' || issue.type === 'hack' || issue.type === 'error-handling')
  );

  if (relevantIssues.length === 0) {
    console.log('✅ No issues match the criteria.');
    return;
  }

  console.log(`📊 Found ${relevantIssues.length} issues to process:`);
  
  // Group by severity
  const bySeverity: Record<string, TechDebtIssue[]> = {};
  for (const issue of relevantIssues) {
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

  await createIssues(relevantIssues);
  
  console.log('\n✅ GitHub issue creation complete!\n');
}

main().catch(console.error);
