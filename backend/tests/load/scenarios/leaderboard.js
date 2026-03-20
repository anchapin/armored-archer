import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const leaderboardLatency = new Trend('get_leaderboard_latency');

const BASE_URL = __ENV.NAKAMA_URL || 'http://localhost:7350';

export const options = {
  stages: [
    { duration: '2m', target: 200 },
    { duration: '3m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'errors': ['rate<0.01'],
    'get_leaderboard_latency': ['p(95)<100'],
  },
};

export default function() {
  const token = authenticate('user1@test.com', 'password123');

  const response = http.post(
    `${BASE_URL}/v2/rpc/get_leaderboard`,
    JSON.stringify({
      season_id: 'season_1',
      limit: 100,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has leaderboard data': (r) => r.json().payload !== undefined,
  });

  errorRate.add(!success);
  leaderboardLatency.add(response.timings.duration);

  sleep(2);
}

function authenticate(email, password) {
  const response = http.post(
    `${BASE_URL}/v2/account/authenticate/email?create=false`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  return response.json().token;
}
