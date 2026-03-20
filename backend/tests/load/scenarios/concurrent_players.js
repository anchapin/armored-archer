import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for tracking per-RPC latency
const errorRate = new Rate('errors');
const statsLatency = new Trend('get_player_stats_latency');
const leaderboardLatency = new Trend('get_leaderboard_latency');
const feedbackLatency = new Trend('submit_feedback_latency');

// Nakama configuration
const BASE_URL = __ENV.NAKAMA_URL || 'http://localhost:7350';

// Stages configuration - 5 stages for gradual ramp-up and sustained load
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users (PERF-03 requirement)
    { duration: '5m', target: 150 },  // Ramp up to 150 users (exceeds requirement)
    { duration: '2m', target: 50 },   // Ramp down to 50 users
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    // Error rate < 1%
    'errors': ['rate<0.01'],
    // P95 latency < 200ms
    'http_req_duration': ['p(95)<200'],
    // P99 latency < 500ms
    'http_req_duration': ['p(99)<500'],
    // Per-RPC latency thresholds
    'get_player_stats_latency': ['p(95)<200'],
    'get_leaderboard_latency': ['p(95)<200'],
    'submit_feedback_latency': ['p(95)<300'],
  },
};

// Helper function for authentication
function authenticate(email, password) {
  const response = http.post(
    `${BASE_URL}/v2/account/authenticate/email?create=false`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (response.status !== 200) {
    throw new Error(`Authentication failed: ${response.status} ${response.body}`);
  }

  return response.json().token;
}

// Helper function for RPC calls with metrics
function callRpc(endpoint, payload, authToken, metric) {
  const url = `${BASE_URL}/v2/rpc/${endpoint}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  };

  const response = http.post(url, JSON.stringify(payload), params);
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has payload': (r) => r.json().payload !== undefined,
  });

  errorRate.add(!success);
  metric.add(response.timings.duration);

  return {
    success,
    status: response.status,
    body: response.json(),
    duration: response.timings.duration,
  };
}

// Main test scenario
export default function() {
  // Authenticate once per VU
  const token = authenticate('user1@test.com', 'password123');

  // Traffic pattern: 70% get_player_stats, 20% get_leaderboard, 10% submit_feedback
  const rand = Math.random();

  if (rand < 0.7) {
    // 70% - Get player stats (most common operation)
    const response = callRpc('get_player_stats', {}, token, statsLatency);
    check(response, {
      'get_player_stats success': (r) => r.success,
      'get_player_stats has data': (r) => r.body.payload !== undefined,
    });
    sleep(Math.random() * 1 + 1); // 1-2 seconds think time
  } else if (rand < 0.9) {
    // 20% - Get leaderboard
    const response = callRpc('get_leaderboard', {
      season_id: 'season_1',
      limit: 100,
    }, token, leaderboardLatency);
    check(response, {
      'get_leaderboard success': (r) => r.success,
      'get_leaderboard has data': (r) => r.body.payload !== undefined,
    });
    sleep(Math.random() * 1 + 1); // 1-2 seconds think time
  } else {
    // 10% - Submit feedback (write operation)
    const response = callRpc('submit_feedback', {
      category: 'bug_report',
      title: `Load test feedback ${Date.now()}`,
      description: 'Automated feedback from concurrent_players load test',
      priority: 'medium',
    }, token, feedbackLatency);
    check(response, {
      'submit_feedback success': (r) => r.success,
    });
    sleep(Math.random() * 1 + 2); // 2-3 seconds think time for writes
  }
}
