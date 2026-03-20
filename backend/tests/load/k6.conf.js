import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const rpcLatency = new Trend('rpc_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '3m', target: 500 },  // Ramp up to 500 users (beta-scale)
    { duration: '5m', target: 500 },  // Stay at 500 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'errors': ['rate<0.01'],           // Error rate < 1%
    'http_req_duration': ['p(95)<100'], // P95 latency < 100ms
    'rpc_latency': ['p(95)<100'],      // RPC P95 < 100ms
  },
};

// Nakama configuration
const BASE_URL = __ENV.NAKAMA_URL || 'http://localhost:7350';
const NAKAMA_SERVER_KEY = __ENV.NAKAMA_SERVER_KEY || 'defaultkey';

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

// Helper function for authentication
function authenticate(email, password) {
  const url = `${BASE_URL}/v2/account/authenticate/email?create=false`;
  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const response = http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status !== 200) {
    throw new Error(`Authentication failed: ${response.status}`);
  }

  return response.json().token;
}

// Setup: Create test users
export function setup() {
  // For now, use existing test users
  // In production, you'd create test users here
  return {
    users: [
      { email: 'user1@test.com', password: 'password123' },
      { email: 'user2@test.com', password: 'password123' },
      // Add more test users as needed
    ],
  };
}

// Main test scenario
export default function(data) {
  // Pick a random user
  const user = data.users[Math.floor(Math.random() * data.users.length)];

  // Authenticate
  const token = authenticate(user.email, user.password);

  // Scenario 1: Get player stats (hot-path, should be cached)
  const statsResponse = callRpc('get_player_stats', {}, token);
  check(statsResponse, {
    'get_player_stats success': (r) => r.success,
  });

  sleep(1);

  // Scenario 2: Get season info (should be cached globally)
  const seasonResponse = callRpc('get_season_info', {}, token);
  check(seasonResponse, {
    'get_season_info success': (r) => r.success,
  });

  sleep(1);

  // Scenario 3: Get leaderboard (should be cached per season)
  const leaderboardResponse = callRpc('get_leaderboard', {
    season_id: 'season_1',
    limit: 100,
  }, token);
  check(leaderboardResponse, {
    'get_leaderboard success': (r) => r.success,
  });

  sleep(1);

  // Scenario 4: Submit feedback (write operation, invalidates cache)
  const feedbackResponse = callRpc('submit_feedback', {
    category: 'bug_report',
    title: `Test feedback ${Date.now()}`,
    description: 'Load test feedback',
    priority: 'medium',
  }, token);
  check(feedbackResponse, {
    'submit_feedback success': (r) => r.success,
  });

  sleep(2);
}

// Teardown: Cleanup
export function teardown(data) {
  console.log('Load test completed');
}
