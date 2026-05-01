// ============================================================
// Support & Resistance Service — computes key price levels,
// buy range, and an overall analyst-style verdict from
// historical OHLCV data using pivot points, moving averages,
// RSI, and MACD.
// ============================================================

export interface SupportResistanceData {
  symbol: string;
  currentPrice: number;
  generatedAt: string;

  // Pivot-based support & resistance (classic floor pivots)
  pivotPoint: number;
  support1: number;
  support2: number;
  support3: number;
  resistance1: number;
  resistance2: number;
  resistance3: number;

  // Moving average levels
  sma20: number;
  sma50: number;
  sma200: number;

  // Buy range (derived from support levels and moving averages)
  buyRangeLow: number;
  buyRangeHigh: number;

  // Technical indicators
  rsi14: number;           // 0-100
  macdSignal: 'bullish' | 'bearish' | 'neutral';

  // Overall verdict
  verdict: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  verdictScore: number;    // 1-5
  verdictRationale: string;
}

interface OHLCVBar {
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Classic Floor Pivot Points ───────────────────────────────
function computePivots(prevHigh: number, prevLow: number, prevClose: number) {
  const pp = (prevHigh + prevLow + prevClose) / 3;
  const s1 = 2 * pp - prevHigh;
  const s2 = pp - (prevHigh - prevLow);
  const s3 = prevLow - 2 * (prevHigh - pp);
  const r1 = 2 * pp - prevLow;
  const r2 = pp + (prevHigh - prevLow);
  const r3 = prevHigh + 2 * (pp - prevLow);
  return { pp, s1, s2, s3, r1, r2, r3 };
}

// ── Simple Moving Average ────────────────────────────────────
function sma(prices: number[], period: number): number {
  if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ── RSI (Relative Strength Index) ────────────────────────────
function computeRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // neutral default

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smoothed RSI
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
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ── MACD Signal ──────────────────────────────────────────────
function computeMACD(prices: number[]): 'bullish' | 'bearish' | 'neutral' {
  if (prices.length < 26) return 'neutral';

  const ema = (data: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  };

  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);

  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }

  const signalLine = ema(macdLine, 9);
  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const prevMACD = macdLine[macdLine.length - 2];
  const prevSignal = signalLine[signalLine.length - 2];

  // Bullish crossover: MACD crosses above signal
  if (lastMACD > lastSignal && prevMACD <= prevSignal) return 'bullish';
  // Bearish crossover: MACD crosses below signal
  if (lastMACD < lastSignal && prevMACD >= prevSignal) return 'bearish';
  // Otherwise based on position
  if (lastMACD > lastSignal) return 'bullish';
  if (lastMACD < lastSignal) return 'bearish';
  return 'neutral';
}

// ── Compute overall verdict ──────────────────────────────────
function computeVerdict(
  currentPrice: number,
  rsi: number,
  macdSignal: 'bullish' | 'bearish' | 'neutral',
  sma20Val: number,
  sma50Val: number,
  sma200Val: number,
  support1: number,
  resistance1: number,
): { verdict: SupportResistanceData['verdict']; score: number; rationale: string } {
  let score = 0;
  const reasons: string[] = [];

  // RSI signal (0-100)
  if (rsi < 30) { score += 5; reasons.push('RSI oversold (<30) — strong buy signal'); }
  else if (rsi < 40) { score += 4; reasons.push('RSI approaching oversold — buy signal'); }
  else if (rsi <= 60) { score += 3; reasons.push('RSI neutral (40-60)'); }
  else if (rsi <= 70) { score += 2; reasons.push('RSI approaching overbought — caution'); }
  else { score += 1; reasons.push('RSI overbought (>70) — sell signal'); }

  // MACD signal
  if (macdSignal === 'bullish') { score += 4.5; reasons.push('MACD bullish crossover'); }
  else if (macdSignal === 'neutral') { score += 3; reasons.push('MACD neutral'); }
  else { score += 1.5; reasons.push('MACD bearish crossover'); }

  // Price vs moving averages
  if (currentPrice > sma20Val && currentPrice > sma50Val && currentPrice > sma200Val) {
    score += 5; reasons.push('Price above all major moving averages — strong uptrend');
  } else if (currentPrice > sma20Val && currentPrice > sma50Val) {
    score += 4; reasons.push('Price above 20 & 50 SMA — uptrend');
  } else if (currentPrice > sma20Val) {
    score += 3; reasons.push('Price above 20 SMA — short-term positive');
  } else if (currentPrice < sma20Val && currentPrice < sma50Val) {
    score += 1.5; reasons.push('Price below 20 & 50 SMA — downtrend');
  } else {
    score += 2.5; reasons.push('Price mixed vs moving averages');
  }

  // Support/resistance proximity
  const distToSupport = ((currentPrice - support1) / currentPrice) * 100;
  const distToResistance = ((resistance1 - currentPrice) / currentPrice) * 100;

  if (distToSupport < 2) {
    score += 4; reasons.push(`Near support (${distToSupport.toFixed(1)}% away) — potential bounce`);
  } else if (distToResistance < 2) {
    score += 2; reasons.push(`Near resistance (${distToResistance.toFixed(1)}% away) — potential rejection`);
  } else {
    score += 3; reasons.push('Between support and resistance levels');
  }

  const avgScore = score / 4;
  const verdictMap: Record<number, SupportResistanceData['verdict']> = {
    5: 'Strong Buy', 4: 'Buy', 3: 'Neutral', 2: 'Sell', 1: 'Strong Sell',
  };
  const rounded = Math.max(1, Math.min(5, Math.round(avgScore)));
  const verdict = verdictMap[rounded] ?? 'Neutral';

  return {
    verdict,
    score: Math.round(avgScore * 100) / 100,
    rationale: reasons.join('. ') + '.',
  };
}

