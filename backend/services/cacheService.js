import NodeCache from 'node-cache';
import { createClient } from 'redis';

const DEFAULT_TTL_SECONDS = 15;
const memoryCache = new NodeCache({ stdTTL: DEFAULT_TTL_SECONDS, checkperiod: 30, useClones: false });
const cacheMetrics = {
  gets: 0,
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  redisEnabled: false,
  redisConnected: false,
};

let redisClientPromise = null;

function getRedisUrl() {
  const raw = String(process.env.REDIS_URL || '').trim();
  return raw || null;
}

async function getRedisClient() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const client = createClient({ url: redisUrl });
        client.on('error', (err) => {
          // eslint-disable-next-line no-console
          console.error('[cache][redis:error]', err?.message || String(err));
        });
        await client.connect();
        cacheMetrics.redisEnabled = true;
        cacheMetrics.redisConnected = true;
        return client;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[cache] Redis unavailable, using in-memory fallback');
        cacheMetrics.redisEnabled = Boolean(redisUrl);
        cacheMetrics.redisConnected = false;
        return null;
      }
    })();
  }
  return redisClientPromise;
}

export async function cacheGet(key) {
  cacheMetrics.gets += 1;
  const redis = await getRedisClient();
  if (redis) {
    const value = await redis.get(key);
    if (!value) {
      cacheMetrics.misses += 1;
      return null;
    }
    cacheMetrics.hits += 1;
    try {
      return JSON.parse(value);
    } catch (_) {
      cacheMetrics.misses += 1;
      return null;
    }
  }
  const cached = memoryCache.get(key);
  if (cached == null) {
    cacheMetrics.misses += 1;
    return null;
  }
  cacheMetrics.hits += 1;
  return cached;
}

export async function cacheSet(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  cacheMetrics.sets += 1;
  const redis = await getRedisClient();
  if (redis) {
    await redis.set(key, JSON.stringify(value), { EX: Math.max(1, Number(ttlSeconds) || DEFAULT_TTL_SECONDS) });
    return;
  }
  memoryCache.set(key, value, Math.max(1, Number(ttlSeconds) || DEFAULT_TTL_SECONDS));
}

export async function cacheDelByPrefix(prefix) {
  const redis = await getRedisClient();
  if (redis) {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) {
      await redis.del(keys);
      cacheMetrics.deletes += keys.length;
    }
    return;
  }
  const keys = memoryCache.keys().filter((k) => k.startsWith(prefix));
  if (keys.length) {
    memoryCache.del(keys);
    cacheMetrics.deletes += keys.length;
  }
}

export function getCacheMetrics() {
  const hitRate = cacheMetrics.gets > 0 ? Number(((cacheMetrics.hits / cacheMetrics.gets) * 100).toFixed(2)) : 0;
  return {
    ...cacheMetrics,
    hitRatePercent: hitRate,
  };
}
