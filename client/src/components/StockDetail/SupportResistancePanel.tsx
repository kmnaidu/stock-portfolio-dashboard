import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface SupportResistanceData {
  symbol: string;
  currentPrice: number;
  pivotPoint: number;
  support1: number;
  support2: number;
  support3: number;
  resistance1: number;
  resistance2: number;
  resistance3: number;
  sma20: number;
  sma50: number;
  sma200: number;
  buyRangeLow: number;
  buyRangeHigh: number;
  rsi14: number;
  macdSignal: 'bullish' | 'bearish' | 'neutral';
  verdict: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  verdictScore: number;
  verdictRationale: string;
}

interface Props {
  symbol: string;
}

function formatINR(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function verdictBadgeClass(verdict: string): string {
  switch (verdict) {
    case 'Strong Buy': return 'verdict-badge verdict-strong-buy';
    case 'Buy': return 'verdict-badge verdict-buy';
    case 'Neutral': return 'verdict-badge verdict-neutral';
    case 'Sell': return 'verdict-badge verdict-sell';
    case 'Strong Sell': return 'verdict-badge verdict-strong-sell';
    default: return 'verdict-badge verdict-neutral';
  }
}

function macdBadgeClass(signal: string): string {
  if (signal === 'bullish') return 'indicator-badge indicator-bullish';
  if (signal === 'bearish') return 'indicator-badge indicator-bearish';
  return 'indicator-badge indicator-neutral';
}

function rsiLabel(rsi: number): { text: string; className: string } {
  if (rsi < 30) return { text: 'Oversold', className: 'indicator-bullish' };
  if (rsi < 40) return { text: 'Near Oversold', className: 'indicator-bullish' };
  if (rsi <= 60) return { text: 'Neutral', className: 'indicator-neutral' };
  if (rsi <= 70) return { text: 'Near Overbought', className: 'indicator-bearish' };
  return { text: 'Overbought', className: 'indicator-bearish' };
}

export default function SupportResistancePanel({ symbol }: Props) {
  const [data, setData] = useState<SupportResistanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`${API_BASE}/api/support-resistance/${symbol}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (cancelled) return;
        if (json.error) { setError(true); return; }
        setData(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="sr-panel">
        <h3 className="sr-panel-title">Support & Resistance</h3>
        <div className="sr-loading">Loading analysis…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="sr-panel">
        <h3 className="sr-panel-title">Support & Resistance</h3>
        <div className="sr-error">Analysis unavailable</div>
      </div>
    );
  }

  const rsiInfo = rsiLabel(data.rsi14);

  return (
    <div className="sr-panel">
      {/* Verdict Banner */}
      <div className="sr-verdict-section">
        <div className="sr-verdict-row">
          <h3 className="sr-panel-title">Analyst Verdict</h3>
          <span className={verdictBadgeClass(data.verdict)}>{data.verdict}</span>
          <span className="sr-verdict-score">Score: {data.verdictScore.toFixed(1)}/5</span>
        </div>
        <p className="sr-verdict-rationale">{data.verdictRationale}</p>
      </div>

      {/* Buy Range */}
      <div className="sr-buy-range">
        <h4 className="sr-section-title">Buy Range</h4>
        <div className="sr-buy-range-values">
          <span className="sr-buy-low">{formatINR(data.buyRangeLow)}</span>
          <span className="sr-buy-separator">—</span>
          <span className="sr-buy-high">{formatINR(data.buyRangeHigh)}</span>
        </div>
        <p className="sr-buy-hint">
          {data.currentPrice <= data.buyRangeHigh
            ? '✅ Current price is within buy range'
            : `Current price is ${formatINR(data.currentPrice - data.buyRangeHigh)} above buy range`}
        </p>
      </div>

      {/* Support & Resistance Levels */}
      <div className="sr-levels">
        <h4 className="sr-section-title">Key Levels</h4>
        <div className="sr-levels-grid">
          <div className="sr-level-group">
            <span className="sr-level-header sr-resistance-header">Resistance</span>
            <div className="sr-level-item sr-resistance">
              <span className="sr-level-label">R3</span>
              <span className="sr-level-value">{formatINR(data.resistance3)}</span>
            </div>
            <div className="sr-level-item sr-resistance">
              <span className="sr-level-label">R2</span>
              <span className="sr-level-value">{formatINR(data.resistance2)}</span>
            </div>
            <div className="sr-level-item sr-resistance">
              <span className="sr-level-label">R1</span>
              <span className="sr-level-value">{formatINR(data.resistance1)}</span>
            </div>
          </div>

          <div className="sr-pivot-row">
            <span className="sr-level-label">Pivot</span>
            <span className="sr-level-value sr-pivot-value">{formatINR(data.pivotPoint)}</span>
          </div>

          <div className="sr-level-group">
            <span className="sr-level-header sr-support-header">Support</span>
            <div className="sr-level-item sr-support">
              <span className="sr-level-label">S1</span>
              <span className="sr-level-value">{formatINR(data.support1)}</span>
            </div>
            <div className="sr-level-item sr-support">
              <span className="sr-level-label">S2</span>
              <span className="sr-level-value">{formatINR(data.support2)}</span>
            </div>
            <div className="sr-level-item sr-support">
              <span className="sr-level-label">S3</span>
              <span className="sr-level-value">{formatINR(data.support3)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Indicators */}
      <div className="sr-indicators">
        <h4 className="sr-section-title">Technical Indicators</h4>
        <div className="sr-indicators-grid">
          <div className="sr-indicator-item">
            <span className="sr-indicator-label">RSI (14)</span>
            <span className="sr-indicator-value">{data.rsi14.toFixed(1)}</span>
            <span className={`indicator-badge ${rsiInfo.className}`}>{rsiInfo.text}</span>
          </div>
          <div className="sr-indicator-item">
            <span className="sr-indicator-label">MACD</span>
            <span className={macdBadgeClass(data.macdSignal)}>
              {data.macdSignal.charAt(0).toUpperCase() + data.macdSignal.slice(1)}
            </span>
          </div>
          <div className="sr-indicator-item">
            <span className="sr-indicator-label">SMA 20</span>
            <span className="sr-indicator-value">{formatINR(data.sma20)}</span>
          </div>
          <div className="sr-indicator-item">
            <span className="sr-indicator-label">SMA 50</span>
            <span className="sr-indicator-value">{formatINR(data.sma50)}</span>
          </div>
          <div className="sr-indicator-item">
            <span className="sr-indicator-label">SMA 200</span>
            <span className="sr-indicator-value">{formatINR(data.sma200)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
