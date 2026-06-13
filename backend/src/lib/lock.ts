import { randomUUID } from "crypto";

import { redis } from "./redis.js";

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export async function withRedisLock<T>(
  key: string,
  ttlSeconds: number,
  work: () => Promise<T>,
): Promise<T | null> {
  const token = randomUUID();
  const acquired = await redis.set(key, token, "EX", ttlSeconds, "NX");

  if (acquired !== "OK") {
    return null;
  }

  try {
    return await work();
  } finally {
    await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
  }
}
