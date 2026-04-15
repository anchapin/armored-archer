#!/usr/bin/env npx ts-node
/**
 * AGENTS.md Validation Script
 *
 * This script validates the AGENTS.md file follows the expected schema/format.
 * It checks for required sections, formatting, and content requirements.
 *
 * Usage:
 *   npx ts-node scripts/validate-agents-md.ts [--ci-mode] [--json-output]
 *
 * Options:
 *   --ci-mode       Exit with error if validation fails
 *   --json-output   Output only JSON report (for programmatic use)
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const ROOT_DIR = path.join(__dirname, '..', '..');
const BACKEND_DIR = path.join(__dirname, '..');
const AGENTS_MD_PATH = path.join(ROOT_DIR, 'AGENTS.md');
const CI_MODE = process.argv.includes('--ci-mode');
const JSON_OUTPUT = process.argv.includes('--json-output');

// Required sections in AGENTS.md
const REQUIRED_SECTIONS = [
  'Project Structure',
  'Build & Development Commands',
  'Code Style',
  'Testing Guidelines',
];

// Section patterns to look for (can be partial matches)
const EXPECTED_SECTIONS = [
  {
    pattern: /Project Structure/i,
    required: true,
    description: 'Project directory structure documentation',
  },
  {
    pattern: /Build & Development Commands/i,
    required: true,
    description: 'Build and development command documentation',
  },
  {
    pattern: /Godot Client|GDScript/i,
    required: true,
    description: 'Godot client/GDScript section',
  },
  { pattern: /Backend|Nakama|TypeScript/i, required: true, description: 'Backend/Nakama section' },
  { pattern: /Database|PostgreSQL/i, required: true, description: 'Database section' },
  {
    pattern: /GDScript Code Style/i,
    required: true,
    description: 'GDScript code style guidelines',
  },
  {
    pattern: /TypeScript Code Style/i,
    required: true,
    description: 'TypeScript code style guidelines',
  },
  { pattern: /Testing Guidelines/i, required: true, description: 'Testing guidelines' },
  {
    pattern: /AI-Assisted Development|AI Agent/i,
    required: true,
    description: 'AI-assisted development guidelines',
  },
  { pattern: /Release Notes/i, required: false, description: 'Release notes automation' },
  { pattern: /Technical Debt/i, required: false, description: 'Technical debt tracking' },
  { pattern: /Bundle Size/i, required: false, description: 'Bundle size tracking' },
];

interface ValidationIssue {
  type: 'error' | 'warning';
  category: string;
  message: string;
  line?: number;
  context?: string;
}

interface ValidationResult {
  valid: boolean;
  file: string;
  exists: boolean;
  sections: {
    found: string[];
    missing: { pattern: string; description: string }[];
  };
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
  };
}

function validateAgentsMd(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    file: AGENTS_MD_PATH,
    exists: false,
    sections: {
      found: [],
      missing: [],
    },
    issues: [],
    summary: {
      errors: 0,
      warnings: 0,
    },
  };

  // Check if file exists
  if (!fs.existsSync(AGENTS_MD_PATH)) {
    result.valid = false;
    result.issues.push({
      type: 'error',
      category: 'file',
      message: 'AGENTS.md file not found',
    });
    result.summary.errors++;
    return result;
  }

  result.exists = true;

  // Read file content
  const content = fs.readFileSync(AGENTS_MD_PATH, 'utf-8');
  const lines = content.split('\n');

  // Check for required sections
  for (const section of EXPECTED_SECTIONS) {
    const found = lines.some((line) => section.pattern.test(line));

    if (found) {
      result.sections.found.push(section.pattern.source);
    } else if (section.required) {
      result.valid = false;
      result.issues.push({
        type: 'error',
        category: 'section',
        message: `Required section not found: ${section.description}`,
      });
      result.summary.errors++;
      result.sections.missing.push({
        pattern: section.pattern.source,
        description: section.description,
      });
    } else {
      result.issues.push({
        type: 'warning',
        category: 'section',
        message: `Optional section not found: ${section.description}`,
      });
      result.summary.warnings++;
    }
  }

  // Check for basic formatting issues

  // 1. Check file has a title (first line should be # heading)
  if (lines.length > 0 && !lines[0].startsWith('# ')) {
    result.valid = false;
    result.issues.push({
      type: 'error',
      category: 'format',
      message: 'AGENTS.md should start with a title (e.g., # Agent Development Guidelines)',
      line: 1,
      context: lines[0],
    });
    result.summary.errors++;
  }

  // 2. Check for code blocks with language hints
  // Find code blocks that start with just ``` followed by newline (no language hint)
  // Only flag opening code blocks (not closing ones)
  let hasCodeBlockWithoutLang = false;
  let inCodeBlock = false;
  const lines_array = content.split('\n');
  for (let i = 0; i < lines_array.length; i++) {
    const line = lines_array[i];
    const codeBlockStartMatch = line.match(/^```(\w+)?/);

    if (codeBlockStartMatch) {
      if (!inCodeBlock) {
        // This is an opening code block
        inCodeBlock = true;
        // Check if it has a language hint (group 1 would be the language if present)
        if (!codeBlockStartMatch[1]) {
          result.issues.push({
            type: 'warning',
            category: 'format',
            message: `Code block without language hint at line ${i + 1}`,
            line: i + 1,
            context: line,
          });
          result.summary.warnings++;
          hasCodeBlockWithoutLang = true;
        }
      } else {
        // This is a closing code block
        inCodeBlock = false;
      }
    }
  }

  // If we found code blocks without lang, also add a summary message
  if (hasCodeBlockWithoutLang) {
    result.issues.push({
      type: 'warning',
      category: 'format',
      message:
        'Add language hints to code blocks for better syntax highlighting (e.g., ```bash, ```typescript, ```text)',
    });
    result.summary.warnings++;
  }

  // 3. Check for consistent heading levels (should not skip levels like ## then ####)
  // Track the immediate parent heading level to detect skipping
  // Note: H1 (#) is typically the document title and should be ignored for section level tracking
  let lastHeadingLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s/);
    if (headingMatch) {
      const level = headingMatch[1].length;

      // Skip H1 (document title) - don't use it as a parent for section headings
      if (level === 1) {
        lastHeadingLevel = 0;
        continue;
      }

      // Warn if skipping more than one level (e.g., ### to ##### or ## to ####)
      // The only valid progression is: ## -> ### -> #### -> ##### -> ######
      // So we warn if level > lastHeadingLevel + 1
      if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
        result.issues.push({
          type: 'warning',
          category: 'format',
          message: `Heading level skipped: found ${level} level after ${lastHeadingLevel} level. Headings should increment by 1.`,
          line: i + 1,
          context: line,
        });
        result.summary.warnings++;
      }

      lastHeadingLevel = level;
    }
  }

  // 4. Check for empty sections (sections with no content)
  const emptySectionPattern = /^##\s+\w+\s*\n##\s+/;
  if (emptySectionPattern.test(content)) {
    result.issues.push({
      type: 'warning',
      category: 'format',
      message: 'Found potentially empty sections (section headers with no content)',
    });
    result.summary.warnings++;
  }

  // 5. Check for broken links
  const brokenLinkPattern = /\[([^\]]+)\]\((?!http|https|#)[^)]*\)/g;
  let linkMatch;
  const contentWithoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');

  // Allowlist of safe relative link patterns
  const safeRelativeLinkPatterns = [
    /^(backend\/|TECH_DEBT\.md|DATABASE_SCHEMA\.md|CLAUDE\.md|CONTRIBUTING\.md)/,
  ];

  while ((linkMatch = brokenLinkPattern.exec(contentWithoutCode)) !== null) {
    const fullMatch = linkMatch[0];
    const linkUrl = fullMatch.match(/\(([^)]+)\)/)?.[1] || '';

    // Check if it's a relative link that should exist
    if (linkUrl && !linkUrl.startsWith('#') && !linkUrl.includes(':')) {
      // Skip if it's a known safe internal link pattern
      const isSafeLink = safeRelativeLinkPatterns.some(pattern => pattern.test(linkUrl));
      if (!isSafeLink) {
        result.issues.push({
          type: 'warning',
          category: 'link',
          message: `Relative link found: ${fullMatch}`,
        });
        result.summary.warnings++;
      }
    }
  }

  // 6. Check for minimum content length
  const minLines = 100;
  if (lines.length < minLines) {
    result.valid = false;
    result.issues.push({
      type: 'error',
      category: 'content',
      message: `AGENTS.md is too short (${lines.length} lines). Expected at least ${minLines} lines.`,
    });
    result.summary.errors++;
  }

  // 7. Check for minimum word count (reasonable documentation should be substantial)
  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
  const minWords = 500;
  if (wordCount < minWords) {
    result.issues.push({
      type: 'warning',
      category: 'content',
      message: `AGENTS.md word count is low (${wordCount} words). Expected at least ${minWords} words.`,
    });
    result.summary.warnings++;
  }

  // 8. Check for required subsections in Build & Development Commands
  const buildSectionStart = lines.findIndex((l) => /Build & Development Commands/i.test(l));
  if (buildSectionStart !== -1) {
    const buildSectionContent = lines.slice(buildSectionStart, buildSectionStart + 100).join('\n');

    if (!/Godot Client|GDScript/i.test(buildSectionContent)) {
      result.valid = false;
      result.issues.push({
        type: 'error',
        category: 'content',
        message:
          'Build & Development Commands section must include Godot Client/GDScript subsection',
      });
      result.summary.errors++;
    }

    if (!/Backend|Nakama/i.test(buildSectionContent)) {
      result.valid = false;
      result.issues.push({
        type: 'error',
        category: 'content',
        message: 'Build & Development Commands section must include Backend/Nakama subsection',
      });
      result.summary.errors++;
    }
  }

  // 9. Check for AI attribution requirements
  if (!/AI-Assisted|AI-assisted|AI agent/i.test(content)) {
    result.issues.push({
      type: 'warning',
      category: 'content',
      message: 'AGENTS.md should include AI-assisted development guidelines',
    });
    result.summary.warnings++;
  }

  // 10. Check for commit message format section
  if (!/commit message|Commit Message/i.test(content)) {
    result.issues.push({
      type: 'warning',
      category: 'content',
      message: 'AGENTS.md should include commit message format guidelines',
    });
    result.summary.warnings++;
  }

  return result;
}

function printResults(result: ValidationResult): void {
  console.log('\n📋 AGENTS.md Validation Results\n');
  console.log(`File: ${result.file}`);
  console.log(`Exists: ${result.exists ? '✅ Yes' : '❌ No'}`);

  if (!result.exists) {
    console.log('\n❌ Validation failed: File not found\n');
    return;
  }

  console.log(`\n📑 Sections:`);
  console.log(`   Found: ${result.sections.found.length}`);
  console.log(`   Missing (required): ${result.sections.missing.length}`);

  if (result.sections.missing.length > 0) {
    console.log('\n   Missing sections:');
    for (const section of result.sections.missing) {
      console.log(`   - ${section.description}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Errors: ${result.summary.errors}`);
  console.log(`   Warnings: ${result.summary.warnings}`);

  if (result.issues.length > 0) {
    console.log('\n🔍 Issues:');

    // Group by type
    const errors = result.issues.filter((i) => i.type === 'error');
    const warnings = result.issues.filter((i) => i.type === 'warning');

    if (errors.length > 0) {
      console.log('\n   ❌ Errors:');
      for (const issue of errors) {
        const location = issue.line ? `:${issue.line}` : '';
        console.log(`      ${issue.category}${location}: ${issue.message}`);
        if (issue.context) {
          console.log(`         Context: ${issue.context.substring(0, 60)}`);
        }
      }
    }

    if (warnings.length > 0) {
      console.log('\n   ⚠️  Warnings:');
      for (const issue of warnings) {
        const location = issue.line ? `:${issue.line}` : '';
        console.log(`      ${issue.category}${location}: ${issue.message}`);
      }
    }
  }

  console.log(`\n${result.valid ? '✅ Validation passed!' : '❌ Validation failed!'}\n`);
}

function generateJSONReport(result: ValidationResult): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      valid: result.valid,
      file: result.file,
      exists: result.exists,
      sections: {
        found: result.sections.found,
        missing: result.sections.missing,
      },
      issues: result.issues.map((issue) => ({
        type: issue.type,
        category: issue.category,
        message: issue.message,
        line: issue.line,
        context: issue.context,
      })),
      summary: result.summary,
    },
    null,
    2
  );
}

function main(): void {
  const result = validateAgentsMd();

  if (JSON_OUTPUT) {
    console.log(generateJSONReport(result));
    return;
  }

  // Save JSON report
  const reportPath = path.join(BACKEND_DIR || ROOT_DIR, 'agents-md-validation-report.json');
  const jsonReport = generateJSONReport(result);
  fs.writeFileSync(reportPath, jsonReport);
  console.log(`\n📊 JSON report saved to: ${reportPath}`);

  printResults(result);

  if (CI_MODE && !result.valid) {
    console.log('❌ CI Mode: Validation failed. Exiting with error.\n');
    process.exit(1);
  }
}

main();
