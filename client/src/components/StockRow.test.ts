import { describe, it, expect } from 'vitest';
import { getPriceDirection } from './StockRow';

describe('getPriceDirection', () => {
  it('returns "up" when current price > previous close', () => {
    expect(getPriceDirection(105, 100)).toBe('up');
  });

  it('returns "down" when current price < previous close', () => {
    expect(getPriceDirection(95, 100)).toBe('down');
  });

  it('returns "neutral" when prices are equal', () => {
    expect(getPriceDirection(100, 100)).toBe('neutral');
  });

  it('handles very small differences (up)', () => {
    expect(getPriceDirection(100.01, 100.00)).toBe('up');
  });

  it('handles very small differences (down)', () => {
    expect(getPriceDirection(99.99, 100.00)).toBe('down');
  });

  it('handles large prices', () => {
    expect(getPriceDirection(25000, 24500)).toBe('up');
    expect(getPriceDirection(24500, 25000)).toBe('down');
  });

  it('handles zero previous close', () => {
    expect(getPriceDirection(10, 0)).toBe('up');
  });

  it('handles both zero', () => {
    expect(getPriceDirection(0, 0)).toBe('neutral');
  });
});
