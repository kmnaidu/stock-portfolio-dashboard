import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface Prediction {
  horizon: '1w' | '1mo' | '3mo';
  predictedPrice: number;
  confidence: number;
  direction: 'up' | 'down' | 'neutral';
}

interface PredictionSet {
  symbol: string;
  generatedAt: string;
  predictions: Prediction[];
}

interface PredictionError {
  error: string;
  symbol: string;
  message: string;
}

interface PredictionPanelProps {
  symbol: string;
  currentPrice?: number;
}

const HORIZON_LABELS: Record<string, string> = {
  '1w': '1 Week',
  '1mo': '1 Month',
  '3mo': '3 Months',
};

function formatINR(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function directionArrow(direction: 'up' | 'down' | 'neutral'): string {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  return '→';
}

function directionClass(direction: 'up' | 'down' | 'neutral'): string {
  if (direction === 'up') return 'prediction-up';
  if (direction === 'down') return 'prediction-down';
  return 'prediction-neutral';
}

export default function PredictionPanel({ symbol, currentPrice }: PredictionPanelProps) {
  const [predictions, setPredictions] = useState<PredictionSet | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPredictions() {
      setLoading(true);
      setUnavailable(false);
      try {
        const res = await fetch(`${API_BASE}/api/predictions/${symbol}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();

        if (cancelled) return;

        if (json.error === 'PREDICTION_UNAVAILABLE') {
          setUnavailable(true);
          setPredictions(null);
        } else {
          setPredictions(json as PredictionSet);
        }
      } catch {
        if (!cancelled) {
          setUnavailable(true);
          setPredictions(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPredictions();
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="prediction-panel">
        <h3 className="prediction-panel-title">Price Predictions</h3>
        <div className="prediction-loading">Loading predictions…</div>
      </div>
    );
  }

  if (unavailable || !predictions) {
    return (
      <div className="prediction-panel">
        <h3 className="prediction-panel-title">Price Predictions</h3>
        <div className="prediction-unavailable">Prediction Unavailable</div>
      </div>
    );
  }

  return (
    <div className="prediction-panel">
      <h3 className="prediction-panel-title">Price Predictions</h3>

      <div className="prediction-cards">
        {predictions.predictions.map((p) => {
          const change = currentPrice != null ? p.predictedPrice - currentPrice : null;
          const changePct = currentPrice != null && currentPrice !== 0
            ? ((p.predictedPrice - currentPrice) / currentPrice) * 100
            : null;

          return (
            <div key={p.horizon} className={`prediction-card ${directionClass(p.direction)}`}>
              <div className="prediction-horizon">{HORIZON_LABELS[p.horizon] ?? p.horizon}</div>

              <div className="prediction-price-row">
                <span className="prediction-arrow">{directionArrow(p.direction)}</span>
                <span className="prediction-price">{formatINR(p.predictedPrice)}</span>
              </div>

              {change != null && changePct != null && (
                <div className="prediction-change">
                  {change >= 0 ? '+' : ''}{formatINR(change)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                </div>
              )}

              <div className="prediction-confidence">
                <span className="prediction-confidence-label">Confidence</span>
                <div className="prediction-confidence-bar">
                  <div
                    className="prediction-confidence-fill"
                    style={{ width: `${Math.min(Math.max(p.confidence, 0), 100)}%` }}
                  />
                </div>
                <span className="prediction-confidence-value">{p.confidence.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="prediction-disclaimer">
        Predictions are model-generated estimates and not financial advice.
      </p>
    </div>
  );
}
