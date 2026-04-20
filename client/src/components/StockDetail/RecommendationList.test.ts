import { describe, it, expect } from 'vitest';
import { sortRecommendationsByDate } from './RecommendationList';

interface Recommendation {
  firm: string;
  rating: 'Buy' | 'Hold' | 'Sell' | 'Strong Buy' | 'Strong Sell';
  targetPrice: number;
  date: string;
}

describe('sortRecommendationsByDate', () => {
  it('sorts recommendations by date descending (most recent first)', () => {
    const recs: Recommendation[] = [
      { firm: 'A', rating: 'Buy', targetPrice: 100, date: '2026-01-01' },
      { firm: 'B', rating: 'Sell', targetPrice: 90, date: '2026-03-15' },
      { firm: 'C', rating: 'Hold', targetPrice: 95, date: '2026-02-10' },
    ];

    const sorted = sortRecommendationsByDate(recs);
    expect(sorted.map(r => r.firm)).toEqual(['B', 'C', 'A']);
  });

  it('handles empty array', () => {
    expect(sortRecommendationsByDate([])).toEqual([]);
  });

  it('handles single recommendation', () => {
    const recs: Recommendation[] = [
      { firm: 'Only', rating: 'Buy', targetPrice: 100, date: '2026-04-01' },
    ];
    const sorted = sortRecommendationsByDate(recs);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].firm).toBe('Only');
  });

  it('handles same dates', () => {
    const recs: Recommendation[] = [
      { firm: 'A', rating: 'Buy', targetPrice: 100, date: '2026-04-01' },
      { firm: 'B', rating: 'Sell', targetPrice: 90, date: '2026-04-01' },
    ];
    const sorted = sortRecommendationsByDate(recs);
    expect(sorted).toHaveLength(2);
  });

  it('does not mutate the original array', () => {
    const recs: Recommendation[] = [
      { firm: 'A', rating: 'Buy', targetPrice: 100, date: '2026-01-01' },
      { firm: 'B', rating: 'Sell', targetPrice: 90, date: '2026-03-15' },
    ];
    const original = [...recs];
    sortRecommendationsByDate(recs);
    expect(recs).toEqual(original);
  });

  it('correctly orders across year boundaries', () => {
    const recs: Recommendation[] = [
      { firm: 'Old', rating: 'Hold', targetPrice: 100, date: '2025-12-31' },
      { firm: 'New', rating: 'Buy', targetPrice: 110, date: '2026-01-01' },
    ];
    const sorted = sortRecommendationsByDate(recs);
    expect(sorted[0].firm).toBe('New');
    expect(sorted[1].firm).toBe('Old');
  });
});
