// lib/pixabayCache.js
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
let upstashClient = null;
let useUpstash = false;

async function initUpstashIfNeeded() {
  if (upstashClient) return;
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const { Redis } = await import('@upstash/redis');
      upstashClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
      useUpstash = true;
    }
  } catch (e) {
    useUpstash = false;
    upstashClient = null;
  }
}

const memoryCache = new Map();

function getCachedMemory(key) {
  const e = memoryCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return e.data;
}

function setCachedMemory(key, data) {
  try {
    memoryCache.set(key, { ts: Date.now(), data });
  } catch (e) {}
}

export async function getCached(key) {
  await initUpstashIfNeeded();
  if (useUpstash && upstashClient) {
    try {
      const raw = await upstashClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return getCachedMemory(key);
    }
  }
  return getCachedMemory(key);
}

export async function setCached(key, data) {
  await initUpstashIfNeeded();
  if (useUpstash && upstashClient) {
    try {
      await upstashClient.set(key, JSON.stringify(data), { ex: Math.floor(CACHE_TTL_MS / 1000) });
      return;
    } catch (e) {}
  }
  setCachedMemory(key, data);
}

export async function clearCache(options = {}) {
  // options: { q, per }
  await initUpstashIfNeeded();
  const { q, per } = options;
  if (q) {
    const key = `${q}::${per || ''}`;
    if (useUpstash && upstashClient) {
      try {
        await upstashClient.del(key);
      } catch (e) {}
    }
    memoryCache.delete(key);
    return { cleared: [key] };
  }

  // No q provided -> clear entire memory cache and try flush upstash
  const keys = [];
  for (const k of memoryCache.keys()) keys.push(k);
  memoryCache.clear();

  if (useUpstash && upstashClient) {
    try {
      // Try flushall (may not be allowed depending on Upstash plan)
      if (typeof upstashClient.flushall === 'function') {
        await upstashClient.flushall();
      }
    } catch (e) {
      // ignore
    }
  }
  return { clearedAll: true, keysCount: keys.length };
}

export function _debug_getMemoryKeys() {
  return Array.from(memoryCache.keys());
}
