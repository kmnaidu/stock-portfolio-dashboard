// ============================================================
// Growth Potential Service — estimates 1-year upside potential
// for each stock using historical trends, mean reversion,
// momentum, and risk-adjusted returns.
// ============================================================

export interface GrowthPotentialData {
  symbol: string;
  currentPrice: number;
  estimatedTarget: number;
  estimatedUpsidePercent: number;
  confidence: number;          // 0-100
  rating: 'High Potential' | 'Moderate Potential' | 'Low Potential' | 'Risky';
  generatedAt: string;

  // Component scores
  historicalGrowthRate: number;   // annualized % return
  meanReversionScore: number;    // 0-100 (higher = more room to recover)
  trendStrength: number;         // 0-100
  riskAdjustedScore: number;     // Sharpe-like ratio scaled 0-100
  rsiScore: number;              // 0-100 (oversold = higher score)

  // Bollinger Bands
  bollingerUpper: number;
  bollingerMiddle: number;       // SMA20
  bollingerLower: number;
  bollingerPosition: 'above_upper' | 'upper_half' | 'lower_half' | 'below_lower';

  // Volume analysis
  currentVolume: number;
  avgVolume20d: number;
  volumeRatio: number;           // current / avg (>1 = above average)
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  obvTrend: 'bullish' | 'bearish' | 'neutral';  // On-Balance Volume
}

// ── Bollinger Bands ──────────────────────────────────────────
function computeBollingerBands(prices: number[], period: number = 20) {
  if (prices.length < period) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { upper: avg, middle: avg, lower: avg };
  }

  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + (p - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: middle + 2 * stdDev,
    middle,
    lower: middle - 2 * stdDev,
  };
}

// ── On-Balance Volume (OBV) ──────────────────────────────────
function computeOBVTrend(
  prices: number[],
  volumes: number[],
): 'bullish' | 'bearish' | 'neutral' {
  if (prices.length < 20) return 'neutral';

  let obv = 0;
  const obvValues: number[] = [0];

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) obv += volumes[i];
    else if (prices[i] < prices[i - 1]) obv -= volumes[i];
    obvValues.push(obv);
  }

  // Compare OBV trend over last 20 days
  const recent = obvValues.slice(-20);
  const firstHalf = recent.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
  const secondHalf = recent.slice(-10).reduce((a, b) => a + b, 0) / 10;

  const change = ((secondHalf - firstHalf) / (Math.abs(firstHalf) || 1)) * 100;
  if (change > 5) return 'bullish';
  if (change < -5) return 'bearish';
  return 'neutral';
}

// ── Volume trend ─────────────────────────────────────────────
function computeVolumeTrend(volumes: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (volumes.length < 20) return 'stable';

  const recent10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const prev10 = volumes.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;

  const change = ((recent10 - prev10) / (prev10 || 1)) * 100;
  if (change > 15) return 'increasing';
  if (change < -15) return 'decreasing';
  return 'stable';
}

