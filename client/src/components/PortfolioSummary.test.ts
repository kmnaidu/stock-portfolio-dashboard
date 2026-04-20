import { describe, it, expect } from 'vitest';
import { computePortfolioSummary } from './PortfolioSummary';
import type { QuoteData } from 'shared/types';

function makeQuote(overrides: Partial<QuoteData> = {}): QuoteData {
  return {
    symbol: 'TEST.NS',
    shortName: 'Test Stock',
    price: 100,
    previousClose: 95,
    change: 5,
    changePercent: 5.26,
    dayHigh: 105,
    dayLow: 94,
    volume: 10000,
    marketState: 'REGULAR',
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

describe('computePortfolioSummary', () => {
  it('computes correct totals for a single stock', () => {
    const quotes = [makeQuote({ price: 200, change: 10 })];
    const summary = computePortfolioSummary(quotes);

    expect(summary.totalValue).toBe(200);
    expect(summary.totalDailyChange).toBe(10);
    expect(summary.securitiesCount).toBe(1);
    // previousTotal = 200 - 10 = 190, changePercent = (10/190)*100
    expect(summary.totalDailyChangePercent).toBeCloseTo((10 / 190) * 100, 2);
  });

  it('computes correct totals for multiple stocks', () => {
    const quotes = [
      makeQuote({ price: 1000, change: 50 }),
      makeQuote({ price: 500, change: -20 }),
      makeQuote({ price: 300, change: 10 }),
    ];
    const summary = computePortfolioSummary(quotes);

    expect(summary.totalValue).toBe(1800);
    expect(summary.totalDailyChange).toBe(40);
    expect(summary.securitiesCount).toBe(3);
    // previousTotal = 1800 - 40 = 1760
    expect(summary.totalDailyChangePercent).toBeCloseTo((40 / 1760) * 100, 2);
  });

  it('handles all negative changes', () => {
    const quotes = [
      makeQuote({ price: 100, change: -5 }),
      makeQuote({ price: 200, change: -10 }),
    ];
    const summary = computePortfolioSummary(quotes);

    expect(summary.totalDailyChange).toBe(-15);
    expect(summary.totalDailyChangePercent).toBeLessThan(0);
  });

  it('handles zero change', () => {
    const quotes = [makeQuote({ price: 100, change: 0 })];
    const summary = computePortfolioSummary(quotes);

    expect(summary.totalDailyChange).toBe(0);
    expect(summary.totalDailyChangePercent).toBe(0);
  });

  it('returns zero percent when previous total is zero', () => {
    // Edge case: price equals change (previous was 0)
    const quotes = [makeQuote({ price: 10, change: 10 })];
    const summary = computePortfolioSummary(quotes);

    expect(summary.totalDailyChangePercent).toBe(0);
  });

  it('returns correct securitiesCount', () => {
    const quotes = Array.from({ length: 7 }, (_, i) =>
      makeQuote({ symbol: `STOCK${i}.NS`, price: 100 + i * 10 })
    );
    const summary = computePortfolioSummary(quotes);
    expect(summary.securitiesCount).toBe(7);
  });

  it('includes a lastUpdated timestamp', () => {
    const quotes = [makeQuote()];
    const summary = computePortfolioSummary(quotes);
    expect(summary.lastUpdated).toBeDefined();
    expect(new Date(summary.lastUpdated).getTime()).not.toBeNaN();
  });
});
