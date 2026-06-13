# Load Test Scenarios

## Wallet Contention

```bash
k6 run loadtests/wallet-contention.js \
  -e BASE_URL=http://localhost:5000 \
  -e ACCESS_TOKEN=your_access_token \
  -e WALLET_PASSWORD=4321
```

## Hot Seat Contention

```bash
k6 run loadtests/tickets-hot-seat.js \
  -e BASE_URL=http://localhost:5000 \
  -e ACCESS_TOKEN=your_access_token \
  -e JOURNEY_ID=your_journey_id \
  -e WALLET_PASSWORD=4321
```