// ── Main computation function ────────────────────────────────
export function computeSupportResistance(
  symbol: string,
  closingPrices: number[],
  highs: number[],
  lows: number[],
): SupportResistanceData {
  const n = closingPrices.length;
  const currentPrice = closingPrices[n - 1];

  // Use the most recent complete day for pivot calculation
  const prevHigh = highs[n - 2] ?? highs[n - 1];
  const prevLow = lows[n - 2] ?? lows[n - 1];
  const prevClose = closingPrices[n - 2] ?? closingPrices[n - 1];

  const pivots = computePivots(prevHigh, prevLow, prevClose);

  // Moving averages
  const sma20Val = sma(closingPrices, 20);
  const sma50Val = sma(closingPrices, 50);
  const sma200Val = sma(closingPrices, 200);

  // RSI
  const rsi14 = computeRSI(closingPrices, 14);

  // MACD
  const macdSignal = computeMACD(closingPrices);

  // Buy range: between S1 and the lower of (SMA20, current price * 0.98)
  const buyRangeLow = Math.round(Math.max(pivots.s1, pivots.s2) * 100) / 100;
  const buyRangeHigh = Math.round(Math.min(sma20Val, currentPrice * 0.98) * 100) / 100;

  // If buy range is inverted (low > high), adjust
  const finalBuyLow = Math.min(buyRangeLow, buyRangeHigh);
  const finalBuyHigh = Math.max(buyRangeLow, buyRangeHigh);

  // Overall verdict
  const { verdict, score, rationale } = computeVerdict(
    currentPrice, rsi14, macdSignal, sma20Val, sma50Val, sma200Val,
    pivots.s1, pivots.r1,
  );

  return {
    symbol,
    currentPrice: Math.round(currentPrice * 100) / 100,
    generatedAt: new Date().toISOString(),
    pivotPoint: Math.round(pivots.pp * 100) / 100,
    support1: Math.round(pivots.s1 * 100) / 100,
    support2: Math.round(pivots.s2 * 100) / 100,
    support3: Math.round(pivots.s3 * 100) / 100,
    resistance1: Math.round(pivots.r1 * 100) / 100,
    resistance2: Math.round(pivots.r2 * 100) / 100,
    resistance3: Math.round(pivots.r3 * 100) / 100,
    sma20: Math.round(sma20Val * 100) / 100,
    sma50: Math.round(sma50Val * 100) / 100,
    sma200: Math.round(sma200Val * 100) / 100,
    buyRangeLow: Math.round(finalBuyLow * 100) / 100,
    buyRangeHigh: Math.round(finalBuyHigh * 100) / 100,
    rsi14: Math.round(rsi14 * 100) / 100,
    macdSignal,
    verdict,
    verdictScore: score,
    verdictRationale: rationale,
  };
}
