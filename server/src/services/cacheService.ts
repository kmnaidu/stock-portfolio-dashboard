// ============================================================
// In-memory cache with TTL support
// ============================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheService {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlSeconds: number): void;
  invalidate(key: string): void;
  invalidateAll(): void;
}

export function createCacheService(): CacheService {
  const store = new Map<string, CacheEntry<unknown>>();

  return {
    get<T>(key: string): T | null {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },

    set<T>(key: string, value: T, ttlSeconds: number): void {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },

    invalidate(key: string): void {
      store.delete(key);
    },

    invalidateAll(): void {
      store.clear();
    },
  };
}
