import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';
const accessToken = __ENV.ACCESS_TOKEN || '';
const journeyId = __ENV.JOURNEY_ID || '';
const walletPassword = __ENV.WALLET_PASSWORD || '4321';

export default function () {
  const response = http.post(
    `${baseUrl}/api/tickets`,
    JSON.stringify({
      journeyId,
      seatNumber: 1,
      walletPassword,
    }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `${__VU}-${__ITER}`,
      },
    },
  );

  check(response, {
    'ticket endpoint returned 201 or 409': (r) =>
      r.status === 201 || r.status === 409,
  });

  sleep(1);
}
