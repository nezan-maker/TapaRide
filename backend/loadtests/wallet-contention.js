import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 25,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';
const accessToken = __ENV.ACCESS_TOKEN || '';
const walletPassword = __ENV.WALLET_PASSWORD || '4321';

export default function () {
  const depositResponse = http.post(
    `${baseUrl}/api/wallet/deposit`,
    JSON.stringify({
      amount: 10,
      walletPassword,
    }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `deposit-${__VU}-${__ITER}`,
      },
    },
  );

  check(depositResponse, {
    'deposit accepted': (r) => r.status === 200,
  });

  const withdrawResponse = http.post(
    `${baseUrl}/api/wallet/withdraw`,
    JSON.stringify({
      amount: 5,
      walletPassword,
    }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `withdraw-${__VU}-${__ITER}`,
      },
    },
  );

  check(withdrawResponse, {
    'withdraw accepted or rejected cleanly': (r) =>
      r.status === 200 || r.status === 409,
  });

  sleep(1);
}
