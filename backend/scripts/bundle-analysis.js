#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * 
 * Analyzes bundle size, checks against limits, and tracks bundle size over time.
 * Usage: node scripts/bundle-analysis.js [--ci-mode] [--verbose]
 * 
 * Features:
 * - Analyzes npm dependencies for heavy dependencies
 * - Measures bundle output size
 * - Checks against configured size limits
 * - Tracks bundle size over time in CI/CD
 * - Provides alerts for bundle growth
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'bundle-size-limits.json');
const SIZE_HISTORY_FILE = path.join(__dirname, '.bundle-size-history.json');
const CI_MODE = process.argv.includes('--ci-mode');
const VERBOSE = process.argv.includes('--verbose');

// Default size limits (in bytes)
const DEFAULT_LIMITS = {
  maxBundleSize: 2 * 1024 * 1024, // 2MB
  maxDependencySize: 10 * 1024 * 1024, // 10MB
  maxFileSize: 500 * 1024, // 500KB
  warnings: {
    bundleSizeGrowthPercent: 10, // Warn if bundle grows by more than 10%
    heavyDependencySize: 2 * 1024 * 1024, // 2MB - flag dependencies over this size
  },
};

// Heavy dependency patterns to detect
const HEAVY_DEPENDENCY_PATTERNS = [
  { pattern: /@opentelemetry.*/, reason: 'Telemetry SDKs are large', suggested: 'Use selective imports' },
  { pattern: /@sentry\/node/, reason: 'Sentry is large', suggested: 'Use @sentry/node (tree-shakeable)' },
  { pattern: /winston/, reason: 'Logging library', suggested: 'Consider pino or abstract logging' },
  { pattern: /prom-client/, reason: 'Prometheus client', suggested: 'Verify needed metrics only' },
  { pattern: /zod/, reason: 'Validation library', suggested: 'Consider lighter alternatives or tree-shaking' },
];

/**
 * Load configuration from file or use defaults
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...DEFAULT_LIMITS, ...config };
    }
  } catch (error) {
    console.warn('Warning: Could not load config file, using defaults:', error.message);
  }
  return DEFAULT_LIMITS;
}

/**
 * Get package.json dependencies
 */
function getDependencies() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  return {
    dependencies: packageJson.dependencies || {},
    devDependencies: packageJson.devDependencies || {},
  };
}

/**
 * Calculate total npm dependency size
 */
function calculateDependencySize() {
  try {
    // Use npm ls to get dependency tree with size info
    const output = execSync('npm ls --all --parseable', { 
      cwd: __dirname, 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    
    const packages = output.split('\n').filter(Boolean);
    let totalSize = 0;
    const packageSizes = {};
    
    for (const pkg of packages) {
      try {
        const packageJsonPath = path.join(pkg, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          // Estimate size from published package
          if (pkgJson.dist && pkgJson.dist.unpackedSize) {
            const size = pkgJson.dist.unpackedSize;
            packageSizes[pkgJson.name] = size;
            totalSize += size;
          }
        }
      } catch {
        // Skip packages we can't read
      }
    }
    
    return { totalSize, packageSizes };
  } catch (error) {
    // Fallback: estimate from node_modules
    console.warn('Warning: Could not get npm package sizes, using fallback');
    return { totalSize: 0, packageSizes: {} };
  }
}

/**
 * Analyze heavy dependencies
 */
function analyzeHeavyDependencies(deps, packageSizes) {
  const issues = [];
  
  for (const [name, size] of Object.entries(packageSizes)) {
    // Check against heavy dependency patterns
    for (const { pattern, reason, suggested } of HEAVY_DEPENDENCY_PATTERNS) {
      if (pattern.test(name)) {
        const sizeMB = (size / (1024 * 1024)).toFixed(2);
        issues.push({
          type: 'heavy_dependency',
          name,
          size,
          sizeMB: parseFloat(sizeMB),
          reason,
          suggested,
          severity: size > DEFAULT_LIMITS.warnings.heavyDependencySize ? 'error' : 'warning',
        });
      }
    }
  }
  
  return issues;
}

/**
 * Get bundle file sizes from build output
 */
function getBundleSizes() {
  const buildDir = path.join(__dirname, 'build');
  const sizes = [];
  
  if (!fs.existsSync(buildDir)) {
    return sizes;
  }
  
  function walkDir(dir, basePath = '') {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath, path.join(basePath, file));
      } else {
        const relativePath = path.join(basePath, file);
        sizes.push({
          path: relativePath,
          size: stat.size,
          sizeKB: (stat.size / 1024).toFixed(2),
        });
      }
    }
  }
  
  walkDir(buildDir);
  return sizes;
}

/**
 * Calculate total bundle size
 */
function calculateBundleSize() {
  const sizes = getBundleSizes();
  return sizes.reduce((acc, { size }) => acc + size, 0);
}

/**
 * Load bundle size history
 */
