#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * 
 * This script analyzes the bundle size, compares against limits,
 * and tracks bundle size over time for CI/CD integration.
 * 
 * Usage:
 *   node scripts/bundle-analysis.js           - Check bundle size against limits
 *   node scripts/bundle-analysis.js --ci-mode - CI mode with detailed output
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_LIMITS = {
  main: 500 * 1024,      // 500KB - main bundle size limit
  vendor: 1024 * 1024,   // 1MB - vendor chunk size limit
  total: 2 * 1024 * 1024 // 2MB - total bundle size limit
};

const HISTORY_FILE = '.bundle-size-history.json';
const CI_MODE = process.argv.includes('--ci-mode');
const GIT_COMMIT = process.env.GIT_COMMIT || 'unknown';

/**
 * Get bundle size from webpack stats
 */
function getBundleSize() {
  const statsPath = path.join(__dirname, 'bundle-stats.json');
  
  if (!fs.existsSync(statsPath)) {
    // Fallback: estimate from build output
    const buildDir = path.join(__dirname, 'build');
    if (fs.existsSync(buildDir)) {
      const files = fs.readdirSync(buildDir);
      let totalSize = 0;
      files.forEach(file => {
        const filePath = path.join(buildDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          totalSize += stat.size;
        }
      });
      return {
        main: totalSize,
        vendor: 0,
        total: totalSize,
        source: 'build-directory'
      };
    }
    return null;
  }

  try {
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    const assets = stats.assets || [];
    
    let mainSize = 0;
    let vendorSize = 0;
    
    assets.forEach(asset => {
      if (asset.name.includes('vendor')) {
        vendorSize += asset.size;
      } else if (asset.name.includes('bundle') || asset.name.endsWith('.js')) {
        mainSize += asset.size;
      }
    });

    return {
      main: mainSize || stats.assetsSize || 0,
      vendor: vendorSize,
      total: mainSize + vendorSize,
      source: 'webpack-stats'
    };
  } catch (error) {
    console.error('Error reading bundle stats:', error.message);
    return null;
  }
}

/**
 * Load bundle size history
 */
function loadHistory() {
  const historyPath = path.join(__dirname, HISTORY_FILE);
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Save bundle size history
 */
function saveHistory(history) {
  const historyPath = path.join(__dirname, HISTORY_FILE);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if bundle size exceeds limits
 */
function checkLimits(bundleSize) {
  const warnings = [];
  const errors = [];

  if (bundleSize.main > BUNDLE_LIMITS.main) {
    const percentOver = ((bundleSize.main - BUNDLE_LIMITS.main) / BUNDLE_LIMITS.main * 100).toFixed(1);
    errors.push(`Main bundle (${formatBytes(bundleSize.main)}) exceeds limit (${formatBytes(BUNDLE_LIMITS.main)}) by ${percentOver}%`);
  }

  if (bundleSize.vendor > BUNDLE_LIMITS.vendor) {
    const percentOver = ((bundleSize.vendor - BUNDLE_LIMITS.vendor) / BUNDLE_LIMITS.vendor * 100).toFixed(1);
    warnings.push(`Vendor chunk (${formatBytes(bundleSize.vendor)}) exceeds soft limit (${formatBytes(BUNDLE_LIMITS.vendor)}) by ${percentOver}%`);
  }

  if (bundleSize.total > BUNDLE_LIMITS.total) {
    const percentOver = ((bundleSize.total - BUNDLE_LIMITS.total) / BUNDLE_LIMITS.total * 100).toFixed(1);
    errors.push(`Total bundle (${formatBytes(bundleSize.total)}) exceeds limit (${formatBytes(BUNDLE_LIMITS.total)}) by ${percentOver}%`);
  }

  return { warnings, errors };
}

/**
 * Get large dependencies from bundle stats
 */
function getLargeDependencies() {
  const statsPath = path.join(__dirname, 'bundle-stats.json');
  if (!fs.existsSync(statsPath)) {
    return [];
  }

  try {
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    const modules = stats.modules || [];
    
    const dependencySizes = [];
    modules.forEach(module => {
      if (module.name && module.size) {
        // Filter to node_modules
        if (module.name.includes('node_modules')) {
          // Extract package name
          const match = module.name.match(/node_modules[/\\](@[^/]+[/\\])?[^/]+/);
          if (match) {
            const pkgName = match[0].replace(/node_modules[/\\]/, '').replace(/[/\\]/g, '/');
            const existing = dependencySizes.find(d => d.name === pkgName);
            if (existing) {
              existing.size += module.size;
            } else {
              dependencySizes.push({ name: pkgName, size: module.size });
            }
          }
        }
      }
    });

    // Sort by size and return top 10
    return dependencySizes
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map(d => ({
        ...d,
        formattedSize: formatBytes(d.size)
      }));
  } catch {
    return [];
  }
}

/**
 * Main function
 */
function main() {
  console.log('='.repeat(60));
  console.log('Bundle Size Analysis');
  console.log('='.repeat(60));

  const bundleSize = getBundleSize();
  
  if (!bundleSize) {
    console.log('\n⚠️  No bundle data found. Run "npm run build" first.\n');
    process.exit(0);
  }

  console.log('\n📦 Bundle Sizes:');
  console.log(`   Main:   ${formatBytes(bundleSize.main)}`);
  console.log(`   Vendor: ${formatBytes(bundleSize.vendor)}`);
  console.log(`   Total:  ${formatBytes(bundleSize.total)}`);

  // Check limits
  const { warnings, errors } = checkLimits(bundleSize);

  console.log('\n📏 Size Limits:');
  console.log(`   Main:   ${formatBytes(BUNDLE_LIMITS.main)} (limit)`);
  console.log(`   Vendor: ${formatBytes(BUNDLE_LIMITS.vendor)} (soft limit)`);
  console.log(`   Total:  ${formatBytes(BUNDLE_LIMITS.total)} (limit)`);

  // Get large dependencies
  const largeDeps = getLargeDependencies();
  if (largeDeps.length > 0) {
    console.log('\n📦 Top Dependencies:');
    largeDeps.forEach((dep, i) => {
      console.log(`   ${i + 1}. ${dep.name}: ${dep.formattedSize}`);
    });
  }

  // Update history
  const history = loadHistory();
  history.push({
    timestamp: new Date().toISOString(),
    commit: GIT_COMMIT,
    main: bundleSize.main,
    vendor: bundleSize.vendor,
    total: bundleSize.total,
  });

  // Keep only last 100 entries
  const trimmedHistory = history.slice(-100);
  saveHistory(trimmedHistory);

  // Show trend if we have history
  if (trimmedHistory.length > 1) {
    const prev = trimmedHistory[trimmedHistory.length - 2];
    const curr = trimmedHistory[trimmedHistory.length - 1];
    const mainDiff = curr.main - prev.main;
    const totalDiff = curr.total - prev.total;

    console.log('\n📈 Bundle Size Trend:');
    console.log(`   Main:   ${mainDiff >= 0 ? '+' : ''}${formatBytes(mainDiff)}`);
    console.log(`   Total:  ${totalDiff >= 0 ? '+' : ''}${formatBytes(totalDiff)}`);
  }

  // Output results
  console.log('\n' + '='.repeat(60));

  if (errors.length > 0) {
    console.log('\n❌ Bundle Size Errors:');
    errors.forEach(err => console.log(`   ${err}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Bundle Size Warnings:');
    warnings.forEach(warn => console.log(`   ${warn}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ Bundle size is within limits!');
  }

  console.log('='.repeat(60));

  // Exit with error code if there are errors
  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
