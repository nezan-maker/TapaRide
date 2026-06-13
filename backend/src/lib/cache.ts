import { redis } from "./redis.js";
import { withRedisLock } from "./lock.js";

const TAG_SET_TTL_SECONDS = 7 * 24 * 60 * 60;
const METRICS_KEY = "cache:metrics";
const CACHE_WAIT_RETRY_MS = 75;
const CACHE_WAIT_RETRIES = 10;
const inflightLoads = new Map<string, Promise<unknown>>();

function getTagKey(tag: string) {
  return `cache:tag:${tag}`;
}

function getStaleKey(key: string) {
  return `${key}:stale`;
}

function getFillLockKey(key: string) {
  return `cache:fill-lock:${key}`;
}

type CacheOptions = {
  ttlSeconds: number;
  tags?: string[];
  staleWhileRevalidateSeconds?: number;
};

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadAndPopulate<T>(
  key: string,
  options: CacheOptions,
  loader: () => Promise<T>,
): Promise<T> {
  const value = await loader();
  const pipeline = redis.pipeline();
  pipeline.set(key, JSON.stringify(value), "EX", options.ttlSeconds);
  pipeline.hincrby(METRICS_KEY, "sets", 1);

  if (options.staleWhileRevalidateSeconds) {
    pipeline.set(
      getStaleKey(key),
      JSON.stringify(value),
      "EX",
      options.ttlSeconds + options.staleWhileRevalidateSeconds,
    );
  }

  for (const tag of options.tags ?? []) {
    const tagKey = getTagKey(tag);
    pipeline.sadd(tagKey, key);
    if (options.staleWhileRevalidateSeconds) {
      pipeline.sadd(tagKey, getStaleKey(key));
    }
    pipeline.expire(tagKey, TAG_SET_TTL_SECONDS);
  }

  await pipeline.exec();
  return value;
}

async function withInflightLoad<T>(
  key: string,
  loader: () => Promise<T>,
) {
  const inflight = inflightLoads.get(key);
  if (inflight) {
    await redis.hincrby(METRICS_KEY, "coalesced_local", 1);
    return inflight as Promise<T>;
  }

  const promise = loader().finally(() => {
    inflightLoads.delete(key);
  });
  inflightLoads.set(key, promise);
  return promise;
}

async function refreshInBackground<T>(
  key: string,
  options: CacheOptions,
  loader: () => Promise<T>,
) {
  if (inflightLoads.has(key)) return;

  void withInflightLoad(key, async () => {
    const refreshed = await withRedisLock(getFillLockKey(key), 10, async () => {
      await redis.hincrby(METRICS_KEY, "revalidations", 1);
      return loadAndPopulate(key, options, loader);
    });

    if (refreshed === null) {
      await redis.hincrby(METRICS_KEY, "revalidation_skips", 1);
    }

    return refreshed as T;
  });
}

export async function rememberJson<T>(
  key: string,
  options: CacheOptions,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    await redis.hincrby(METRICS_KEY, "hits", 1);
    return JSON.parse(cached) as T;
  }

  await redis.hincrby(METRICS_KEY, "misses", 1);
  const staleKey = getStaleKey(key);
  const staleValue = options.staleWhileRevalidateSeconds
    ? await redis.get(staleKey)
    : null;

  const lockedResult = await withInflightLoad(key, async () => {
    const loaded = await withRedisLock(getFillLockKey(key), 10, async () => {
      return loadAndPopulate(key, options, loader);
    });

    if (loaded !== null) {
      return loaded;
    }

    for (let attempt = 0; attempt < CACHE_WAIT_RETRIES; attempt += 1) {
      await redis.hincrby(METRICS_KEY, "coalesced_wait", 1);
      await sleep(CACHE_WAIT_RETRY_MS * (attempt + 1));
      const fresh = await redis.get(key);
      if (fresh) {
        return JSON.parse(fresh) as T;
      }
    }

    if (staleValue) {
      await redis.hincrby(METRICS_KEY, "stale_hits", 1);
      await refreshInBackground(key, options, loader);
      return JSON.parse(staleValue) as T;
    }

    await redis.hincrby(METRICS_KEY, "stampede_fallback_loads", 1);
    return loadAndPopulate(key, options, loader);
  });

  return lockedResult;
}

