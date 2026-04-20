import { describe, it, expect } from 'vitest';
import { computeConsensusRating, type RatingType } from './consensusService.js';

describe('computeConsensusRating', () => {
  it('throws on empty array', () => {
    expect(() => computeConsensusRating([])).toThrow('Cannot compute consensus from an empty ratings array');
  });

  it('returns Strong Buy for all Strong Buy ratings', () => {
    const result = computeConsensusRating(['Strong Buy', 'Strong Buy', 'Strong Buy']);
    expect(result.consensusRating).toBe('Strong Buy');
    expect(result.consensusScore).toBe(5);
  });

  it('returns Strong Sell for all Strong Sell ratings', () => {
    const result = computeConsensusRating(['Strong Sell', 'Strong Sell']);
    expect(result.consensusRating).toBe('Strong Sell');
    expect(result.consensusScore).toBe(1);
  });

  it('returns Hold for all Hold ratings', () => {
    const result = computeConsensusRating(['Hold', 'Hold', 'Hold', 'Hold']);
    expect(result.consensusRating).toBe('Hold');
    expect(result.consensusScore).toBe(3);
  });

  it('computes correct average for mixed ratings', () => {
    // Buy(4) + Hold(3) + Sell(2) = 9/3 = 3.0 → Hold
    const result = computeConsensusRating(['Buy', 'Hold', 'Sell']);
    expect(result.consensusRating).toBe('Hold');
    expect(result.consensusScore).toBe(3);
  });

  it('rounds up when average is above .5', () => {
    // Strong Buy(5) + Buy(4) + Buy(4) = 13/3 = 4.33 → rounds to 4 → Buy
    const result = computeConsensusRating(['Strong Buy', 'Buy', 'Buy']);
    expect(result.consensusRating).toBe('Buy');
    expect(result.consensusScore).toBeCloseTo(4.33, 1);
  });

  it('rounds down when average is below .5', () => {
    // Hold(3) + Sell(2) + Sell(2) = 7/3 = 2.33 → rounds to 2 → Sell
    const result = computeConsensusRating(['Hold', 'Sell', 'Sell']);
    expect(result.consensusRating).toBe('Sell');
    expect(result.consensusScore).toBeCloseTo(2.33, 1);
  });

  it('handles a single rating', () => {
    const result = computeConsensusRating(['Buy']);
    expect(result.consensusRating).toBe('Buy');
    expect(result.consensusScore).toBe(4);
  });

  it('handles all five rating types together', () => {
    const ratings: RatingType[] = ['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'];
    // (5+4+3+2+1)/5 = 3.0 → Hold
    const result = computeConsensusRating(ratings);
    expect(result.consensusRating).toBe('Hold');
    expect(result.consensusScore).toBe(3);
  });

  it('heavily bullish consensus', () => {
    const ratings: RatingType[] = ['Strong Buy', 'Strong Buy', 'Buy', 'Buy', 'Hold'];
    // (5+5+4+4+3)/5 = 4.2 → rounds to 4 → Buy
    const result = computeConsensusRating(ratings);
    expect(result.consensusRating).toBe('Buy');
    expect(result.consensusScore).toBeCloseTo(4.2, 1);
  });

  it('heavily bearish consensus', () => {
    const ratings: RatingType[] = ['Strong Sell', 'Sell', 'Sell', 'Hold'];
    // (1+2+2+3)/4 = 2.0 → Sell
    const result = computeConsensusRating(ratings);
    expect(result.consensusRating).toBe('Sell');
    expect(result.consensusScore).toBe(2);
  });
});
