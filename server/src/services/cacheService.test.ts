import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCacheService } from './cacheService.js';

describe('CacheService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a key that was never set', () => {
    const cache = createCacheService();
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('stores and retrieves a value', () => {
    const cache = createCacheService();
    cache.set('key1', { data: 'hello' }, 60);
    expect(cache.get('key1')).toEqual({ data: 'hello' });
  });

  it('returns null after TTL expires', () => {
    const cache = createCacheService();
    cache.set('key1', 'value', 5); // 5 second TTL

    // Still valid at 4 seconds
    vi.advanceTimersByTime(4000);
    expect(cache.get('key1')).toBe('value');

    // Expired at 6 seconds
    vi.advanceTimersByTime(2000);
    expect(cache.get('key1')).toBeNull();
  });

  it('overwrites existing key with new value and TTL', () => {
    const cache = createCacheService();
    cache.set('key1', 'old', 10);
    cache.set('key1', 'new', 60);
    expect(cache.get('key1')).toBe('new');
  });

  it('invalidate removes a single key', () => {
    const cache = createCacheService();
    cache.set('a', 1, 60);
    cache.set('b', 2, 60);

    cache.invalidate('a');

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
  });

  it('invalidateAll clears everything', () => {
    const cache = createCacheService();
    cache.set('a', 1, 60);
    cache.set('b', 2, 60);
    cache.set('c', 3, 60);

    cache.invalidateAll();

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).toBeNull();
  });

  it('handles zero TTL (expires immediately)', () => {
    const cache = createCacheService();
    cache.set('key1', 'value', 0);
    vi.advanceTimersByTime(1);
    expect(cache.get('key1')).toBeNull();
  });

  it('stores different types: strings, numbers, objects, arrays', () => {
    const cache = createCacheService();
    cache.set('str', 'hello', 60);
    cache.set('num', 42, 60);
    cache.set('obj', { a: 1 }, 60);
    cache.set('arr', [1, 2, 3], 60);

    expect(cache.get('str')).toBe('hello');
    expect(cache.get('num')).toBe(42);
    expect(cache.get('obj')).toEqual({ a: 1 });
    expect(cache.get('arr')).toEqual([1, 2, 3]);
  });
});
