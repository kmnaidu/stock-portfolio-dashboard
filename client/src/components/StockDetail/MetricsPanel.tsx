import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface SummaryData {
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  peRatio: number;
  dividendYield: number;
}

interface MetricsPanelProps {
  symbol: string;
}

/** Format a number as Indian Rupees */
function formatINR(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format market cap for Indian audience.
 * 1 Cr = 10,000,000 (1e7)
 * 1 Lakh Cr = 1,000,000,000,000 (1e12)
 *
 * < 100 Cr          → "₹X.XX Cr"
 * >= 100 Cr & < 1 Lakh Cr → "₹X,XXX Cr"  (whole number with commas)
 * >= 1 Lakh Cr      → "₹X.XX Lakh Cr"
 */
export function formatMarketCap(value: number): string {
  const crore = 1e7;
  const lakhCrore = 1e12;

  const inCr = value / crore;

  if (value >= lakhCrore) {
    const inLakhCr = value / lakhCrore;
    return `₹${inLakhCr.toFixed(2)} Lakh Cr`;
  }

  if (inCr >= 100) {
    return `₹${Math.round(inCr).toLocaleString('en-IN')} Cr`;
  }

  return `₹${inCr.toFixed(2)} Cr`;
}

export default function MetricsPanel({ symbol }: MetricsPanelProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`${API_BASE}/api/summary/${symbol}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (cancelled) return;
        setData(json as SummaryData);
      } catch {
        if (!cancelled) {
          setError(true);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSummary();
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="metrics-panel">
        <h3 className="metrics-panel-title">Key Metrics</h3>
        <div className="metrics-loading">Loading metrics…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="metrics-panel">
        <h3 className="metrics-panel-title">Key Metrics</h3>
        <div className="metrics-error">Unable to load metrics</div>
      </div>
    );
  }

  return (
    <div className="metrics-panel">
      <h3 className="metrics-panel-title">Key Metrics</h3>
      <div className="metrics-grid">
        <div className="metric-item">
          <span className="metric-label">52-Week High</span>
          <span className="metric-value">{data.fiftyTwoWeekHigh ? formatINR(data.fiftyTwoWeekHigh) : 'N/A'}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">52-Week Low</span>
          <span className="metric-value">{data.fiftyTwoWeekLow ? formatINR(data.fiftyTwoWeekLow) : 'N/A'}</span>
        </div>
        {data.marketCap > 0 && (
          <div className="metric-item">
            <span className="metric-label">Market Cap</span>
            <span className="metric-value">{formatMarketCap(data.marketCap)}</span>
          </div>
        )}
        {data.peRatio > 0 && (
          <div className="metric-item">
            <span className="metric-label">P/E Ratio</span>
            <span className="metric-value">{data.peRatio.toFixed(2)}</span>
          </div>
        )}
        {data.dividendYield > 0 && (
          <div className="metric-item">
            <span className="metric-label">Dividend Yield</span>
            <span className="metric-value">{(data.dividendYield * 100).toFixed(2)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
