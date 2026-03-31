/**
 * Custom Jest Performance Reporter
 * 
 * Tracks test execution times and detects performance regressions.
 * Outputs detailed performance metrics and warnings when thresholds are exceeded.
 */

const fs = require('fs');
const path = require('path');

// Configuration for performance thresholds (in milliseconds)
const DEFAULT_THRESHOLDS = {
  // Individual test should not take longer than 5 seconds
  test: 5000,
  // Suite should not take longer than 30 seconds
  suite: 30000,
  // Total test run should not exceed 2 minutes
  total: 120000,
  // Warn if any single test exceeds 2 seconds (potential optimization needed)
  warning: 2000
};

class PerformanceReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options || {};
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...this.options.thresholds
    };
    
    this.startTime = null;
    this.testResults = [];
    this.suiteTimes = new Map();
    this.performanceData = {
      tests: [],
      suites: [],
      totalTime: 0,
      slowestTests: [],
      regressions: []
    };
    
    // Performance log file path
    this.logDir = path.join(process.cwd(), 'performance-logs');
    this.logFile = path.join(this.logDir, `performance-${Date.now()}.json`);
  }

  onTestStart(test) {
    test._startTime = Date.now();
  }

  onTestResult(test, testResult) {
    const duration = Date.now() - testResult._startTime;
    
    const testData = {
      name: testResult.name,
      fullName: testResult.fullName,
      status: testResult.status,
      duration: duration,
      suite: testResult.testPath.slice(0, -1).join('/'),
      file: testResult.testPath[testResult.testPath.length - 1]
    };
    
    this.performanceData.tests.push(testData);
    
    // Track suite times
    const suiteName = testData.suite;
    if (!this.suiteTimes.has(suiteName)) {
      this.suiteTimes.set(suiteName, 0);
    }
    this.suiteTimes.set(suiteName, this.suiteTimes.get(suiteName) + duration);
    
    // Check for regressions
    if (duration > this.thresholds.test) {
      this.performanceData.regressions.push({
        type: 'slow_test',
        name: testData.fullName,
        duration: duration,
        threshold: this.thresholds.test,
        message: `Test exceeded threshold: ${duration}ms > ${this.thresholds.test}ms`
      });
    }
    
    if (duration > this.thresholds.warning) {
      this.performanceData.regressions.push({
        type: 'warning',
        name: testData.fullName,
        duration: duration,
        threshold: this.thresholds.warning,
        message: `Test performance warning: ${duration}ms > ${this.thresholds.warning}ms`
      });
    }
  }

  onRunStart(results, options) {
    this.startTime = Date.now();
    console.log('\n📊 Performance Reporter: Starting test run...\n');
  }

  onRunComplete(testContexts, results) {
    const totalTime = Date.now() - this.startTime;
    this.performanceData.totalTime = totalTime;
    
    // Calculate suite statistics
    for (const [suiteName, duration] of this.suiteTimes) {
      this.performanceData.suites.push({
        name: suiteName,
        duration: duration
      });
      
      // Check suite threshold
      if (duration > this.thresholds.suite) {
        this.performanceData.regressions.push({
          type: 'slow_suite',
          name: suiteName,
          duration: duration,
          threshold: this.thresholds.suite,
          message: `Suite exceeded threshold: ${duration}ms > ${this.thresholds.suite}ms`
        });
      }
    }
    
    // Find slowest tests
    this.performanceData.slowestTests = [...this.performanceData.tests]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    // Check total time threshold
    if (totalTime > this.thresholds.total) {
      this.performanceData.regressions.push({
        type: 'slow_total',
        name: 'Total Test Run',
        duration: totalTime,
        threshold: this.thresholds.total,
        message: `Total test time exceeded threshold: ${totalTime}ms > ${this.thresholds.total}ms`
      });
    }
    
    // Output performance report
    this.outputPerformanceReport(results);
    
    // Save performance data to file
    this.savePerformanceData();
    
    // Exit with error code if regressions detected
    if (this.performanceData.regressions.length > 0) {
      console.log('\n⚠️  Performance regressions detected! See details above.\n');
      // Note: We don't fail the build by default, just warn
      // Uncomment the next line to fail on regression:
      // process.exit(1);
    }
  }

  outputPerformanceReport(results) {
    const { testResults, numTotalTests, numPassedTests, numFailedTests, numPendingTests } = results;
    
    console.log('='.repeat(60));
    console.log('📈 JEST PERFORMANCE REPORT');
    console.log('='.repeat(60));
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Total Tests: ${numTotalTests}`);
    console.log(`   Passed: ${numPassedTests} ✅`);
    console.log(`   Failed: ${numFailedTests} ❌`);
    console.log(`   Pending: ${numPendingTests} ⏸️`);
    console.log(`   Total Time: ${(this.performanceData.totalTime / 1000).toFixed(2)}s`);
    
    // Performance thresholds
    console.log('\n📏 PERFORMANCE THRESHOLDS:');
    console.log(`   Test threshold: ${this.thresholds.test}ms`);
    console.log(`   Suite threshold: ${this.thresholds.suite}ms`);
    console.log(`   Total threshold: ${this.thresholds.total}ms`);
    console.log(`   Warning threshold: ${this.thresholds.warning}ms`);
    
    // Slowest tests
    if (this.performanceData.slowestTests.length > 0) {
      console.log('\n🐢 SLOWEST TESTS (Top 10):');
      this.performanceData.slowestTests.forEach((test, index) => {
        const duration = test.duration.toFixed(2);
        const status = test.duration > this.thresholds.test ? '🔴' : (test.duration > this.thresholds.warning ? '🟡' : '🟢');
        console.log(`   ${index + 1}. ${status} ${test.name} - ${duration}ms`);
      });
    }
    
    // Performance regressions
    if (this.performanceData.regressions.length > 0) {
      console.log('\n⚠️  PERFORMANCE REGRESSIONS:');
      
      // Group by type
      const byType = {};
      this.performanceData.regressions.forEach(reg => {
        if (!byType[reg.type]) byType[reg.type] = [];
        byType[reg.type].push(reg);
      });
      
      for (const [type, regs] of Object.entries(byType)) {
        console.log(`\n   ${type.toUpperCase()} (${regs.length}):`);
        regs.forEach(reg => {
          console.log(`   - ${reg.name}: ${reg.duration}ms (threshold: ${reg.threshold}ms)`);
        });
      }
    } else {
      console.log('\n✅ No performance regressions detected!');
    }
    
    // Average test time
    if (this.performanceData.tests.length > 0) {
      const avgTime = this.performanceData.tests.reduce((sum, t) => sum + t.duration, 0) / this.performanceData.tests.length;
      console.log(`\n📉 Average test time: ${avgTime.toFixed(2)}ms`);
    }
    
    console.log('\n' + '='.repeat(60));
  }

  savePerformanceData() {
    try {
      // Ensure log directory exists
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      
      // Add metadata to performance data
      const output = {
        timestamp: new Date().toISOString(),
        thresholds: this.thresholds,
        summary: {
          totalTime: this.performanceData.totalTime,
          totalTests: this.performanceData.tests.length,
          suites: this.performanceData.suites.length,
          regressions: this.performanceData.regressions.length
        },
        data: this.performanceData
      };
      
      fs.writeFileSync(this.logFile, JSON.stringify(output, null, 2));
      console.log(`\n💾 Performance data saved to: ${this.logFile}\n`);
    } catch (error) {
      console.error(`\n❌ Failed to save performance data: ${error.message}\n`);
    }
  }
}

module.exports = PerformanceReporter;
