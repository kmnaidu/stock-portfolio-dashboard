import { describe, it, expect } from 'vitest';
import { sortQuotes } from './StockGrid';
import type { QuoteData } from 'shared/types';

function makeQuote(overrides: Partial<QuoteData> = {}): QuoteData {
  return {
    symbol: 'TEST.NS',
    shortName: 'Test',
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

const sampleQuotes: QuoteData[] = [
  makeQuote({ symbol: 'RELIANCE.NS', shortName: 'Reliance', price: 1300, changePercent: 1.5, volume: 5000000 }),
  makeQuote({ symbol: 'HDFCBANK.NS', shortName: 'HDFC Bank', price: 1600, changePercent: -0.5, volume: 3000000 }),
  makeQuote({ symbol: 'SBIN.NS', shortName: 'SBI', price: 800, changePercent: 2.1, volume: 8000000 }),
];

describe('sortQuotes', () => {
  it('sorts by name ascending', () => {
    const sorted = sortQuotes(sampleQuotes, 'name', 'asc');
    expect(sorted.map(q => q.shortName)).toEqual(['HDFC Bank', 'Reliance', 'SBI']);
  });

  it('sorts by name descending', () => {
    const sorted = sortQuotes(sampleQuotes, 'name', 'desc');
    expect(sorted.map(q => q.shortName)).toEqual(['SBI', 'Reliance', 'HDFC Bank']);
  });

  it('sorts by price ascending', () => {
    const sorted = sortQuotes(sampleQuotes, 'price', 'asc');
    expect(sorted.map(q => q.price)).toEqual([800, 1300, 1600]);
  });

  it('sorts by price descending', () => {
    const sorted = sortQuotes(sampleQuotes, 'price', 'desc');
    expect(sorted.map(q => q.price)).toEqual([1600, 1300, 800]);
  });

  it('sorts by dailyChangePercent ascending', () => {
    const sorted = sortQuotes(sampleQuotes, 'dailyChangePercent', 'asc');
    expect(sorted.map(q => q.changePercent)).toEqual([-0.5, 1.5, 2.1]);
  });

  it('sorts by dailyChangePercent descending', () => {
    const sorted = sortQuotes(sampleQuotes, 'dailyChangePercent', 'desc');
    expect(sorted.map(q => q.changePercent)).toEqual([2.1, 1.5, -0.5]);
  });

  it('sorts by volume ascending', () => {
    const sorted = sortQuotes(sampleQuotes, 'volume', 'asc');
    expect(sorted.map(q => q.volume)).toEqual([3000000, 5000000, 8000000]);
  });

  it('sorts by volume descending', () => {
    const sorted = sortQuotes(sampleQuotes, 'volume', 'desc');
    expect(sorted.map(q => q.volume)).toEqual([8000000, 5000000, 3000000]);
  });

  it('does not mutate the original array', () => {
    const original = [...sampleQuotes];
    sortQuotes(sampleQuotes, 'price', 'asc');
    expect(sampleQuotes).toEqual(original);
  });

  it('handles empty array', () => {
    const sorted = sortQuotes([], 'price', 'asc');
    expect(sorted).toEqual([]);
  });

  it('handles single element', () => {
    const single = [makeQuote({ price: 500 })];
    const sorted = sortQuotes(single, 'price', 'asc');
    expect(sorted).toHaveLength(1);
    expect(sorted[0].price).toBe(500);
  });

  it('handles equal values (stable-ish sort)', () => {
    const quotes = [
      makeQuote({ symbol: 'A.NS', price: 100 }),
      makeQuote({ symbol: 'B.NS', price: 100 }),
      makeQuote({ symbol: 'C.NS', price: 100 }),
    ];
    const sorted = sortQuotes(quotes, 'price', 'asc');
    expect(sorted).toHaveLength(3);
    // All prices should still be 100
    sorted.forEach(q => expect(q.price).toBe(100));
  });
});
