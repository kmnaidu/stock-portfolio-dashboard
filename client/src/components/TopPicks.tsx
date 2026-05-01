import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWatchlist } from '../context/WatchlistContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface AnalystPickItem {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  hasAnalystData: boolean;
  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  upsidePercent?: number;
  upsideToHigh?: number;
  upsideToLow?: number;
  numberOfAnalystOpinions: number;
  recommendationKey?: string;
  recommendationMean?: number;
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
}

interface TopPicksResponse {
  withAnalystData: AnalystPickItem[];
  withoutAnalystData: AnalystPickItem[];
  generatedAt: string;
}

function formatINR(v: number): string {
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function recKeyLabel(key: string): { text: string; className: string } {
  switch (key) {
    case 'strong_buy': return { text: 'Strong Buy', className: 'rec-strong-buy' };
    case 'buy': return { text: 'Buy', className: 'rec-buy' };
    case 'hold': return { text: 'Hold', className: 'rec-hold' };
    case 'sell': return { text: 'Sell', className: 'rec-sell' };
    case 'strong_sell': return { text: 'Strong Sell', className: 'rec-strong-sell' };
    default: return { text: 'No Rating', className: 'rec-none' };
  }
}

export default function TopPicks() {
  const [data, setData] = useState<TopPicksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const { symbols } = useWatchlist();
  const symbolsKey = symbols.join(',');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/top-picks?symbols=${encodeURIComponent(symbolsKey)}`);
        if (!res.ok) throw new Error('fail');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [symbolsKey]);

  if (loading) {
    return (
      <div className="tp-panel">
        <h3 className="tp-title">🎯 Top Picks — Real Analyst Consensus</h3>
        <div className="tp-loading">Fetching analyst data for all stocks… this takes a moment on first load</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="tp-panel">
        <h3 className="tp-title">🎯 Top Picks</h3>
        <div className="tp-loading">
          <p>Analyst data unavailable.</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Make sure the Python yfinance service is running on port 5001.
          </p>
        </div>
      </div>
    );
  }

  const highPotential = data.withAnalystData.filter(d => (d.upsidePercent ?? 0) >= 20);
  const moderate = data.withAnalystData.filter(d => (d.upsidePercent ?? 0) >= 10 && (d.upsidePercent ?? 0) < 20);
  const low = data.withAnalystData.filter(d => (d.upsidePercent ?? 0) < 10);

  return (
    <div className="tp-panel">
      <div className="tp-header-row">
        <h3 className="tp-title">🎯 Top Picks — Real Analyst Consensus</h3>
        <span className="tp-data-badge">Real Analyst Data · Yahoo Finance</span>
      </div>

      {highPotential.length > 0 && (
        <>
          <h4 className="tp-subtitle tp-high-subtitle">
            🚀 High Potential — 20%+ Analyst Upside ({highPotential.length} stocks)
          </h4>
          <div className="tp-cards">
            {highPotential.map((item) => (
              <PickCard key={item.symbol} item={item} navigate={navigate} highlight />
            ))}
          </div>
        </>
      )}

      {moderate.length > 0 && (
        <>
          <h4 className="tp-subtitle">Moderate Upside (10-20%)</h4>
          <div className="tp-cards">
            {moderate.map((item) => (
              <PickCard key={item.symbol} item={item} navigate={navigate} />
            ))}
          </div>
        </>
      )}

      {low.length > 0 && (
        <>
          <h4 className="tp-subtitle">Limited Upside (&lt; 10%)</h4>
          <div className="tp-others-list">
            {low.map((item) => (
              <div
                key={item.symbol}
                className="tp-other-row"
                onClick={() => navigate(`/stock/${item.symbol}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/stock/${item.symbol}`)}
              >
                <span className="tp-other-name">{item.name}</span>
                <span className="tp-other-sector">{item.sector}</span>
                <span className="tp-other-price">{formatINR(item.currentPrice)}</span>
                <span className={`tp-other-upside ${(item.upsidePercent ?? 0) < 0 ? 'tp-negative' : ''}`}>
                  {(item.upsidePercent ?? 0) >= 0 ? '+' : ''}{(item.upsidePercent ?? 0).toFixed(1)}%
                </span>
                {item.recommendationKey && (
                  <span className={`tp-badge ${recKeyLabel(item.recommendationKey).className}`}>
                    {recKeyLabel(item.recommendationKey).text}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {data.withoutAnalystData.length > 0 && (
        <>
          <h4 className="tp-subtitle">No Analyst Coverage (ETFs & others)</h4>
          <div className="tp-others-list">
            {data.withoutAnalystData.map((item) => (
              <div
                key={item.symbol}
                className="tp-other-row tp-no-analyst-row"
                onClick={() => navigate(`/stock/${item.symbol}`)}
                role="button"
                tabIndex={0}
              >
                <span className="tp-other-name">{item.name}</span>
                <span className="tp-other-sector">{item.sector}</span>
                <span className="tp-other-price">{formatINR(item.currentPrice)}</span>
                <span className="tp-no-analyst-text">No analyst coverage</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="tp-disclaimer">
        Target prices and recommendations come from institutional analysts tracked by Yahoo Finance.
        Not financial advice — always do your own research.
      </p>
    </div>
  );
}

function PickCard({ item, navigate, highlight = false }: {
  item: AnalystPickItem;
  navigate: (path: string) => void;
  highlight?: boolean;
}) {
  const rec = recKeyLabel(item.recommendationKey ?? 'none');

  return (
    <div
      className={`tp-card ${highlight ? 'tp-card-highlight' : ''}`}
      onClick={() => navigate(`/stock/${item.symbol}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/stock/${item.symbol}`)}
    >
      <div className="tp-card-header">
        <span className="tp-card-name">{item.name}</span>
        <span className="tp-card-sector">{item.sector}</span>
      </div>

      <div className="tp-card-body">
        <div className="tp-card-price">
          <span className="tp-price-label">Current</span>
          <span className="tp-price-value">{formatINR(item.currentPrice)}</span>
        </div>
        <div className="tp-card-target">
          <span className="tp-price-label">Target</span>
          <span className="tp-price-value tp-target-value">{formatINR(item.targetMeanPrice ?? 0)}</span>
        </div>
        <div className="tp-card-upside">
          <span className="tp-upside-value">
            {(item.upsidePercent ?? 0) >= 0 ? '+' : ''}{(item.upsidePercent ?? 0).toFixed(1)}%
          </span>
          <span className={`tp-badge ${rec.className}`}>{rec.text}</span>
        </div>
      </div>

      <div className="tp-card-meta">
        <span className="tp-meta-item">
          📊 {item.numberOfAnalystOpinions} analysts
        </span>
        <span className="tp-meta-item">
          🎯 Range: {formatINR(item.targetLowPrice ?? 0)} - {formatINR(item.targetHighPrice ?? 0)}
        </span>
      </div>

      {((item.trailingPE ?? 0) > 0 || (item.pegRatio ?? 0) > 0) && (
        <div className="tp-card-fundamentals">
          {(item.trailingPE ?? 0) > 0 && <span className="tp-fund">P/E: {item.trailingPE!.toFixed(1)}</span>}
          {(item.pegRatio ?? 0) > 0 && <span className="tp-fund">PEG: {item.pegRatio!.toFixed(2)}</span>}
          {(item.revenueGrowth ?? 0) !== 0 && (
            <span className={`tp-fund ${(item.revenueGrowth ?? 0) >= 0 ? 'tp-fund-pos' : 'tp-fund-neg'}`}>
              Rev: {(item.revenueGrowth! * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
