import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const readLatency = new Trend('read_latency');
const writeLatency = new Trend('write_latency');

const BASE_URL = __ENV.NAKAMA_URL || 'http://localhost:7350';

export const options = {
  stages: [
    { duration: '2m', target: 150 },
    { duration: '3m', target: 150 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'errors': ['rate<0.01'],
    'read_latency': ['p(95)<100'],
    'write_latency': ['p(95)<200'], // Writes allowed to be slower
  },
};

// Helper function for RPC calls
function callRpc(endpoint, payload, authToken, isWrite = false) {
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

  if (isWrite) {
    writeLatency.add(response.timings.duration);
  } else {
    readLatency.add(response.timings.duration);
  }

  return {
    success,
    status: response.status,
    body: response.json(),
    duration: response.timings.duration,
  };
}

// Helper function for authentication
function authenticate(email, password) {
  const response = http.post(
    `${BASE_URL}/v2/account/authenticate/email?create=false`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  return response.json().token;
}

export default function() {
  const token = authenticate('user1@test.com', 'password123');

  // 80% reads (cached operations)
  const rand = Math.random();

  if (rand < 0.4) {
    // Get player stats (40% of traffic)
    callRpc('get_player_stats', {}, token, false);
    sleep(1);
  } else if (rand < 0.8) {
    // Get leaderboard (40% of traffic)
    callRpc('get_leaderboard', {
      season_id: 'season_1',
      limit: 100,
    }, token, false);
    sleep(2);
  } else if (rand < 0.9) {
    // Submit feedback (10% of traffic - write)
    callRpc('submit_feedback', {
      category: 'bug_report',
      title: `Test feedback ${Date.now()}`,
      description: 'Load test feedback',
      priority: 'medium',
    }, token, true);
    sleep(2);
  } else {
    // Get season info (10% of traffic)
    callRpc('get_season_info', {}, token, false);
    sleep(1);
  }
}
