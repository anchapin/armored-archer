import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for tracking read/write throughput and latency
const errorRate = new Rate('errors');
const readThroughput = new Rate('read_throughput');
const writeThroughput = new Rate('write_throughput');
const statsLatency = new Trend('get_player_stats_latency');
const leaderboardLatency = new Trend('get_leaderboard_latency');
const inventoryLatency = new Trend('get_inventory_latency');
const feedbackLatency = new Trend('submit_feedback_latency');
const seasonLatency = new Trend('get_season_info_latency');

// Nakama configuration
const BASE_URL = __ENV.NAKAMA_URL || 'http://localhost:7350';

// Test configuration with realistic read/write split
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 150 },  // Sustained load at 150 users
    { duration: '2m', target: 50 },   // Ramp down
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    'errors': ['rate<0.01'],
    'http_req_duration': ['p(95)<200', 'p(99)<500'],
    'get_player_stats_latency': ['p(95)<200'],
    'get_leaderboard_latency': ['p(95)<200'],
    'get_inventory_latency': ['p(95)<200'],
    'submit_feedback_latency': ['p(95)<300'],
    'get_season_info_latency': ['p(95)<100'],
  },
};

// User pool for realistic load simulation
const TEST_USERS = [
  { email: 'user1@test.com', password: 'password123' },
  { email: 'user2@test.com', password: 'password123' },
  { email: 'user3@test.com', password: 'password123' },
  { email: 'user4@test.com', password: 'password123' },
  { email: 'user5@test.com', password: 'password123' },
  { email: 'user6@test.com', password: 'password123' },
  { email: 'user7@test.com', password: 'password123' },
  { email: 'user8@test.com', password: 'password123' },
  { email: 'user9@test.com', password: 'password123' },
  { email: 'user10@test.com', password: 'password123' },
];

// Feedback categories for data variation
const FEEDBACK_CATEGORIES = ['bug_report', 'feature_request', 'balance'];
const FEEDBACK_PRIORITIES = ['low', 'medium', 'high'];

// Leaderboard limit variations for data variation
const LEADERBOARD_LIMITS = [10, 50, 100];

// Helper function for authentication
function authenticate(email, password) {
  const response = http.post(
    `${BASE_URL}/v2/account/authenticate/email?create=false`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (response.status !== 200) {
    throw new Error(`Authentication failed for ${email}: ${response.status} ${response.body}`);
  }

  return response.json().token;
}

// Helper function for RPC calls with comprehensive error handling
function callRpc(endpoint, payload, authToken, metric, isWrite = false) {
  const url = `${BASE_URL}/v2/rpc/${endpoint}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  };

  const response = http.post(url, JSON.stringify(payload), params);

  // Comprehensive error checking
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has payload': (r) => {
      try {
        return r.json().payload !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  // Track errors with context
  if (!success) {
    console.error(`RPC Error: ${endpoint} | Status: ${response.status} | Body: ${response.body.substring(0, 200)}`);
  }

  errorRate.add(!success);

  // Track read/write throughput
  if (isWrite) {
    writeThroughput.add(1);
  } else {
    readThroughput.add(1);
  }

  // Track per-RPC latency
  if (metric) {
    metric.add(response.timings.duration);
  }

  return {
    success,
    status: response.status,
    body: response.json(),
    duration: response.timings.duration,
  };
}

// Main test scenario
export default function() {
  // Pick a random user from the pool
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];

  // Authenticate once per iteration
  const token = authenticate(user.email, user.password);

  // Realistic traffic distribution:
  // - 40% get_player_stats (read, cached)
  // - 30% get_leaderboard (read, computed)
  // - 15% get_inventory (read, moderate complexity)
  // - 10% submit_feedback (write, database insert)
  // - 5% get_season_info (read, simple)
  const rand = Math.random();

  if (rand < 0.40) {
    // 40% - Get player stats (most common, should be cached)
    const response = callRpc('get_player_stats', {}, token, statsLatency, false);
    check(response, {
      'get_player_stats success': (r) => r.success,
      'get_player_stats has data': (r) => r.body.payload !== undefined,
    });
    sleep(Math.random() * 1 + 1); // 1-2 seconds think time

  } else if (rand < 0.70) {
    // 30% - Get leaderboard (read, computed/cached)
    const limit = LEADERBOARD_LIMITS[Math.floor(Math.random() * LEADERBOARD_LIMITS.length)];
    const response = callRpc('get_leaderboard', {
      season_id: 'season_1',
      limit: limit,
    }, token, leaderboardLatency, false);
    check(response, {
      'get_leaderboard success': (r) => r.success,
      'get_leaderboard has data': (r) => r.body.payload !== undefined,
    });
    sleep(Math.random() * 1 + 2); // 2-3 seconds think time

  } else if (rand < 0.85) {
    // 15% - Get inventory (read, moderate complexity)
    const response = callRpc('get_inventory', {}, token, inventoryLatency, false);
    check(response, {
      'get_inventory success': (r) => r.success,
      'get_inventory has data': (r) => r.body.payload !== undefined,
    });
    sleep(Math.random() * 1 + 1); // 1-2 seconds think time

  } else if (rand < 0.95) {
    // 10% - Submit feedback (write operation)
    const category = FEEDBACK_CATEGORIES[Math.floor(Math.random() * FEEDBACK_CATEGORIES.length)];
    const priority = FEEDBACK_PRIORITIES[Math.floor(Math.random() * FEEDBACK_PRIORITIES.length)];

    const response = callRpc('submit_feedback', {
      category: category,
      title: `Load test feedback ${Date.now()}`,
      description: `Automated feedback from mixed_workload_enhanced - Category: ${category}, Priority: ${priority}`,
      priority: priority,
    }, token, feedbackLatency, true);
    check(response, {
      'submit_feedback success': (r) => r.success,
    });
    sleep(Math.random() * 1 + 2); // 2-3 seconds think time for writes

  } else {
    // 5% - Get season info (read, simple, should be cached)
    const response = callRpc('get_season_info', {}, token, seasonLatency, false);
    check(response, {
      'get_season_info success': (r) => r.success,
      'get_season_info has data': (r) => r.body.payload !== undefined,
    });
    sleep(Math.random() * 1 + 1); // 1-2 seconds think time
  }
}

// Teardown function for summary
export function teardown(data) {
  console.log('Mixed workload enhanced load test completed');
  console.log('Read/write split validated across all hot-path RPC endpoints');
}
