#!/usr/bin/env node
/**
 * CI gate for k6 load-test summaries (issue #1347).
 *
 * Reads k6 --summary-export JSON files from the working directory and fails
 * (exit 1) when any scenario breaches its contract: p95 < 100ms and error
 * rate < 1%. k6 thresholds enforce the same limits natively; this step is
 * the readable second signal consumed by the workflow gate and PR comment.
 */
const fs = require('fs');

const P95_LIMIT_MS = 100;
const ERROR_RATE_LIMIT = 0.01;

const scenarios = [
  { file: 'player-stats-results.json', metric: 'get_player_stats_latency' },
  { file: 'leaderboard-results.json', metric: 'get_leaderboard_latency' },
  { file: 'mixed-workload-results.json', metric: 'mixed_workload_latency' },
];

let failed = false;
const rows = [];

for (const scenario of scenarios) {
  if (!fs.existsSync(scenario.file)) {
    rows.push(`${scenario.file}: MISSING`);
    failed = true;
    continue;
  }
  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(scenario.file, 'utf8'));
  } catch (err) {
    rows.push(`${scenario.file}: UNPARSEABLE (${err.message})`);
    failed = true;
    continue;
  }
  const latencyMetric = summary.metrics[scenario.metric] || summary.metrics.http_req_duration;
  const errorMetric = summary.metrics.errors;
  if (!latencyMetric || !latencyMetric.values || typeof latencyMetric.values['p(95)'] !== 'number') {
    rows.push(`${scenario.file}: missing ${scenario.metric} p(95)`);
    failed = true;
    continue;
  }
  const p95 = latencyMetric.values['p(95)'];
  const rate = errorMetric && errorMetric.values ? errorMetric.values.rate || 0 : null;
  if (rate === null) {
    rows.push(`${scenario.file}: missing errors rate`);
    failed = true;
    continue;
  }
  const ok = p95 < P95_LIMIT_MS && rate < ERROR_RATE_LIMIT;
  if (!ok) failed = true;
  rows.push(
    `${scenario.file}: p95=${p95.toFixed(1)}ms (<${P95_LIMIT_MS}), errors=${(rate * 100).toFixed(2)}% (<${ERROR_RATE_LIMIT * 100}%) -> ${ok ? 'PASS' : 'FAIL'}`
  );
}

console.log('Load test results:');
for (const row of rows) console.log('  ' + row);
process.exit(failed ? 1 : 0);