export async function invalidateCacheTags(tags: string[]) {
  const uniqueTags = [...new Set(tags)];
  if (uniqueTags.length === 0) return;

  const pipeline = redis.pipeline();
  let invalidatedKeys = 0;

  for (const tag of uniqueTags) {
    const tagKey = getTagKey(tag);
    const keys = await redis.smembers(tagKey);

    if (keys.length > 0) {
      invalidatedKeys += keys.length;
      pipeline.del(...keys);
    }

    pipeline.del(tagKey);
  }

  pipeline.hincrby(METRICS_KEY, "invalidations", uniqueTags.length);
  pipeline.hincrby(METRICS_KEY, "invalidated_keys", invalidatedKeys);
  await pipeline.exec();
}

export async function getCacheMetrics() {
  const metrics = await redis.hgetall(METRICS_KEY);

  return {
    hits: Number(metrics["hits"] ?? 0),
    misses: Number(metrics["misses"] ?? 0),
    sets: Number(metrics["sets"] ?? 0),
    staleHits: Number(metrics["stale_hits"] ?? 0),
    coalescedLocal: Number(metrics["coalesced_local"] ?? 0),
    coalescedWait: Number(metrics["coalesced_wait"] ?? 0),
    revalidations: Number(metrics["revalidations"] ?? 0),
    revalidationSkips: Number(metrics["revalidation_skips"] ?? 0),
    stampedeFallbackLoads: Number(metrics["stampede_fallback_loads"] ?? 0),
    invalidations: Number(metrics["invalidations"] ?? 0),
    invalidatedKeys: Number(metrics["invalidated_keys"] ?? 0),
  };
}

export function formatCacheMetricsPrometheus(metrics: Awaited<ReturnType<typeof getCacheMetrics>>) {
  return [
    "# HELP tapa_cache_hits_total Total cache hits",
    "# TYPE tapa_cache_hits_total counter",
    `tapa_cache_hits_total ${metrics.hits}`,
    "# HELP tapa_cache_misses_total Total cache misses",
    "# TYPE tapa_cache_misses_total counter",
    `tapa_cache_misses_total ${metrics.misses}`,
    "# HELP tapa_cache_sets_total Total cache writes",
    "# TYPE tapa_cache_sets_total counter",
    `tapa_cache_sets_total ${metrics.sets}`,
    "# HELP tapa_cache_stale_hits_total Total stale cache responses served",
    "# TYPE tapa_cache_stale_hits_total counter",
    `tapa_cache_stale_hits_total ${metrics.staleHits}`,
    "# HELP tapa_cache_coalesced_local_total Total local coalesced requests",
    "# TYPE tapa_cache_coalesced_local_total counter",
    `tapa_cache_coalesced_local_total ${metrics.coalescedLocal}`,
    "# HELP tapa_cache_coalesced_wait_total Total waits for another cache fill",
    "# TYPE tapa_cache_coalesced_wait_total counter",
    `tapa_cache_coalesced_wait_total ${metrics.coalescedWait}`,
    "# HELP tapa_cache_revalidations_total Total background cache revalidations",
    "# TYPE tapa_cache_revalidations_total counter",
    `tapa_cache_revalidations_total ${metrics.revalidations}`,
    "# HELP tapa_cache_revalidation_skips_total Total skipped background revalidations due to existing lock",
    "# TYPE tapa_cache_revalidation_skips_total counter",
    `tapa_cache_revalidation_skips_total ${metrics.revalidationSkips}`,
    "# HELP tapa_cache_stampede_fallback_loads_total Total direct loads after lock wait exhaustion",
    "# TYPE tapa_cache_stampede_fallback_loads_total counter",
    `tapa_cache_stampede_fallback_loads_total ${metrics.stampedeFallbackLoads}`,
    "# HELP tapa_cache_invalidations_total Total cache invalidation operations",
    "# TYPE tapa_cache_invalidations_total counter",
    `tapa_cache_invalidations_total ${metrics.invalidations}`,
    "# HELP tapa_cache_invalidated_keys_total Total invalidated cache keys",
    "# TYPE tapa_cache_invalidated_keys_total counter",
    `tapa_cache_invalidated_keys_total ${metrics.invalidatedKeys}`,
  ].join("\n");
}
