import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface RecTrend {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

interface AnalystData {
  symbol: string;
  targetMeanPrice: number;
  targetHighPrice: number;
  targetLowPrice: number;
  targetMedianPrice: number;
  numberOfAnalystOpinions: number;
  recommendationMean: number;
  recommendationKey: string;
  trailingPE: number;
  forwardPE: number;
  priceToBook: number;
  pegRatio: number;
  earningsGrowth: number;
  revenueGrowth: number;
  profitMargins: number;
  returnOnEquity: number;
  marketCap: number;
  beta: number;
  trailingEps: number;
  forwardEps: number;
  bookValue: number;
  dividendYield: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  sector: string;
  industry: string;
  recommendationTrend: RecTrend[];
}

interface Props {
  symbol: string;
  currentPrice: number;
}

function formatINR(v: number): string {
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(v: number): string {
  const pct = v * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function formatMarketCap(v: number): string {
  const crore = 1e7;
  const lakhCrore = 1e12;
  if (v >= lakhCrore) return `₹${(v / lakhCrore).toFixed(2)} Lakh Cr`;
  if (v >= 100 * crore) return `₹${Math.round(v / crore).toLocaleString('en-IN')} Cr`;
  return `₹${(v / crore).toFixed(2)} Cr`;
}

function recKeyLabel(key: string): { text: string; className: string } {
  switch (key) {
    case 'strong_buy': return { text: 'Strong Buy', className: 'analyst-strong-buy' };
    case 'buy': return { text: 'Buy', className: 'analyst-buy' };
    case 'hold': return { text: 'Hold', className: 'analyst-hold' };
    case 'sell': return { text: 'Sell', className: 'analyst-sell' };
    case 'strong_sell': return { text: 'Strong Sell', className: 'analyst-strong-sell' };
    default: return { text: 'No Rating', className: 'analyst-none' };
  }
}

export default function AnalystPanel({ symbol, currentPrice }: Props) {
  const [data, setData] = useState<AnalystData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/analyst/${symbol}`);
        if (!res.ok) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        const json = await res.json();
        if (!cancelled && !json.error) setData(json);
      } catch {
        if (!cancelled) setUnavailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="analyst-panel">
        <h3 className="analyst-panel-title">Institutional Analyst View (Real Data)</h3>
        <div className="analyst-loading">Loading analyst data…</div>
      </div>
    );
  }

  if (unavailable || !data) {
    return (
      <div className="analyst-panel">
        <h3 className="analyst-panel-title">Institutional Analyst View</h3>
        <div className="analyst-unavailable">
          <p>Real analyst data is unavailable.</p>
          <p className="analyst-hint">
            Start the Python yfinance service: <code>cd python-service && python3 app.py</code>
          </p>
        </div>
      </div>
    );
  }

  const hasTargets = data.targetMeanPrice > 0 && data.numberOfAnalystOpinions > 0;
  const recLabel = recKeyLabel(data.recommendationKey);
  const upside = hasTargets ? ((data.targetMeanPrice - currentPrice) / currentPrice) * 100 : 0;
  const latestTrend = data.recommendationTrend[0];
  const totalRatings = latestTrend
    ? latestTrend.strongBuy + latestTrend.buy + latestTrend.hold + latestTrend.sell + latestTrend.strongSell
    : 0;

  return (
    <div className="analyst-panel">
      <div className="analyst-header-row">
        <h3 className="analyst-panel-title">🏛️ Institutional Analyst View</h3>
        <span className="analyst-data-badge">Real Data · Yahoo Finance</span>
      </div>

      {/* Consensus Recommendation */}
      {hasTargets && (
        <div className="analyst-consensus-section">
          <div className="analyst-rec-row">
            <div className="analyst-rec-block">
              <span className="analyst-label">Consensus Rating</span>
              <span className={`analyst-rec-badge ${recLabel.className}`}>{recLabel.text}</span>
              <span className="analyst-sublabel">
                from {data.numberOfAnalystOpinions} analysts
              </span>
            </div>
            <div className="analyst-rec-block">
              <span className="analyst-label">Target Price (Mean)</span>
              <span className="analyst-target-price">{formatINR(data.targetMeanPrice)}</span>
              <span className={`analyst-upside ${upside >= 0 ? 'upside-pos' : 'upside-neg'}`}>
                {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% upside
              </span>
            </div>
            <div className="analyst-rec-block">
              <span className="analyst-label">Target Range</span>
              <span className="analyst-target-range">
                {formatINR(data.targetLowPrice)} — {formatINR(data.targetHighPrice)}
              </span>
              <span className="analyst-sublabel">Median: {formatINR(data.targetMedianPrice)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Rating Distribution */}
      {latestTrend && totalRatings > 0 && (
        <div className="analyst-section">
          <h4 className="analyst-section-title">Analyst Ratings Distribution ({latestTrend.period === '0m' ? 'This Month' : latestTrend.period})</h4>
          <div className="analyst-dist-grid">
            <div className="analyst-dist-item dist-strong-buy">
              <span className="dist-count">{latestTrend.strongBuy}</span>
              <span className="dist-label">Strong Buy</span>
            </div>
            <div className="analyst-dist-item dist-buy">
              <span className="dist-count">{latestTrend.buy}</span>
              <span className="dist-label">Buy</span>
            </div>
            <div className="analyst-dist-item dist-hold">
              <span className="dist-count">{latestTrend.hold}</span>
              <span className="dist-label">Hold</span>
            </div>
            <div className="analyst-dist-item dist-sell">
              <span className="dist-count">{latestTrend.sell}</span>
              <span className="dist-label">Sell</span>
            </div>
            <div className="analyst-dist-item dist-strong-sell">
              <span className="dist-count">{latestTrend.strongSell}</span>
              <span className="dist-label">Strong Sell</span>
            </div>
          </div>
        </div>
      )}

      {/* Valuation Metrics */}
      <div className="analyst-section">
        <h4 className="analyst-section-title">Valuation</h4>
        <div className="analyst-metrics-grid">
          {data.trailingPE > 0 && (
            <div className="analyst-metric">
              <span className="metric-label">P/E (TTM)</span>
              <span className="metric-value">{data.trailingPE.toFixed(2)}</span>
            </div>
          )}
          {data.forwardPE > 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Forward P/E</span>
              <span className="metric-value">{data.forwardPE.toFixed(2)}</span>
            </div>
          )}
          {data.priceToBook > 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Price/Book</span>
              <span className="metric-value">{data.priceToBook.toFixed(2)}</span>
            </div>
          )}
          {data.pegRatio > 0 && (
            <div className="analyst-metric">
              <span className="metric-label">PEG Ratio</span>
              <span className="metric-value">{data.pegRatio.toFixed(2)}</span>
            </div>
          )}
          {data.trailingEps > 0 && (
            <div className="analyst-metric">
              <span className="metric-label">EPS (TTM)</span>
              <span className="metric-value">{formatINR(data.trailingEps)}</span>
            </div>
          )}
          {data.bookValue > 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Book Value</span>
              <span className="metric-value">{formatINR(data.bookValue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Growth & Profitability */}
      <div className="analyst-section">
        <h4 className="analyst-section-title">Growth & Profitability</h4>
        <div className="analyst-metrics-grid">
          {data.revenueGrowth !== 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Revenue Growth (YoY)</span>
              <span className={`metric-value ${data.revenueGrowth >= 0 ? 'metric-positive' : 'metric-negative'}`}>
                {formatPercent(data.revenueGrowth)}
              </span>
            </div>
          )}
          {data.earningsGrowth !== 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Earnings Growth (YoY)</span>
              <span className={`metric-value ${data.earningsGrowth >= 0 ? 'metric-positive' : 'metric-negative'}`}>
                {formatPercent(data.earningsGrowth)}
              </span>
            </div>
          )}
          {data.profitMargins !== 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Profit Margin</span>
              <span className="metric-value">{formatPercent(data.profitMargins)}</span>
            </div>
          )}
          {data.returnOnEquity !== 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Return on Equity</span>
              <span className="metric-value">{formatPercent(data.returnOnEquity)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Market Data */}
      <div className="analyst-section">
        <h4 className="analyst-section-title">Market Data</h4>
        <div className="analyst-metrics-grid">
          {data.marketCap > 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Market Cap</span>
              <span className="metric-value">{formatMarketCap(data.marketCap)}</span>
            </div>
          )}
          {data.beta !== 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Beta (5Y)</span>
              <span className="metric-value">{data.beta.toFixed(2)}</span>
            </div>
          )}
          {data.dividendYield > 0 && (
            <div className="analyst-metric">
              <span className="metric-label">Dividend Yield</span>
              <span className="metric-value">{formatPercent(data.dividendYield / 100)}</span>
            </div>
          )}
          {data.industry && (
            <div className="analyst-metric">
              <span className="metric-label">Industry</span>
              <span className="metric-value-text">{data.industry}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
