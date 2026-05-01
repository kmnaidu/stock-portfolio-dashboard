import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface GrowthData {
  symbol: string;
  currentPrice: number;
  estimatedTarget: number;
  estimatedUpsidePercent: number;
  confidence: number;
  rating: string;
  historicalGrowthRate: number;
  meanReversionScore: number;
  trendStrength: number;
  riskAdjustedScore: number;
  rsiScore: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerPosition: string;
  currentVolume: number;
  avgVolume20d: number;
  volumeRatio: number;
  volumeTrend: string;
  obvTrend: string;
}

interface AnalystData {
  targetMeanPrice: number;
  targetHighPrice: number;
  targetLowPrice: number;
  numberOfAnalystOpinions: number;
  recommendationKey: string;
}

interface Props {
  symbol: string;
  currentPrice: number;
}

function formatINR(v: number): string {
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(v: number): string {
  return v.toLocaleString('en-IN', { notation: 'compact', maximumFractionDigits: 1 } as any);
}

function bbLabel(pos: string): string {
  if (pos === 'below_lower') return 'Below Lower Band (Oversold)';
  if (pos === 'lower_half') return 'Lower Half';
  if (pos === 'upper_half') return 'Upper Half';
  return 'Above Upper Band (Overbought)';
}

function bbClass(pos: string): string {
  if (pos === 'below_lower') return 'indicator-bullish';
  if (pos === 'lower_half') return 'indicator-bullish';
  if (pos === 'upper_half') return 'indicator-neutral';
  return 'indicator-bearish';
}

function trendIcon(trend: string): string {
  if (trend === 'bullish' || trend === 'increasing') return '📈';
  if (trend === 'bearish' || trend === 'decreasing') return '📉';
  return '➡️';
}

/**
 * Computes rating from real analyst upside if available,
 * otherwise falls back to technical estimate.
 * This keeps consistency with the Top Picks section on the dashboard.
 */
function computeRatingFromUpside(upsidePercent: number, confidence: number): string {
  if (upsidePercent >= 20 && confidence >= 40) return 'High Potential';
  if (upsidePercent >= 10) return 'Moderate Potential';
  if (upsidePercent >= 0) return 'Low Potential';
  return 'Risky';
}

function ratingClass(rating: string): string {
  if (rating === 'High Potential') return 'gp-badge gp-high';
  if (rating === 'Moderate Potential') return 'gp-badge gp-moderate';
  if (rating === 'Low Potential') return 'gp-badge gp-low';
  return 'gp-badge gp-risky';
}

export default function GrowthPotentialPanel({ symbol, currentPrice }: Props) {
  const [growthData, setGrowthData] = useState<GrowthData | null>(null);
  const [analystData, setAnalystData] = useState<AnalystData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      try {
        const [growthRes, analystRes] = await Promise.all([
          fetch(`${API_BASE}/api/growth-potential/${symbol}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API_BASE}/api/analyst/${symbol}`).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (!cancelled) {
          if (growthRes && !growthRes.error) setGrowthData(growthRes);
          if (analystRes && !analystRes.error && analystRes.numberOfAnalystOpinions > 0) {
            setAnalystData(analystRes);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) return (
    <div className="gp-panel">
      <h3 className="gp-title">Growth Potential & Volume Analysis</h3>
      <div className="gp-loading">Loading analysis…</div>
    </div>
  );

  if (!growthData) return (
    <div className="gp-panel">
      <h3 className="gp-title">Growth Potential & Volume Analysis</h3>
      <div className="gp-loading">Analysis unavailable</div>
    </div>
  );

  // Use real analyst data when available, otherwise fall back to technical estimate
  const hasAnalystData = analystData !== null;
  const target = hasAnalystData ? analystData!.targetMeanPrice : growthData.estimatedTarget;
  const upsidePercent = hasAnalystData
    ? ((analystData!.targetMeanPrice - currentPrice) / currentPrice) * 100
    : growthData.estimatedUpsidePercent;
  const confidence = hasAnalystData ? 90 : growthData.confidence; // Real analysts = high confidence
  const rating = computeRatingFromUpside(upsidePercent, confidence);
  const isPositive = upsidePercent >= 0;

  return (
    <div className="gp-panel">
      {/* Target & Rating */}
      <div className="gp-header-section">
        <div className="gp-header-row">
          <h3 className="gp-title">1-Year Growth Potential</h3>
          <span className={ratingClass(rating)}>{rating}</span>
          {hasAnalystData && <span className="gp-data-source">📊 {analystData!.numberOfAnalystOpinions} analysts</span>}
          {!hasAnalystData && <span className="gp-data-source gp-technical">⚙️ Technical estimate</span>}
        </div>
        <div className="gp-target-row">
          <div className="gp-target-block">
            <span className="gp-target-label">{hasAnalystData ? 'Analyst Target (Mean)' : 'Estimated Target'}</span>
            <span className="gp-target-price">{formatINR(target)}</span>
          </div>
          <div className="gp-target-block">
            <span className="gp-target-label">Upside from Current</span>
            <span className={`gp-upside ${isPositive ? 'gp-upside-positive' : 'gp-upside-negative'}`}>
              {isPositive ? '+' : ''}{upsidePercent.toFixed(1)}%
            </span>
          </div>
          {hasAnalystData && (
            <div className="gp-target-block">
              <span className="gp-target-label">Analyst Range</span>
              <span className="gp-target-range-text">
                {formatINR(analystData!.targetLowPrice)} — {formatINR(analystData!.targetHighPrice)}
              </span>
            </div>
          )}
          <div className="gp-target-block">
            <span className="gp-target-label">Confidence</span>
            <div className="gp-confidence-bar">
              <div className="gp-confidence-fill" style={{ width: `${confidence}%` }} />
            </div>
            <span className="gp-confidence-value">{confidence}%</span>
          </div>
        </div>
      </div>

      {/* Technical Score Breakdown */}
      <div className="gp-scores-section">
        <h4 className="gp-section-title">Technical Score Breakdown</h4>
        <div className="gp-scores-grid">
          <div className="gp-score-item">
            <span className="gp-score-label">Historical Growth</span>
            <span className="gp-score-value">{growthData.historicalGrowthRate > 0 ? '+' : ''}{growthData.historicalGrowthRate.toFixed(1)}% p.a.</span>
          </div>
          <div className="gp-score-item">
            <span className="gp-score-label">Mean Reversion</span>
            <div className="gp-mini-bar"><div className="gp-mini-fill" style={{ width: `${growthData.meanReversionScore}%` }} /></div>
            <span className="gp-score-num">{growthData.meanReversionScore}/100</span>
          </div>
          <div className="gp-score-item">
            <span className="gp-score-label">Trend Strength</span>
            <div className="gp-mini-bar"><div className="gp-mini-fill" style={{ width: `${growthData.trendStrength}%` }} /></div>
            <span className="gp-score-num">{growthData.trendStrength}/100</span>
          </div>
          <div className="gp-score-item">
            <span className="gp-score-label">Risk-Adjusted</span>
            <div className="gp-mini-bar"><div className="gp-mini-fill" style={{ width: `${growthData.riskAdjustedScore}%` }} /></div>
            <span className="gp-score-num">{growthData.riskAdjustedScore}/100</span>
          </div>
        </div>
      </div>

      {/* Bollinger Bands */}
      <div className="gp-bb-section">
        <h4 className="gp-section-title">Bollinger Bands (20, 2)</h4>
        <div className="gp-bb-grid">
          <div className="gp-bb-item"><span className="gp-bb-label">Upper</span><span className="gp-bb-value">{formatINR(growthData.bollingerUpper)}</span></div>
          <div className="gp-bb-item"><span className="gp-bb-label">Middle (SMA20)</span><span className="gp-bb-value">{formatINR(growthData.bollingerMiddle)}</span></div>
          <div className="gp-bb-item"><span className="gp-bb-label">Lower</span><span className="gp-bb-value">{formatINR(growthData.bollingerLower)}</span></div>
          <div className="gp-bb-item">
            <span className="gp-bb-label">Position</span>
            <span className={`indicator-badge ${bbClass(growthData.bollingerPosition)}`}>{bbLabel(growthData.bollingerPosition)}</span>
          </div>
        </div>
      </div>

      {/* Volume Analysis */}
      <div className="gp-vol-section">
        <h4 className="gp-section-title">Volume Analysis</h4>
        <div className="gp-vol-grid">
          <div className="gp-vol-item">
            <span className="gp-vol-label">Today's Volume</span>
            <span className="gp-vol-value">{formatVolume(growthData.currentVolume)}</span>
          </div>
          <div className="gp-vol-item">
            <span className="gp-vol-label">20-Day Avg</span>
            <span className="gp-vol-value">{formatVolume(growthData.avgVolume20d)}</span>
          </div>
          <div className="gp-vol-item">
            <span className="gp-vol-label">Volume Ratio</span>
            <span className={`gp-vol-value ${growthData.volumeRatio > 1.2 ? 'gp-vol-high' : growthData.volumeRatio < 0.8 ? 'gp-vol-low' : ''}`}>
              {growthData.volumeRatio.toFixed(2)}x
            </span>
          </div>
          <div className="gp-vol-item">
            <span className="gp-vol-label">Volume Trend</span>
            <span className="gp-vol-value">{trendIcon(growthData.volumeTrend)} {growthData.volumeTrend}</span>
          </div>
          <div className="gp-vol-item">
            <span className="gp-vol-label">OBV Trend</span>
            <span className="gp-vol-value">{trendIcon(growthData.obvTrend)} {growthData.obvTrend}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