function loadHistory() {
  try {
    if (fs.existsSync(SIZE_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(SIZE_HISTORY_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return { history: [] };
}

/**
 * Save bundle size to history
 */
function saveHistory(history) {
  fs.writeFileSync(SIZE_HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Check bundle size growth
 */
function checkBundleGrowth(currentSize) {
  const { history } = loadHistory();
  const issues = [];
  
  if (history.length > 0) {
    const lastEntry = history[history.length - 1];
    const growth = ((currentSize - lastEntry.size) / lastEntry.size) * 100;
    const limit = DEFAULT_LIMITS.warnings.bundleSizeGrowthPercent;
    
    if (growth > limit) {
      issues.push({
        type: 'bundle_growth',
        message: `Bundle size grew by ${growth.toFixed(1)}% since last build (limit: ${limit}%)`,
        severity: growth > limit * 2 ? 'error' : 'warning',
        growth,
        previousSize: lastEntry.size,
        currentSize,
      });
    }
  }
  
  // Add current size to history
  history.push({
    date: new Date().toISOString(),
    size: currentSize,
    commit: process.env.GIT_COMMIT || 'unknown',
  });
  
  // Keep only last 30 entries
  if (history.length > 30) {
    history.shift();
  }
  
  saveHistory(history);
  
  return issues;
}

/**
 * Run bundle analysis
 */
function runAnalysis() {
  console.log('\n📦 Bundle Size Analysis\n');
  console.log('='.repeat(50));
  
  const config = loadConfig();
  const { dependencies, devDependencies } = getDependencies();
  
  // Analyze dependencies
  console.log('\n🔍 Analyzing npm dependencies...');
  const { totalSize, packageSizes } = calculateDependencySize();
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  console.log(`   Total dependency size: ${totalSizeMB} MB`);
  
  // Check for heavy dependencies
  const heavyDeps = analyzeHeavyDependencies(dependencies, packageSizes);
  
  if (heavyDeps.length > 0) {
    console.log('\n⚠️  Heavy dependencies detected:');
    for (const dep of heavyDeps) {
      console.log(`   [${dep.severity.toUpperCase()}] ${dep.name}: ${dep.sizeMB} MB`);
      console.log(`      Reason: ${dep.reason}`);
      console.log(`      Suggestion: ${dep.suggested}`);
    }
  }
  
  // Check bundle sizes
  console.log('\n📊 Analyzing build output...');
  const bundleSizes = getBundleSizes();
  const totalBundleSize = calculateBundleSize();
  const bundleSizeMB = (totalBundleSize / (1024 * 1024)).toFixed(2);
  
  console.log(`   Total bundle size: ${bundleSizeMB} MB`);
  
  // Show largest files
  const largestFiles = bundleSizes
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);
  
  if (largestFiles.length > 0) {
    console.log('\n   Largest files:');
    for (const file of largestFiles) {
      console.log(`      ${file.path}: ${file.sizeKB} KB`);
    }
  }
  
  // Check size limits
  console.log('\n✅ Checking size limits...');
  const issues = [];
  
  if (totalBundleSize > config.maxBundleSize) {
    issues.push({
      type: 'bundle_size',
      message: `Bundle size (${bundleSizeMB} MB) exceeds limit (${(config.maxBundleSize / (1024 * 1024)).toFixed(0)} MB)`,
      severity: 'error',
    });
  }
  
  if (totalSize > config.maxDependencySize) {
    issues.push({
      type: 'dependency_size',
      message: `Total dependency size (${totalSizeMB} MB) exceeds limit (${(config.maxDependencySize / (1024 * 1024)).toFixed(0)} MB)`,
      severity: 'error',
    });
  }
  
  // Check bundle growth (only in CI or with --ci-mode)
  if (CI_MODE) {
    const growthIssues = checkBundleGrowth(totalBundleSize);
    issues.push(...growthIssues);
  }
  
  // Add heavy dependency issues
  for (const dep of heavyDeps) {
    if (dep.severity === 'error') {
      issues.push({
        type: 'heavy_dependency',
        message: `${dep.name} (${dep.sizeMB} MB): ${dep.reason}`,
        severity: dep.severity,
      });
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 Summary:');
  console.log('='.repeat(50));
  
  if (issues.length === 0) {
    console.log('   ✅ All checks passed!');
    console.log(`   Bundle size: ${bundleSizeMB} MB`);
    console.log(`   Dependencies: ${totalSizeMB} MB`);
    process.exit(0);
  } else {
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    
    if (errors.length > 0) {
      console.log(`\n   ❌ ${errors.length} Error(s):`);
      for (const issue of errors) {
        console.log(`      - ${issue.message}`);
      }
    }
    
    if (warnings.length > 0) {
      console.log(`\n   ⚠️  ${warnings.length} Warning(s):`);
      for (const issue of warnings) {
        console.log(`      - ${issue.message}`);
      }
    }
    
    if (CI_MODE) {
      process.exit(errors.length > 0 ? 1 : 0);
    } else {
      console.log('\n   Run with --ci-mode to enforce limits in CI/CD');
      process.exit(0);
    }
  }
}

// Run if called directly
if (require.main === module) {
  runAnalysis();
}

module.exports = {
  runAnalysis,
  loadConfig,
  getDependencies,
  calculateDependencySize,
  analyzeHeavyDependencies,
  getBundleSizes,
  calculateBundleSize,
  checkBundleGrowth,
};
