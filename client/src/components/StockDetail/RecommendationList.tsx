import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface Recommendation {
  firm: string;
  rating: 'Buy' | 'Hold' | 'Sell' | 'Strong Buy' | 'Strong Sell';
  targetPrice: number;
  date: string;
}

interface RecommendationData {
  symbol: string;
  consensusRating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  consensusScore: number;
  totalAnalysts: number;
  recommendations: Recommendation[];
}

interface RecommendationListProps {
  symbol: string;
}

/** Sort recommendations by date descending (most recent first). */
export function sortRecommendationsByDate(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return db - da;
  });
}

function consensusBadgeClass(rating: RecommendationData['consensusRating']): string {
  switch (rating) {
    case 'Strong Buy':
    case 'Buy':
      return 'consensus-badge consensus-buy';
    case 'Sell':
    case 'Strong Sell':
      return 'consensus-badge consensus-sell';
    case 'Hold':
    default:
      return 'consensus-badge consensus-hold';
  }
}

function ratingBadgeClass(rating: Recommendation['rating']): string {
  switch (rating) {
    case 'Strong Buy':
    case 'Buy':
      return 'rec-rating-badge rec-rating-buy';
    case 'Sell':
    case 'Strong Sell':
      return 'rec-rating-badge rec-rating-sell';
    case 'Hold':
    default:
      return 'rec-rating-badge rec-rating-hold';
  }
}

function formatINR(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RecommendationList({ symbol }: RecommendationListProps) {
  const [data, setData] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecommendations() {
      setLoading(true);
      setUnavailable(false);
      try {
        const res = await fetch(`${API_BASE}/api/recommendations/${symbol}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();

        if (cancelled) return;

        if (json.error) {
          setUnavailable(true);
          setData(null);
        } else {
          setData(json as RecommendationData);
        }
      } catch {
        if (!cancelled) {
          setUnavailable(true);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRecommendations();
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="recommendation-panel">
        <h3 className="recommendation-panel-title">Technical Analysis Signals</h3>
        <div className="recommendation-loading">Loading signals…</div>
      </div>
    );
  }

  if (unavailable || !data || data.recommendations.length === 0) {
    return (
      <div className="recommendation-panel">
        <h3 className="recommendation-panel-title">Technical Analysis Signals</h3>
        <div className="recommendation-empty">Signals unavailable</div>
      </div>
    );
  }

  const sorted = sortRecommendationsByDate(data.recommendations);

  return (
    <div className="recommendation-panel">
      <div className="rec-header-row">
        <h3 className="recommendation-panel-title">⚙️ Technical Analysis Signals</h3>
        <span className="rec-source-badge">Computed from price history</span>
      </div>
      <p className="rec-disclaimer-top">
        These are algorithm-generated signals based on moving averages, momentum, and volatility.
        For real analyst consensus, see the <strong>Institutional Analyst View</strong> at the top of this page.
      </p>

      <div className="recommendation-consensus">
        <span className={consensusBadgeClass(data.consensusRating)}>
          {data.consensusRating}
        </span>
        <span className="consensus-meta">
          Technical score {data.consensusScore.toFixed(1)} · {data.totalAnalysts} signal{data.totalAnalysts !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="recommendation-list">
        {sorted.map((rec, i) => (
          <div className="recommendation-item" key={`${rec.firm}-${rec.date}-${i}`}>
            <div className="rec-firm">{rec.firm}</div>
            <span className={ratingBadgeClass(rec.rating)}>{rec.rating}</span>
            <div className="rec-target">{formatINR(rec.targetPrice)}</div>
            <div className="rec-date">{formatDate(rec.date)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
