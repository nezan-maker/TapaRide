import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export function createRedisConnection() {
  const url = env.REDIS_URL;
  const isSSL = url.startsWith('rediss://');
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Redis max retries reached, giving up');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    lazyConnect: true,
    enableOfflineQueue: true,
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

redis.on('reconnecting', () => {
  logger.warn('Redis reconnecting...');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});
