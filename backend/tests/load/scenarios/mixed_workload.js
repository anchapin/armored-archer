/**
 * Mixed workload: weighted blend of the game's primary read RPCs.
 * Weights: 50% player stats, 30% leaderboard, 20% health check.
 */
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { authenticate, rpc, deviceForVU, isRpcFailure } from '../lib/nakama.js';

const errors = new Rate('errors');
const latency = new Trend('mixed_workload_latency', true);

export const options = {
  vus: Number(__ENV.K6_VUS || 30),
  duration: __ENV.K6_DURATION || '60s',
  thresholds: {
    mixed_workload_latency: ['p(95)<100'],
    errors: ['rate<0.01'],
  },
};

let token = null;

export default function () {
  if (!token) {
    token = authenticate(deviceForVU(__VU));
  }
  const roll = Math.random();
  let rpcId = 'get_player_stats';
  let payload = {};
  if (roll >= 0.5 && roll < 0.8) {
    rpcId = 'get_leaderboard';
    payload = { limit: 50 };
  } else if (roll >= 0.8) {
    rpcId = 'health_check';
  }
  const start = Date.now();
  let res = token ? rpc(token, rpcId, payload) : null;
  if (!res || res.status === 401) {
    token = authenticate(deviceForVU(__VU));
    if (token) res = rpc(token, rpcId, payload);
  }
  latency.add(Date.now() - start);
  errors.add(isRpcFailure(res));
  check(res, { 'rpc ok': (r) => r && r.status === 200 });
  sleep(0.25);
}
