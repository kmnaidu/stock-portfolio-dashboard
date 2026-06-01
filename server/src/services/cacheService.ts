// ============================================================
// Hybrid Cache Service
//
// Uses TWO storage backends:
// 1. In-memory (Map) — for short-lived data (market pulse, quotes, 30s-60s TTL)
// 2. Upstash Redis — for long-lived data (analyst data, 7-day TTL)
//
// Why hybrid?
// - Short-lived data changes every 30 seconds — no point storing in Redis (wastes commands)
// - Long-lived data (analyst) must survive server restarts — Redis is perfect
//
// The threshold: if TTL > 1 hour → use Redis. Otherwise → in-memory.
// ============================================================

import { Redis } from '@upstash/redis';

const REDIS_TTL_THRESHOLD = 3600; // 1 hour — above this, use Redis

// Initialize Redis (if credentials available)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
if (redisUrl && redisToken) {
  redis = new Redis({ url: redisUrl, token: redisToken });
  console.log('✓ Upstash Redis connected (persistent cache enabled)');
} else {
  console.log('⚠ No Redis credentials — using in-memory cache only (data lost on restart)');
}

// ── In-memory cache (short-lived) ────────────────────────────
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheService {
  get<T>(key: string): T | null;
  getAsync<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): void;
  invalidate(key: string): void;
  invalidateAll(): void;
}

export function createCacheService(): CacheService {
  const memStore = new Map<string, CacheEntry<unknown>>();

  return {
    // Synchronous get — checks in-memory first, then Redis (blocking)
    get<T>(key: string): T | null {
      // Check in-memory first
      const entry = memStore.get(key);
      if (entry) {
        if (Date.now() > entry.expiresAt) {
          memStore.delete(key);
          return null;
        }
        return entry.value as T;
      }
      return null;
    },

    // Async get — checks in-memory, then Redis
    async getAsync<T>(key: string): Promise<T | null> {
      // Check in-memory first
      const entry = memStore.get(key);
      if (entry) {
        if (Date.now() > entry.expiresAt) {
          memStore.delete(key);
        } else {
          return entry.value as T;
        }
      }

      // Check Redis for long-lived data
      if (redis) {
        try {
          const redisValue = await redis.get<T>(key);
          if (redisValue) {
            // Also cache in memory for faster subsequent reads
            memStore.set(key, { value: redisValue, expiresAt: Date.now() + 300000 }); // 5 min local cache
            return redisValue;
          }
        } catch (err) {
          console.error('[Redis] Get error:', (err as any)?.message);
        }
      }

      return null;
    },

    set<T>(key: string, value: T, ttlSeconds: number): void {
      // Always store in memory
      memStore.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });

      // Also store in Redis if TTL is long (analyst data, AI analysis, etc.)
      if (redis && ttlSeconds >= REDIS_TTL_THRESHOLD) {
        redis.set(key, JSON.stringify(value), { ex: ttlSeconds }).catch(err => {
          console.error('[Redis] Set error:', (err as any)?.message);
        });
      }
    },

    invalidate(key: string): void {
      memStore.delete(key);
      if (redis) {
        redis.del(key).catch(() => {});
      }
    },

    invalidateAll(): void {
      memStore.clear();
      // Don't flush Redis — it has persistent data we want to keep
    },
  };
}
