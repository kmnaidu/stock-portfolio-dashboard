import { describe, it, expect } from 'vitest';
import { formatMarketCap } from './MetricsPanel';

describe('formatMarketCap', () => {
  it('formats values >= 1 Lakh Cr as "₹X.XX Lakh Cr"', () => {
    // 1 Lakh Cr = 1e12
    expect(formatMarketCap(1e12)).toBe('₹1.00 Lakh Cr');
    expect(formatMarketCap(2.5e12)).toBe('₹2.50 Lakh Cr');
    expect(formatMarketCap(18.3e12)).toBe('₹18.30 Lakh Cr');
  });

  it('formats values >= 100 Cr and < 1 Lakh Cr as "₹X,XXX Cr"', () => {
    // 100 Cr = 1e9
    const result = formatMarketCap(5000 * 1e7); // 5000 Cr
    expect(result).toContain('Cr');
    expect(result).not.toContain('Lakh');
  });

  it('formats values < 100 Cr as "₹X.XX Cr"', () => {
    const result = formatMarketCap(50 * 1e7); // 50 Cr
    expect(result).toBe('₹50.00 Cr');
  });

  it('handles zero', () => {
    const result = formatMarketCap(0);
    expect(result).toBe('₹0.00 Cr');
  });

  it('handles very large values', () => {
    const result = formatMarketCap(20e12); // 20 Lakh Cr
    expect(result).toBe('₹20.00 Lakh Cr');
  });
});
