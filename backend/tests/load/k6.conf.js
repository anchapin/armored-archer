import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { summary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Import all scenarios
import concurrent_players from './scenarios/concurrent_players.js';
import mixed_workload_enhanced from './scenarios/mixed_workload_enhanced.js';

// Custom metrics
const errorRate = new Rate('errors');
const rpcLatency = new Trend('rpc_latency');

// Nakama configuration
const BASE_URL = __ENV.NAKAMA_URL || (() => {
    throw new Error('NAKAMA_URL environment variable is required. Set it via: --env NAKAMA_URL=http://host:port');
})();
const TEST_DURATION = __ENV.TEST_DURATION || '10m';

// Scenario configuration for running all load tests
export const options = {
  scenarios: {
    // Scenario 1: Concurrent players - ramp-up to 150 users
    concurrent_players: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '5m', target: 150 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'concurrentPlayersScenario',
    },

    // Scenario 2: Mixed workload - realistic traffic pattern
    mixed_workload: {
      executor: 'constant-vus',
      vus: 100,
      duration: '10m',
      gracefulRampDown: '30s',
      exec: 'mixedWorkloadScenario',
    },
  },

  thresholds: {
    // Global thresholds applied to all scenarios
    'errors': ['rate<0.01'],
    'http_req_duration': ['p(95)<200', 'p(99)<500'],
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

// Helper function for RPC calls
function callRpc(endpoint, payload, authToken) {
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
  });

  errorRate.add(!success);
  rpcLatency.add(response.timings.duration);

  return {
    success,
    status: response.status,
    body: response.json(),
    duration: response.timings.duration,
  };
}

// Scenario 1: Concurrent players
export function concurrentPlayersScenario() {
  const token = authenticate('user1@test.com', 'password123');

  // Traffic pattern: 70% stats, 20% leaderboard, 10% feedback
  const rand = Math.random();

  if (rand < 0.7) {
    callRpc('get_player_stats', {}, token);
    sleep(1);
  } else if (rand < 0.9) {
    callRpc('get_leaderboard', { season_id: 'season_1', limit: 100 }, token);
    sleep(1);
  } else {
    callRpc('submit_feedback', {
      category: 'bug_report',
      title: `Test feedback ${Date.now()}`,
      description: 'Load test feedback',
      priority: 'medium',
    }, token);
    sleep(2);
  }
}

// Scenario 2: Mixed workload with realistic traffic
export function mixedWorkloadScenario() {
  const token = authenticate('user1@test.com', 'password123');

  // Realistic traffic distribution
  const rand = Math.random();

  if (rand < 0.4) {
    // 40% - Get player stats
    callRpc('get_player_stats', {}, token);
    sleep(1);
  } else if (rand < 0.7) {
    // 30% - Get leaderboard
    const limit = [10, 50, 100][Math.floor(Math.random() * 3)];
    callRpc('get_leaderboard', { season_id: 'season_1', limit: limit }, token);
    sleep(2);
  } else if (rand < 0.85) {
    // 15% - Get inventory
    callRpc('get_inventory', {}, token);
    sleep(1);
  } else if (rand < 0.95) {
    // 10% - Submit feedback (write)
    const category = ['bug_report', 'feature_request', 'balance'][Math.floor(Math.random() * 3)];
    callRpc('submit_feedback', {
      category: category,
      title: `Test feedback ${Date.now()}`,
      description: `Load test feedback - ${category}`,
      priority: 'medium',
    }, token);
    sleep(2);
  } else {
    // 5% - Get season info
    callRpc('get_season_info', {}, token);
    sleep(1);
  }
}

// Handle summary - export JSON for CI parsing
export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: summary(data, { indent: ' ', enableColors: true }),
  };
}
