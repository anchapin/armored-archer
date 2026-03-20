import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.NAKAMA_URL || 'http://localhost:7350';

export default function() {
  // Simple health check
  const response = http.get(`${BASE_URL}/`);
  check(response, {
    'server is running': (r) => r.status === 200,
  });
}

export const options = {
  vus: 1,
  iterations: 1,
};