// ── RSI ──────────────────────────────────────────────────────
function computeRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// ── Main computation ─────────────────────────────────────────
export function computeGrowthPotential(
  symbol: string,
  closingPrices: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  fiftyTwoWeekHigh: number,
  fiftyTwoWeekLow: number,
): GrowthPotentialData {
  const n = closingPrices.length;
  const currentPrice = closingPrices[n - 1];

  // 1. Historical growth rate (annualized)
  const priceOneYearAgo = closingPrices[0];
  const totalReturn = ((currentPrice - priceOneYearAgo) / priceOneYearAgo) * 100;
  const tradingDays = n;
  const annualizedGrowth = (totalReturn / tradingDays) * 252;

  // 2. Mean reversion score (distance from 52-week high)
  const distFromHigh = ((fiftyTwoWeekHigh - currentPrice) / fiftyTwoWeekHigh) * 100;
  // More distance from high = more room to recover = higher score
  const meanReversionScore = Math.min(100, Math.max(0, distFromHigh * 3));

  // 3. Trend strength (using linear regression R²)
  const xMean = (n - 1) / 2;
  const yMean = closingPrices.reduce((a, b) => a + b, 0) / n;
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (i - xMean) * (closingPrices[i] - yMean);
    ssXX += (i - xMean) ** 2;
    ssYY += (closingPrices[i] - yMean) ** 2;
  }
  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const rSquared = ssYY !== 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;
  const trendStrength = Math.round(rSquared * 100);
  const isUptrend = slope > 0;

  // 4. Risk-adjusted score (Sharpe-like)
  const returns: number[] = [];
  for (let i = 1; i < n; i++) {
    returns.push((closingPrices[i] - closingPrices[i - 1]) / closingPrices[i - 1]);
  }
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length
  );
  const sharpe = stdReturn !== 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;
  const riskAdjustedScore = Math.min(100, Math.max(0, (sharpe + 2) * 25));

  // 5. RSI score (oversold = higher potential)
  const rsi = computeRSI(closingPrices);
  const rsiScore = Math.min(100, Math.max(0, (70 - rsi) * 2 + 50));

  // 6. Bollinger Bands
  const bb = computeBollingerBands(closingPrices);
  let bollingerPosition: GrowthPotentialData['bollingerPosition'];
  if (currentPrice > bb.upper) bollingerPosition = 'above_upper';
  else if (currentPrice > bb.middle) bollingerPosition = 'upper_half';
  else if (currentPrice > bb.lower) bollingerPosition = 'lower_half';
  else bollingerPosition = 'below_lower';

  // Bollinger bonus: below lower band = more upside potential
  const bbBonus = bollingerPosition === 'below_lower' ? 15
    : bollingerPosition === 'lower_half' ? 5
    : bollingerPosition === 'upper_half' ? -5
    : -10;

  // 7. Volume analysis
  const avgVolume20d = volumes.length >= 20
    ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
    : volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const currentVolume = volumes[volumes.length - 1] ?? 0;
  const volumeRatio = avgVolume20d !== 0 ? currentVolume / avgVolume20d : 1;
  const volumeTrend = computeVolumeTrend(volumes);
  const obvTrend = computeOBVTrend(closingPrices, volumes);

  // ── Estimate 1-year target ─────────────────────────────
  // Weighted combination of signals
  const weights = {
    historicalGrowth: 0.25,
    meanReversion: 0.25,
    trend: 0.20,
    riskAdjusted: 0.15,
    rsi: 0.10,
    bollinger: 0.05,
  };

  // Each component contributes an estimated % move
  const historicalComponent = annualizedGrowth * weights.historicalGrowth;
  const meanRevComponent = (meanReversionScore / 100) * 30 * weights.meanReversion;
  const trendComponent = (isUptrend ? 1 : -0.5) * (trendStrength / 100) * 25 * weights.trend;
  const riskComponent = (riskAdjustedScore / 100) * 20 * weights.riskAdjusted;
  const rsiComponent = ((rsiScore - 50) / 50) * 15 * weights.rsi;
  const bbComponent = bbBonus * weights.bollinger;

  const estimatedUpsidePercent = Math.round(
    (historicalComponent + meanRevComponent + trendComponent +
     riskComponent + rsiComponent + bbComponent) * 100
  ) / 100;

  const estimatedTarget = Math.round(currentPrice * (1 + estimatedUpsidePercent / 100) * 100) / 100;

  // Confidence based on data quality and trend consistency
  const confidence = Math.min(100, Math.max(10,
    Math.round(trendStrength * 0.4 + riskAdjustedScore * 0.3 + (n > 200 ? 30 : n / 7))
  ));

  // Rating
  let rating: GrowthPotentialData['rating'];
  if (estimatedUpsidePercent >= 20 && confidence >= 40) rating = 'High Potential';
  else if (estimatedUpsidePercent >= 10) rating = 'Moderate Potential';
  else if (estimatedUpsidePercent >= 0) rating = 'Low Potential';
  else rating = 'Risky';

  return {
    symbol,
    currentPrice: Math.round(currentPrice * 100) / 100,
    estimatedTarget: Math.max(0, estimatedTarget),
    estimatedUpsidePercent,
    confidence,
    rating,
    generatedAt: new Date().toISOString(),
    historicalGrowthRate: Math.round(annualizedGrowth * 100) / 100,
    meanReversionScore: Math.round(meanReversionScore),
    trendStrength,
    riskAdjustedScore: Math.round(riskAdjustedScore),
    rsiScore: Math.round(rsiScore),
    bollingerUpper: Math.round(bb.upper * 100) / 100,
    bollingerMiddle: Math.round(bb.middle * 100) / 100,
    bollingerLower: Math.round(bb.lower * 100) / 100,
    bollingerPosition,
    currentVolume,
    avgVolume20d: Math.round(avgVolume20d),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    volumeTrend,
    obvTrend,
  };
}
