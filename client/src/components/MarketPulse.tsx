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
    gold?: Indicator;
    silver?: Indicator;
    giftNifty?: Indicator;
    indiaVix?: Indicator;
  };
  niftyLevels?: {
    pivot: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
    current: number;
    bias: 'bullish' | 'bearish' | 'neutral';
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
  const indicators: Indicator[] = [
    data.indicators.nifty50,
    data.indicators.sensex,
    data.indicators.giftNifty,
    data.indicators.indiaVix,
    data.indicators.brentCrude,
    data.indicators.usdInr,
    data.indicators.gold,
    data.indicators.silver,
  ].filter((ind): ind is Indicator => ind !== undefined);

  // No separate commodities — all in top row

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
                {['Brent Crude', 'Gold', 'Silver'].includes(ind.label) ? `$${formatNumber(ind.value)}` :
                 ind.label === 'USD/INR' ? `₹${formatNumber(ind.value)}` :
                 ind.label === 'India VIX' ? formatNumber(ind.value) :
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
          <h4 className="mp-section-title">Institutional Flows & Global Markets</h4>
          <div className="mp-unified-grid">
            {/* FII/DII as compact cards */}
            <div className={`mp-global-card mp-global-${data.fiiDii.fiiSentiment === 'bullish' ? 'up' : data.fiiDii.fiiSentiment === 'bearish' ? 'down' : 'flat'}`}>
              <div className="mp-global-top">
                <span className="mp-global-flag">🏦</span>
                <span className="mp-global-name">FII/FPI</span>
              </div>
              <div className="mp-global-price">{formatCrore(data.fiiDii.fiiNet)}</div>
              <div className={`mp-global-change mp-gchange-${data.fiiDii.fiiSentiment === 'bullish' ? 'up' : data.fiiDii.fiiSentiment === 'bearish' ? 'down' : 'flat'}`}>
                {data.fiiDii.fiiSentiment === 'bullish' ? '🟢 Buying' :
                 data.fiiDii.fiiSentiment === 'bearish' ? '🔴 Selling' : '🟡 Neutral'}
              </div>
            </div>
            <div className={`mp-global-card mp-global-${data.fiiDii.diiSentiment === 'bullish' ? 'up' : data.fiiDii.diiSentiment === 'bearish' ? 'down' : 'flat'}`}>
              <div className="mp-global-top">
                <span className="mp-global-flag">🏛️</span>
                <span className="mp-global-name">DII</span>
              </div>
              <div className="mp-global-price">{formatCrore(data.fiiDii.diiNet)}</div>
              <div className={`mp-global-change mp-gchange-${data.fiiDii.diiSentiment === 'bullish' ? 'up' : data.fiiDii.diiSentiment === 'bearish' ? 'down' : 'flat'}`}>
                {data.fiiDii.diiSentiment === 'bullish' ? '🟢 Buying' :
                 data.fiiDii.diiSentiment === 'bearish' ? '🔴 Selling' : '🟡 Neutral'}
              </div>
            </div>
            {/* Global indices rendered inline */}
            <GlobalMarketsCards />
          </div>
        </div>
      )}

      {!data.fiiDii && (
        <div className="mp-fiidii-section">
          <h4 className="mp-section-title">🌍 Global Markets</h4>
          <div className="mp-unified-grid">
            <GlobalMarketsCards />
          </div>
        </div>
      )}
    </div>
  );
}

/** Just the global market cards (no wrapper) */
function GlobalMarketsCards() {
  const [indices, setIndices] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/api/global-markets`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setIndices(json.indices || []);
      } catch { /* ignore */ }
    }
    fetchData();
    const id = setInterval(fetchData, 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <>
      {indices.map((idx: any) => (
        <div key={idx.symbol} className={`mp-global-card mp-global-${idx.direction}`}>
          <div className="mp-global-top">
            <span className="mp-global-flag">{idx.flag}</span>
            <span className="mp-global-name">{idx.name}</span>
          </div>
          <div className="mp-global-price">
            {idx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`mp-global-change mp-gchange-${idx.direction}`}>
            {idx.direction === 'up' ? '▲' : idx.direction === 'down' ? '▼' : '—'}
            {' '}{idx.changePercent >= 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
          </div>
        </div>
      ))}
    </>
  );
}
