import test, { after } from "node:test";
import assert from "node:assert/strict";

import { redis } from "../src/lib/redis.js";
import { formatCacheMetricsPrometheus } from "../src/lib/cache.js";
import { formatSocketMetricsPrometheus } from "../src/lib/socket.js";

after(() => {
  redis.disconnect();
});

test("cache metrics are exported in Prometheus format", () => {
  const output = formatCacheMetricsPrometheus({
    hits: 10,
    misses: 2,
    sets: 2,
    staleHits: 1,
    coalescedLocal: 3,
    coalescedWait: 4,
    revalidations: 5,
    revalidationSkips: 1,
    stampedeFallbackLoads: 0,
    invalidations: 6,
    invalidatedKeys: 7,
  });

  assert.match(output, /tapa_cache_hits_total 10/);
  assert.match(output, /tapa_cache_revalidations_total 5/);
  assert.match(output, /tapa_cache_invalidated_keys_total 7/);
});

test("socket metrics are exported in Prometheus format", () => {
  const output = formatSocketMetricsPrometheus({
    connections: 10,
    disconnects: 8,
    authFailures: 1,
    joinTripAuthorized: 6,
    joinTripUnauthorized: 2,
    joinTripErrors: 0,
    joinTripInvalidPayloads: 1,
    joinTripRateLimitViolations: 1,
    gpsUpdatesAccepted: 100,
    gpsUpdateInvalidPayloads: 2,
    gpsUpdateRateLimitViolations: 3,
  });

  assert.match(output, /tapa_socket_connections_total 10/);
  assert.match(output, /tapa_socket_gps_updates_accepted_total 100/);
  assert.match(output, /tapa_socket_gps_update_rate_limit_violations_total 3/);
});
