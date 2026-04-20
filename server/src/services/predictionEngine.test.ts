import { describe, it, expect } from 'vitest';
import { linearRegression, createPredictionEngine } from './predictionEngine.js';
import { createCacheService } from './cacheService.js';
import type { HistoricalDataPoint } from 'shared/types.js';

function makeHistoricalData(prices: number[]): HistoricalDataPoint[] {
  return prices.map((close, i) => ({
    date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  }));
}

describe('linearRegression', () => {
  it('computes correct slope and intercept for a perfect line', () => {
    // y = 2x + 10 → prices at indices 0..4: 10, 12, 14, 16, 18
    const prices = [10, 12, 14, 16, 18];
    const { slope, intercept, rSquared } = linearRegression(prices);
    expect(slope).toBeCloseTo(2, 10);
    expect(intercept).toBeCloseTo(10, 10);
    expect(rSquared).toBeCloseTo(1, 10);
  });

  it('returns slope 0 for constant prices', () => {
    const prices = [50, 50, 50, 50, 50];
    const { slope, intercept, rSquared } = linearRegression(prices);
    expect(slope).toBe(0);
    expect(intercept).toBe(50);
    expect(rSquared).toBe(1); // perfect fit (no variance)
  });

  it('handles a single price', () => {
    const prices = [100];
    const { slope, intercept } = linearRegression(prices);
    expect(slope).toBe(0);
    expect(intercept).toBe(100);
  });
});

describe('createPredictionEngine', () => {
  it('returns exactly 3 predictions with correct horizons', () => {
    const cache = createCacheService();
    const engine = createPredictionEngine(cache);
    const data = makeHistoricalData(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = engine.generatePredictions('TEST.NS', data);

    expect(result.symbol).toBe('TEST.NS');
    expect(result.predictions).toHaveLength(3);
    expect(result.predictions.map((p) => p.horizon)).toEqual(['1w', '1mo', '3mo']);
  });

  it('confidence is between 10 and 100', () => {
    const cache = createCacheService();
    const engine = createPredictionEngine(cache);
    const data = makeHistoricalData(Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i) * 50));
    const result = engine.generatePredictions('TEST.NS', data);

    for (const p of result.predictions) {
      expect(p.confidence).toBeGreaterThanOrEqual(10);
      expect(p.confidence).toBeLessThanOrEqual(100);
    }
  });

  it('direction is up for upward-trending prices', () => {
    const cache = createCacheService();
    const engine = createPredictionEngine(cache);
    const data = makeHistoricalData(Array.from({ length: 60 }, (_, i) => 100 + i * 2));
    const result = engine.generatePredictions('UP.NS', data);

    for (const p of result.predictions) {
      expect(p.direction).toBe('up');
    }
  });

  it('direction is down for downward-trending prices', () => {
    const cache = createCacheService();
    const engine = createPredictionEngine(cache);
    const data = makeHistoricalData(Array.from({ length: 60 }, (_, i) => 500 - i * 2));
    const result = engine.generatePredictions('DOWN.NS', data);

    for (const p of result.predictions) {
      expect(p.direction).toBe('down');
    }
  });

  it('caches predictions and returns cached result on second call', () => {
    const cache = createCacheService();
    const engine = createPredictionEngine(cache);
    const data = makeHistoricalData(Array.from({ length: 30 }, (_, i) => 100 + i));

    const first = engine.generatePredictions('CACHED.NS', data);
    const second = engine.generatePredictions('CACHED.NS', data);

    expect(second).toBe(first); // same reference from cache
  });

  it('predicted prices are non-negative', () => {
    const cache = createCacheService();
    const engine = createPredictionEngine(cache);
    const data = makeHistoricalData(Array.from({ length: 30 }, (_, i) => 5 - i * 0.1));
    const result = engine.generatePredictions('LOW.NS', data);

    for (const p of result.predictions) {
      expect(p.predictedPrice).toBeGreaterThanOrEqual(0);
    }
  });
});
