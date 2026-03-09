/**
 * PII Detection Scan Script
 *
 * Scans the codebase for potential PII (Personally Identifiable Information)
 * exposures and generates a SARIF report for GitHub Advanced Security.
 *
 * Usage: npm run scan:pii
 */

import * as fs from 'fs';
import * as path from 'path';
import { scanForPII, PIIType, DetectedPII } from '../src/modules/privacy_compliance';

// File extensions to scan
const SCAN_EXTENSIONS = ['.ts', '.js', '.json', '.md', '.yml', '.yaml', '.txt'];

// Directories to exclude from scanning
const EXCLUDE_DIRS = [
  'node_modules',
  'build',
  'dist',
  '.git',
  '.agent_tmp',
  'coverage',
  '__pycache__',
  'vendor',
];

// Patterns that indicate test files (to mark as informational)
const TEST_PATTERNS = ['.test.', '.spec.', '__tests__', 'test_', '_test.'];

/**
 * Find all files matching the scan criteria
 */
function findFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
        findFiles(fullPath, files);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.includes(ext) || ext === '') {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Check if a file is a test file
 */
function isTestFile(filePath: string): boolean {
  return TEST_PATTERNS.some((pattern) => filePath.includes(pattern));
}

/**
 * Get relative path from project root
 */
function getRelativePath(filePath: string): string {
  const projectRoot = path.resolve(__dirname, '..');
  return path.relative(projectRoot, filePath);
}

/**
 * Generate SARIF format output
 */
function generateSarif(results: ScanResult[]): object {
  const runs = [
    {
      tool: {
        driver: {
          name: 'PII Detection Scanner',
          version: '1.0.0',
          informationUri: 'https://github.com/armored-archer/privacy-compliance',
          rules: Object.values(PIIType).map((type) => ({
            id: type.toUpperCase(),
            name: type,
            shortDescription: {
              text: `Detect ${type} patterns`,
            },
            helpUrl: `https://github.com/armored-archer/privacy-compliance#${type}`,
          })),
        },
      },
      results: results.map((result) => ({
        ruleId: result.type.toUpperCase(),
        level: result.severity,
        message: {
          text: result.message,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: result.file,
              },
              region: {
                startLine: result.line,
                startColumn: 1,
                endLine: result.line,
                endColumn: 1000,
              },
            },
          },
        ],
      })),
    },
  ];

  return { version: '2.1.0', runs };
}

/**
 * Scan result interface
 */
interface ScanResult {
  file: string;
  line: number;
  type: PIIType;
  value: string;
  severity: 'error' | 'warning' | 'note';
  message: string;
  isTest: boolean;
}

/**
 * Main scan function
 */
function scanForPIIInCodebase(): ScanResult[] {
  const projectRoot = path.resolve(__dirname, '..');
  const srcDir = path.join(projectRoot, 'src');
  const results: ScanResult[] = [];

  console.log('🔍 Starting PII detection scan...\n');

  // Find all files to scan
  const files = findFiles(srcDir);
  console.log(`📁 Found ${files.length} files to scan\n`);

  // Scan each file
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const isTest = isTestFile(file);
    const relativePath = getRelativePath(file);

    // Scan each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Skip comments in test files
      if (isTest && (line.trim().startsWith('//') || line.trim().startsWith('#'))) {
        continue;
      }

      const detections = scanForPII(line);

      for (const detection of detections) {
        // Determine severity based on PII type
        let severity: 'error' | 'warning' | 'note' = 'warning';
        const restrictedTypes = [
          PIIType.SSN,
          PIIType.CREDIT_CARD,
          PIIType.PASSWORD,
          PIIType.AUTH_TOKEN,
          PIIType.SESSION_ID,
        ];

        if (restrictedTypes.includes(detection.type)) {
          severity = 'error';
        } else if (isTest) {
          severity = 'note';
        }

        results.push({
          file: relativePath,
          line: lineNumber,
          type: detection.type,
          value: detection.value.substring(0, 50) + (detection.value.length > 50 ? '...' : ''),
          severity,
          message: `Potential ${detection.type} detected: ${detection.value.substring(0, 30)}...`,
          isTest,
        });
      }
    }
  }

  return results;
}

/**
 * Main execution
 */
function main(): void {
  const results = scanForPIIInCodebase();

  // Summary
  const errorCount = results.filter((r) => r.severity === 'error').length;
  const warningCount = results.filter((r) => r.severity === 'warning').length;
  const noteCount = results.filter((r) => r.severity === 'note').length;

  console.log('\n📊 Scan Results Summary:');
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Warnings: ${warningCount}`);
  console.log(`   Notes (test files): ${noteCount}`);
  console.log(`   Total findings: ${results.length}\n`);

  // Filter out notes for console output (test file noise)
  const actionableResults = results.filter((r) => r.severity !== 'note');

  if (actionableResults.length > 0) {
    console.log('⚠️  Actionable Findings:\n');
    for (const result of actionableResults.slice(0, 20)) {
      console.log(`  [${result.severity.toUpperCase()}] ${result.file}:${result.line}`);
      console.log(`    Type: ${result.type}`);
      console.log(`    Value: ${result.value}\n`);
    }

    if (actionableResults.length > 20) {
      console.log(`  ... and ${actionableResults.length - 20} more findings\n`);
    }
  } else {
    console.log('✅ No actionable PII findings!\n');
  }

  // Generate SARIF output
  const outputDir = path.join(process.cwd(), '.agent_tmp');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sarif = generateSarif(results);
  const sarifPath = path.join(outputDir, 'pii-scan.sarif');
  fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2));
  console.log(`📄 SARIF report saved to: ${sarifPath}\n`);

  // Exit with error code if critical findings
  const criticalCount = results.filter((r) => r.severity === 'error').length;
  if (criticalCount > 0) {
    console.log(`❌ Scan completed with ${criticalCount} critical findings.\n`);
    process.exit(1);
  }

  console.log('✅ PII scan completed successfully.\n');
  process.exit(0);
}

main();
