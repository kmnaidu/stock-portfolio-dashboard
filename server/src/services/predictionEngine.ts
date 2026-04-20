// ============================================================
// Prediction Engine — Linear regression on historical prices
// ============================================================

import type { PredictionSet, HistoricalDataPoint } from 'shared/types.js';
import type { CacheService } from './cacheService.js';

export interface PredictionEngine {
  generatePredictions(symbol: string, historicalData: HistoricalDataPoint[]): PredictionSet;
}

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

/**
 * Fit a least-squares linear regression to (x, y) pairs.
 * x = day index (0, 1, 2, …), y = closing price.
 */
export function linearRegression(prices: number[]): RegressionResult {
  const n = prices.length;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;

  // If all x values are the same (n <= 1), slope is 0
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Compute R² (coefficient of determination)
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssRes += (prices[i] - predicted) ** 2;
    ssTot += (prices[i] - meanY) ** 2;
  }

  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

const HORIZONS = [
  { label: '1w' as const, days: 7 },
  { label: '1mo' as const, days: 30 },
  { label: '3mo' as const, days: 90 },
];

const PREDICTION_CACHE_TTL = 6 * 60 * 60; // 6 hours default

export function createPredictionEngine(cache: CacheService): PredictionEngine {
  return {
    generatePredictions(symbol: string, historicalData: HistoricalDataPoint[]): PredictionSet {
      const cacheKey = `predictions:${symbol}`;
      const cached = cache.get<PredictionSet>(cacheKey);
      if (cached) return cached;

      const prices = historicalData.map((d) => d.close);
      const { slope, intercept, rSquared } = linearRegression(prices);

      const n = prices.length;
      const lastIndex = n - 1;
      const currentPrice = prices[lastIndex] ?? 0;

      // Confidence: R² scaled to 0–100 with a floor of 10
      const rawConfidence = Math.max(rSquared, 0) * 100;
      const confidence = Math.max(rawConfidence, 10);

      const predictions = HORIZONS.map(({ label, days }) => {
        const futureIndex = lastIndex + days;
        const predictedPrice = Math.max(slope * futureIndex + intercept, 0);

        let direction: 'up' | 'down' | 'neutral';
        if (predictedPrice > currentPrice) {
          direction = 'up';
        } else if (predictedPrice < currentPrice) {
          direction = 'down';
        } else {
          direction = 'neutral';
        }

        return {
          horizon: label,
          predictedPrice: Math.round(predictedPrice * 100) / 100,
          confidence: Math.round(confidence * 100) / 100,
          direction,
        };
      });

      const result: PredictionSet = {
        symbol,
        generatedAt: new Date().toISOString(),
        predictions,
      };

      cache.set(cacheKey, result, PREDICTION_CACHE_TTL);
      return result;
    },
  };
}
