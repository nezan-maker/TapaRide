# Tapa Infra Rollout Plan

## Topology

- Postgres: 1 primary plus 1 hot standby for failover, with WAL archiving and PITR enabled before launch.
- Redis: 1 primary plus 1 replica managed by Sentinel or a hosted equivalent, split logically into cache/pubsub and BullMQ workloads with separate databases or clusters when traffic grows.
- API replicas: start with 3 stateless replicas behind an L7 load balancer.
- Queue workers: at least 2 queue worker replicas for BullMQ jobs plus 1 dedicated GPS aggregation worker replica.
- Socket edge nodes: at least 2 Socket.IO edge replicas behind sticky-session capable load balancing, all subscribed to the shared Redis socket-events channel.

## Rollout Order

1. Provision Postgres, Redis, secrets, and observability first.
2. Apply Prisma migrations against staging, then production during a low-traffic window.
3. Deploy queue workers before API replicas so notification and waitlist jobs do not back up.
4. Deploy API replicas and verify health, auth, wallet, and ticket flows.
5. Deploy socket edge nodes and confirm cross-node room delivery using Redis-backed broadcasts.
6. Run smoke tests for auth, wallet, ticket purchase/cancel, waitlist promotion, and GPS aggregation.

## Postgres

- Use connection pooling in front of Postgres because Prisma plus multiple API and worker replicas will otherwise exhaust connections quickly.
- Target a primary sized for bursty write traffic, with indexes on active ticket seats, verification state, and waitlist lookups already applied.
- Enable slow query logging and set alerts on replication lag, connection saturation, deadlocks, and disk growth.

## Redis And BullMQ

- Reserve Redis memory explicitly and enable eviction only for cache keys, not queue metadata.
- Keep BullMQ workers separate from API pods so retries, delayed jobs, and backlog spikes do not steal API CPU.
- Alert on queue depth, job age, failed jobs, Redis memory pressure, and pub/sub disconnects.

## API And Socket Capacity

- With the current code shape, 7 to 10 concurrent users is trivial; even a single modest API node can handle that comfortably.
- For 20 million total users, readiness depends on active concurrency, not registration count. The app can support a large registered base only if traffic is spread out and infra is sized for the peak active slice.
- Before claiming high-scale readiness, run load tests for login bursts, wallet mutations, ticket contention on the same journey, waitlist promotion, and socket fan-out.
- The new process split and Redis-backed socket broadcast remove the biggest scale blockers, but database contention on hot journeys and wallet updates is still the next likely bottleneck.

## Immediate Production Gaps To Validate

- Run the new integration suite against real staging Postgres and Redis.
- Confirm the partial paid-seat unique index is present in production after migration.
- Add SLOs and dashboards for auth latency, wallet mutation latency, queue backlog, Redis pub/sub disconnects, and ticket purchase failure rate.
- Perform a controlled load test before public launch instead of extrapolating from functional correctness.
