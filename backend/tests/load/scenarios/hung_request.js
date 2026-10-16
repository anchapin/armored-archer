/**
 * Hung-request scenario (issue #1348, PD-2026-04-12 A3): proves the timeout
 * contract holds when a downstream dependency hangs.
 *
 * The diag_hang_probe fixture (CI-only, TEST_FIXTURE_RPCS_ENABLED=true)
 * busy-waits 10s inside the goja runtime. The client side must NOT wait it
 * out: k6's per-request timeout (3s) has to fire first, and a normal RPC
 * issued right after must still succeed - a hung handler must not wedge the
 * server. Thresholds are the gate; this scenario is deliberately absent
 * from parse-load-test-results.js, whose p95<100ms contract describes the
 * perf scenarios, not a timeout exercise.
 */
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { authenticate, rpc, deviceForVU, BASE_URL } from '../lib/nakama.js';
import http from 'k6/http';

const hangCallDuration = new Trend('hang_call_duration', true);
const healthAfterHangLatency = new Trend('health_after_hang_latency', true);
const healthAfterHangOk = new Rate('health_after_hang_ok');

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    // The client timeout (3s) must win over the 10s server hang: the call
    // returns in ~3s, not 10s+ (and never near the 30s transport default).
    hang_call_duration: ['p(95)<5000'],
    // Bounded recovery: the post-hang health check must come back well
    // inside the hang window if a free runtime serves it, or right after
    // the 10s hang unwinds if the pool was single-instance. 15s proves
    // no deadlock without depending on the CI pool size.
    health_after_hang_latency: ['p(95)<15000'],
    // The real gate: the server keeps serving after the hung request.
    health_after_hang_ok: ['rate>0.99'],
  },
};

function rpcWithTimeout(token, rpcId, payload, timeout) {
  return http.post(
    BASE_URL + '/v2/rpc/armored_archer/' + rpcId,
    JSON.stringify(JSON.stringify(payload || {})),
    {
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      timeout: timeout,
    }
  );
}

export default function () {
  const token = authenticate(deviceForVU(__VU));
  check(token, { 'authenticated': (t) => !!t });
  if (!token) {
    healthAfterHangOk.add(0);
    return;
  }

  // 1. Fire the hanging RPC with a 3s client-side timeout. The fixture
  //    hangs 10s, so the client must give up first.
  const hangStart = Date.now();
  const hangRes = rpcWithTimeout(token, 'diag_hang_probe', { hang_ms: 10000 }, '3s');
  hangCallDuration.add(Date.now() - hangStart);
  check(hangRes, {
    'hang probe abandoned by client timeout': (r) => !r || r.status === 0,
  });

  // 2. Immediately issue a normal RPC: the server must still answer even
  //    while the hung handler is unwinding.
  const healthStart = Date.now();
  const healthRes = rpc(token, 'health_check', {});
  healthAfterHangLatency.add(Date.now() - healthStart);
  const ok = healthRes && healthRes.status === 200;
  healthAfterHangOk.add(ok ? 1 : 0);
  check(healthRes, { 'health check succeeds after hung request': (r) => r && r.status === 200 });
}
