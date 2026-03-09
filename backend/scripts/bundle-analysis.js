#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get project root (backend folder - go up one level from scripts)
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CONFIG_FILE = path.join(PROJECT_ROOT, 'bundle-size-limits.json');
const SIZE_HISTORY_FILE = path.join(PROJECT_ROOT, '.bundle-size-history.json');
const CI_MODE = process.argv.includes('--ci-mode');

const DEFAULT_LIMITS = {
  maxBundleSize: 2 * 1024 * 1024,
  maxDependencySize: 838860800,
  maxFileSize: 500 * 1024,
  warnings: {
    bundleSizeGrowthPercent: 10,
    heavyDependencySize: 2 * 1024 * 1024,
  },
};

const HEAVY_DEPENDENCY_PATTERNS = [
  { pattern: /@sentry/, reason: 'Sentry is large', suggested: 'Use selective imports' },
  { pattern: /winston/, reason: 'Logging library', suggested: 'Consider pino or abstract logging' },
  { pattern: /prom-client/, reason: 'Prometheus client', suggested: 'Verify needed metrics only' },
  { pattern: /zod/, reason: 'Validation library', suggested: 'Consider lighter alternatives' },
  { pattern: /@heroiclabs/, reason: 'Nakama client', suggested: 'Verify only needed modules are imported' },
];

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    return { ...DEFAULT_LIMITS, ...config };
  }
  return DEFAULT_LIMITS;
}

function calculateDependencySize() {
  const nodeModulesDir = path.join(PROJECT_ROOT, 'node_modules');
  let totalSize = 0;
  const packageSizes = {};

  function calculateDirSize(dirPath) {
    let size = 0;
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            size += calculateDirSize(filePath);
          } else {
            size += stat.size;
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    return size;
  }

  if (fs.existsSync(nodeModulesDir)) {
    try {
      const entries = fs.readdirSync(nodeModulesDir);
      for (const entry of entries) {
        const entryPath = path.join(nodeModulesDir, entry);
        try {
          const stat = fs.statSync(entryPath);
          if (stat.isDirectory()) {
            const packageJsonPath = path.join(entryPath, 'package.json');
            let packageName = entry;

            if (fs.existsSync(packageJsonPath)) {
              try {
                const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                packageName = pkgJson.name || entry;
              } catch { /* use entry */ }
            }

            const size = calculateDirSize(entryPath);
            packageSizes[packageName] = size;
            totalSize += size;
          }
        } catch { /* skip */ }
      }
    } catch {
      totalSize = calculateDirSize(nodeModulesDir);
    }
  }

  return { totalSize, packageSizes };
}

function analyzeHeavyDependencies(packageSizes, config) {
  const issues = [];
  const heavyDepLimit = config?.warnings?.heavyDependencySize || DEFAULT_LIMITS.warnings.heavyDependencySize;

  for (const [name, size] of Object.entries(packageSizes)) {
    // Check if dependency is excluded
    const isExcluded = (config?.excludedDependencies || []).some(pattern => {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return name.startsWith(prefix);
      }
      return name === pattern;
    });
    if (isExcluded) continue;

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
          severity: size > heavyDepLimit ? 'error' : 'warning',
        });
      }
    }
  }

  return issues;
}

function getBundleSizes() {
  const buildDir = path.join(PROJECT_ROOT, 'build');
  const sizes = [];

  if (!fs.existsSync(buildDir)) {
    return sizes;
  }

  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        sizes.push({
          name: path.relative(buildDir, filePath),
          size: stat.size,
        });
      }
    }
  }

  walkDir(buildDir);
  return sizes.sort((a, b) => b.size - a.size);
}

function loadHistory() {
  if (fs.existsSync(SIZE_HISTORY_FILE)) {
    return JSON.parse(fs.readFileSync(SIZE_HISTORY_FILE, 'utf-8'));
  }
  return [];
}

function saveHistory(history) {
  fs.writeFileSync(SIZE_HISTORY_FILE, JSON.stringify(history, null, 2));
}

function checkSizeGrowth(currentSize, history) {
  if (history.length === 0) {
    return null;
  }

  const lastEntry = history[history.length - 1];
  const growthPercent = ((currentSize - lastEntry.bundleSize) / lastEntry.bundleSize) * 100;

  if (growthPercent > DEFAULT_LIMITS.warnings.bundleSizeGrowthPercent) {
    return {
      type: 'size_growth',
      severity: 'warning',
      message: 'Bundle size grew by ' + growthPercent.toFixed(1) + '% since last build',
      percent: growthPercent,
    };
  }

  return null;
}

