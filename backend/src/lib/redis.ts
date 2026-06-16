import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export function createRedisConnection() {
  const url = env.REDIS_URL;
  const isSSL = url.startsWith('rediss://');
  return new Redis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    ...(isSSL ? { tls: {} } : {}),
  });
}

/**
 * Singleton Redis connection for general caching and metadata.
 */
export const redis = createRedisConnection();

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redis.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    logger.info('Connected to Redis');
  }
});
