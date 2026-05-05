import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface Indicator {
  label: string;
  symbol: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  rationale: string;
}

interface FiiDii {
  date: string;
  fiiNet: number;
  fiiBuy: number;
  fiiSell: number;
  diiNet: number;
  diiBuy: number;
  diiSell: number;
  fiiSentiment: 'bullish' | 'bearish' | 'neutral';
  diiSentiment: 'bullish' | 'bearish' | 'neutral';
}

interface MarketPulseData {
  generatedAt: string;
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  overallScore: number;
  verdict: string;
  indicators: {
    nifty50: Indicator;
    sensex: Indicator;
    brentCrude: Indicator;
    usdInr: Indicator;
  };
  fiiDii: FiiDii | null;
}

function directionArrow(dir: string): string {
  if (dir === 'up') return '▲';
  if (dir === 'down') return '▼';
  return '—';
}

function sentimentClass(s: string): string {
  if (s === 'bullish') return 'mp-bullish';
  if (s === 'bearish') return 'mp-bearish';
  return 'mp-neutral';
}

function formatNumber(v: number, decimals = 2): string {
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCrore(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}₹${formatNumber(Math.abs(v))} Cr`;
}

export default function MarketPulse() {
  const [data, setData] = useState<MarketPulseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/api/market-pulse`);
        if (!res.ok) throw new Error('fail');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    }
    fetchData();
    // Refresh every 30 seconds for fresh index + FX values
    const id = setInterval(fetchData, 30 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) {
    return (
      <div className="mp-panel">
        <h3 className="mp-title">📊 Market Pulse — Daily Decision Framework</h3>
        <div className="mp-loading">Loading market indicators…</div>
      </div>
    );
  }

  if (!data) return null;

  const verdictClass = sentimentClass(data.overallSentiment);
  const indicators = [data.indicators.nifty50, data.indicators.sensex, data.indicators.brentCrude, data.indicators.usdInr];

  return (
    <div className={`mp-panel mp-${data.overallSentiment}`}>
      <div className="mp-header">
        <h3 className="mp-title">📊 Market Pulse — Daily Decision Framework</h3>
        <div className={`mp-score-badge ${verdictClass}`}>
          Score: {data.overallScore > 0 ? '+' : ''}{data.overallScore}
        </div>
      </div>

      <div className={`mp-verdict ${verdictClass}`}>
        {data.verdict}
      </div>

      <div className="mp-indicators-grid">
        {indicators.map((ind) => (
          <div key={ind.symbol} className={`mp-indicator ${sentimentClass(ind.sentiment)}`}>
            <div className="mp-ind-label">{ind.label}</div>
            <div className="mp-ind-value">
              <span className="mp-value-num">
                {ind.label === 'Brent Crude' ? `$${formatNumber(ind.value)}` :
                 ind.label === 'USD/INR' ? `₹${formatNumber(ind.value)}` :
                 formatNumber(ind.value)}
              </span>
              <span className="mp-arrow">{directionArrow(ind.direction)}</span>
            </div>
            <div className="mp-ind-change">
              {ind.change >= 0 ? '+' : ''}{formatNumber(ind.change)} ({ind.changePercent >= 0 ? '+' : ''}{formatNumber(ind.changePercent)}%)
            </div>
            <div className="mp-ind-rationale">{ind.rationale}</div>
          </div>
        ))}
      </div>

      {data.fiiDii && (
        <div className="mp-fiidii-section">
          <h4 className="mp-section-title">Institutional Flows ({data.fiiDii.date})</h4>
          <div className="mp-fiidii-grid">
            <div className={`mp-fiidii-item ${sentimentClass(data.fiiDii.fiiSentiment)}`}>
              <div className="mp-fiidii-label">FII / FPI (Foreign)</div>
              <div className="mp-fiidii-net">{formatCrore(data.fiiDii.fiiNet)}</div>
              <div className="mp-fiidii-detail">
                Buy ₹{formatNumber(data.fiiDii.fiiBuy)} Cr · Sell ₹{formatNumber(data.fiiDii.fiiSell)} Cr
              </div>
              <div className="mp-fiidii-sentiment">
                {data.fiiDii.fiiSentiment === 'bullish' ? '🟢 Net buying' :
                 data.fiiDii.fiiSentiment === 'bearish' ? '🔴 Net selling' :
                 '🟡 Neutral flow'}
              </div>
            </div>
            <div className={`mp-fiidii-item ${sentimentClass(data.fiiDii.diiSentiment)}`}>
              <div className="mp-fiidii-label">DII (Domestic)</div>
              <div className="mp-fiidii-net">{formatCrore(data.fiiDii.diiNet)}</div>
              <div className="mp-fiidii-detail">
                Buy ₹{formatNumber(data.fiiDii.diiBuy)} Cr · Sell ₹{formatNumber(data.fiiDii.diiSell)} Cr
              </div>
              <div className="mp-fiidii-sentiment">
                {data.fiiDii.diiSentiment === 'bullish' ? '🟢 Net buying' :
                 data.fiiDii.diiSentiment === 'bearish' ? '🔴 Net selling' :
                 '🟡 Neutral flow'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