async function runAnalysis() {
  console.log('Bundle Size Analysis');
  console.log('==================================================');

  const config = loadConfig();

  console.log('Analyzing npm dependencies...');
  const { totalSize, packageSizes } = calculateDependencySize();
  const depSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  console.log('   Total dependency size: ' + depSizeMB + ' MB');

  const heavyDeps = analyzeHeavyDependencies(packageSizes, config);
  if (heavyDeps.length > 0) {
    console.log('Heavy dependencies detected:');
    for (const dep of heavyDeps) {
      const prefix = dep.severity === 'error' ? '[ERROR]' : '[WARNING]';
      console.log('   ' + prefix + ' ' + dep.name + ': ' + dep.sizeMB + ' MB');
      console.log('      Reason: ' + dep.reason);
      console.log('      Suggestion: ' + dep.suggested);
    }
  }

  console.log('Analyzing build output...');
  const bundleSizes = getBundleSizes();
  const totalBundleSize = bundleSizes.reduce((sum, f) => sum + f.size, 0);
  const bundleSizeMB = (totalBundleSize / (1024 * 1024)).toFixed(2);
  console.log('   Total bundle size: ' + bundleSizeMB + ' MB');

  if (bundleSizes.length > 0) {
    console.log('Largest files:');
    for (const file of bundleSizes.slice(0, 5)) {
      const sizeKB = (file.size / 1024).toFixed(2);
      console.log('      ' + file.name + ': ' + sizeKB + ' KB');
    }
  }

  console.log('Checking size limits...');
  const issues = [];

  if (totalBundleSize > config.maxBundleSize) {
    const sizeMB = (totalBundleSize / (1024 * 1024)).toFixed(2);
    const limitMB = (config.maxBundleSize / (1024 * 1024)).toFixed(2);
    issues.push({
      type: 'bundle_size',
      severity: 'error',
      message: 'Total bundle size (' + sizeMB + ' MB) exceeds limit (' + limitMB + ' MB)',
    });
  }

  if (totalSize > config.maxDependencySize) {
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    const limitMB = (config.maxDependencySize / (1024 * 1024)).toFixed(2);
    issues.push({
      type: 'dependency_size',
      severity: 'error',
      message: 'Total dependency size (' + sizeMB + ' MB) exceeds limit (' + limitMB + ' MB)',
    });
  }

  for (const dep of heavyDeps) {
    if (dep.severity === 'error') {
      issues.push({
        type: 'heavy_dependency',
        severity: 'error',
        message: dep.name + ' (' + dep.sizeMB + ' MB): ' + dep.reason,
      });
    }
  }

  const history = loadHistory();
  const growthWarning = checkSizeGrowth(totalBundleSize, history);
  if (growthWarning) {
    issues.push(growthWarning);
  }

  console.log('==================================================');
  console.log('Summary:');
  console.log('==================================================');

  if (issues.length === 0) {
    console.log('   All checks passed!');
    console.log('   Bundle size: ' + bundleSizeMB + ' MB');
    console.log('   Dependencies: ' + depSizeMB + ' MB');
  } else {
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    if (errors.length > 0) {
      console.log('   ' + errors.length + ' Error(s):');
      for (const issue of errors) {
        console.log('      - ' + issue.message);
      }
    }

    if (warnings.length > 0) {
      console.log('   ' + warnings.length + ' Warning(s):');
      for (const issue of warnings) {
        console.log('      - ' + issue.message);
      }
    }
  }

  const gitCommit = process.env.GIT_COMMIT;
  if (CI_MODE || gitCommit) {
    history.push({
      date: new Date().toISOString(),
      commit: gitCommit || 'unknown',
      bundleSize: totalBundleSize,
      dependencySize: totalSize,
    });

    if (history.length > 30) {
      history.shift();
    }

    saveHistory(history);
    console.log('Size history updated (' + history.length + ' entries)');
  }

  if (CI_MODE) {
    const errors = issues.filter(i => i.severity === 'error');
    if (errors.length > 0) {
      console.log('CI Mode: Failing due to errors');
      process.exit(1);
    }
  }

  console.log('Run with --ci-mode to enforce limits in CI/CD');
}

runAnalysis().catch(console.error);
