/**
 * Shared Nakama HTTP helpers for k6 load scenarios.
 *
 * Auth flow (verified against backend runtime RPCs):
 *   1. POST /v2/account/authenticate/device with HTTP Basic auth
 *      (server key as username, empty password).
 *   2. RPC calls POST /v2/rpc/armored_archer/<id> with
 *      Authorization: Bearer <session token>.
 *   3. RPC payloads are JSON-encoded TWICE: the HTTP body is a JSON
 *      string whose contents are the JSON payload.
 */
import http from 'k6/http';
import encoding from 'k6/encoding';

export const BASE_URL = __ENV.NAKAMA_BASE_URL || 'http://localhost:7350';
export const SERVER_KEY = __ENV.NAKAMA_SERVER_KEY || 'defaultkey';

/** Device IDs of the users seeded by the load-test workflow SQL. */
export const SEEDED_DEVICES = [
  'k6-loadtest-device-1',
  'k6-loadtest-device-2',
  'k6-loadtest-device-3',
];

export function authenticate(deviceId) {
  const basic = encoding.b64encode(SERVER_KEY + ':');
  const res = http.post(
    BASE_URL + '/v2/account/authenticate/device?create=false',
    JSON.stringify({ id: deviceId }),
    {
      headers: {
        Authorization: 'Basic ' + basic,
        'Content-Type': 'application/json',
      },
    }
  );
  if (res.status !== 200) {
    return null;
  }
  try {
    return JSON.parse(res.body).token;
  } catch (e) {
    return null;
  }
}

export function rpc(token, rpcId, payload) {
  return http.post(
    BASE_URL + '/v2/rpc/armored_archer/' + rpcId,
    JSON.stringify(JSON.stringify(payload || {})),
    {
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
    }
  );
}

/** Pick a seeded device deterministically per VU. */
export function deviceForVU(vu) {
  return SEEDED_DEVICES[(vu - 1) % SEEDED_DEVICES.length];
}

/** An RPC response counts as an error only on transport/HTTP failure. */
export function isRpcFailure(res) {
  return !res || res.status !== 200;
}
