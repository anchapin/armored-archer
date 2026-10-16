/**
 * Player stats scenario: get_player_stats read path under concurrent load.
 * Seeded users carry real storage rows (see .github/workflows/load-test.yml),
 * so this exercises the full cache-miss -> storage-read -> response path.
 */
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { authenticate, rpc, deviceForVU, isRpcFailure } from '../lib/nakama.js';

const errors = new Rate('errors');
const latency = new Trend('get_player_stats_latency', true);

export const options = {
  vus: Number(__ENV.K6_VUS || 20),
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    get_player_stats_latency: ['p(95)<100'],
    errors: ['rate<0.01'],
  },
};

let token = null;

export default function () {
  if (!token) {
    token = authenticate(deviceForVU(__VU));
  }
  const start = Date.now();
  let res = token ? rpc(token, 'get_player_stats', {}) : null;
  if (!res || res.status === 401) {
    token = authenticate(deviceForVU(__VU));
    if (token) res = rpc(token, 'get_player_stats', {});
  }
  latency.add(Date.now() - start);
  errors.add(isRpcFailure(res));
  check(res, { 'get_player_stats ok': (r) => r && r.status === 200 });
  sleep(0.25);
}
