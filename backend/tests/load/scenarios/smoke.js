/**
 * Smoke scenario: verify auth + health_check RPC round-trip under minimal load.
 * Thresholds match the CI gate contract parsed by parse-load-test-results.js.
 */
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { authenticate, rpc, deviceForVU, isRpcFailure } from '../lib/nakama.js';

const errors = new Rate('errors');
const latency = new Trend('health_check_latency', true);

export const options = {
  vus: Number(__ENV.K6_VUS || 2),
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    health_check_latency: ['p(95)<100'],
    errors: ['rate<0.01'],
  },
};

let token = null;

export default function () {
  if (!token) {
    token = authenticate(deviceForVU(__VU));
  }
  const start = Date.now();
  let res = token ? rpc(token, 'health_check', {}) : null;
  if (!res || res.status === 401) {
    token = authenticate(deviceForVU(__VU));
    if (token) res = rpc(token, 'health_check', {});
  }
  latency.add(Date.now() - start);
  errors.add(isRpcFailure(res));
  check(res, { 'health_check ok': (r) => r && r.status === 200 });
  sleep(0.5);
}
