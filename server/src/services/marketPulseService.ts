// ============================================================
// Market Pulse Service — aggregates global macro signals that
// influence the Indian stock market: Brent Crude, USD/INR,
// Nifty 50, Sensex, and FII/DII activity.
// ============================================================

import type { CacheService } from './cacheService.js';

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
};

export interface MarketIndicator {
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

export interface FiiDiiActivity {
  date: string;
  fiiNet: number;     // in Crores
  fiiBuy: number;
  fiiSell: number;
  diiNet: number;
  diiBuy: number;
  diiSell: number;
  fiiSentiment: 'bullish' | 'bearish' | 'neutral';
  diiSentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface MarketPulseData {
  generatedAt: string;
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  overallScore: number;      // -100 (very bearish) to +100 (very bullish)
  verdict: string;           // one-line actionable summary

  indicators: {
    nifty50: MarketIndicator;
    sensex: MarketIndicator;
    brentCrude: MarketIndicator;
    usdInr: MarketIndicator;
    gold?: MarketIndicator;
    silver?: MarketIndicator;
    giftNifty?: MarketIndicator;
    indiaVix?: MarketIndicator;
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

  fiiDii: FiiDiiActivity | null;
}

// ── Fetch from Yahoo chart API ───────────────────────────────
async function fetchYahooQuote(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;

    const currentPrice = meta.regularMarketPrice ?? 0;

    // Determine previous close from daily bars.
    // Yahoo returns 5 days of daily data. Today's bar may be null (market still open).
    // Logic:
    //   - If last bar is null → market is open today, last non-null = yesterday's close (= prev close)
    //   - If last bar is NOT null → market closed today, last non-null = today's close,
    //     second-to-last = yesterday's close (= prev close)
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    const nonNullCloses = closes.filter((c): c is number => c != null);
    const lastBarIsNull = closes.length > 0 && closes[closes.length - 1] == null;

    let prevClose = 0;
    if (lastBarIsNull && nonNullCloses.length >= 1) {
      // Market is open today — last non-null close IS yesterday's close
      prevClose = nonNullCloses[nonNullCloses.length - 1];
    } else if (nonNullCloses.length >= 2) {
      // Market closed today — second-to-last is yesterday's close
      prevClose = nonNullCloses[nonNullCloses.length - 2];
    } else {
      // Fallback if we don't have enough data
      prevClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
    }

    return { price: currentPrice, prevClose };
  } catch {
    return null;
  }
}

// ── Fetch GIFT Nifty from TradingView Scanner API ────────────
// GIFT Nifty (NSEIX:NIFTY1!) is not on Yahoo Finance.
// TradingView's scanner API provides live futures data for free.
// Change is calculated against GIFT Nifty's own previous close (like brokers do).
async function fetchGiftNifty(): Promise<{ price: number; prevClose: number } | null> {
  try {
    const payload = JSON.stringify({
      columns: ['close', 'change', 'change_abs', 'open', 'high', 'low'],
      symbols: { tickers: ['NSEIX:NIFTY1!'] },
    });

    const res = await fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
      },
      body: payload,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const data = json?.data?.[0]?.d;
    if (!data || data.length < 3) return null;

    const price = data[0];       // current close/last price
    const changeAbs = data[2];   // absolute change from GIFT Nifty's own prev close
    const prevClose = price - changeAbs; // GIFT Nifty's own previous session close

    if (!price || price <= 0) return null;
    return { price, prevClose };
  } catch {
    return null;
  }
}

// ── Fetch Nifty OHLC and calculate Pivot Levels ──────────────
// Uses standard pivot point formula from previous day's High, Low, Close
async function fetchNiftyPivotLevels(currentPrice: number): Promise<MarketPulseData['niftyLevels']> {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?range=5d&interval=1d';
    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return undefined;
    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    const quotes = result?.indicators?.quote?.[0];
    if (!quotes) return undefined;

    const highs: (number | null)[] = quotes.high ?? [];
    const lows: (number | null)[] = quotes.low ?? [];
    const closes: (number | null)[] = quotes.close ?? [];

    // Get the last completed trading day's OHLC (second-to-last non-null values)
    const validHighs = highs.filter((v): v is number => v != null);
    const validLows = lows.filter((v): v is number => v != null);
    const validCloses = closes.filter((v): v is number => v != null);

    if (validHighs.length < 2 || validLows.length < 2 || validCloses.length < 2) return undefined;

    // Use the most recent completed day (last values represent today if market was open)
    const high = validHighs[validHighs.length - 1];
    const low = validLows[validLows.length - 1];
    const close = validCloses[validCloses.length - 1];

    // Standard Pivot Point formula
    const pivot = Math.round(((high + low + close) / 3) * 100) / 100;
    const r1 = Math.round(((2 * pivot) - low) * 100) / 100;
    const r2 = Math.round((pivot + (high - low)) * 100) / 100;
    const r3 = Math.round((high + 2 * (pivot - low)) * 100) / 100;
    const s1 = Math.round(((2 * pivot) - high) * 100) / 100;
    const s2 = Math.round((pivot - (high - low)) * 100) / 100;
    const s3 = Math.round((low - 2 * (high - pivot)) * 100) / 100;

    const bias: 'bullish' | 'bearish' | 'neutral' =
      currentPrice > pivot + 20 ? 'bullish' :
      currentPrice < pivot - 20 ? 'bearish' : 'neutral';

    return { pivot, r1, r2, r3, s1, s2, s3, current: currentPrice, bias };
  } catch {
    return undefined;
  }
}

// ── Fetch FII/DII from NSE ───────────────────────────────────
async function fetchFiiDii(): Promise<FiiDiiActivity | null> {
  try {
    const res = await fetch('https://www.nseindia.com/api/fiidiiTradeReact', {
      headers: NSE_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any[];
    if (!Array.isArray(json) || json.length === 0) return null;

    const fii = json.find(r => r.category === 'FII/FPI' || r.category === 'FII');
    const dii = json.find(r => r.category === 'DII');
    if (!fii && !dii) return null;

    const fiiNet = parseFloat(fii?.netValue ?? '0');
    const diiNet = parseFloat(dii?.netValue ?? '0');

    return {
      date: fii?.date ?? dii?.date ?? new Date().toISOString().slice(0, 10),
      fiiNet,
      fiiBuy: parseFloat(fii?.buyValue ?? '0'),
      fiiSell: parseFloat(fii?.sellValue ?? '0'),
      diiNet,
      diiBuy: parseFloat(dii?.buyValue ?? '0'),
      diiSell: parseFloat(dii?.sellValue ?? '0'),
      fiiSentiment: fiiNet > 500 ? 'bullish' : fiiNet < -500 ? 'bearish' : 'neutral',
      diiSentiment: diiNet > 500 ? 'bullish' : diiNet < -500 ? 'bearish' : 'neutral',
    };
  } catch {
    return null;
  }
}

// ── Build a market indicator with sentiment ──────────────────
function buildIndicator(
  label: string,
  symbol: string,
  data: { price: number; prevClose: number } | null,
  options: {
    risingIsBullish: boolean;
    rationaleUp: string;
    rationaleDown: string;
  },
): MarketIndicator {
  if (!data) {
    return {
      label, symbol,
      value: 0, previousValue: 0, change: 0, changePercent: 0,
      direction: 'flat', sentiment: 'neutral',
      rationale: 'Data unavailable',
    };
  }

  const change = data.price - data.prevClose;
  const changePercent = data.prevClose !== 0 ? (change / data.prevClose) * 100 : 0;
  const direction: MarketIndicator['direction'] =
    Math.abs(changePercent) < 0.05 ? 'flat' : (change > 0 ? 'up' : 'down');

  let sentiment: MarketIndicator['sentiment'] = 'neutral';
  let rationale = '';

  if (direction === 'flat') {
    sentiment = 'neutral';
    rationale = 'Little movement';
  } else if (options.risingIsBullish) {
    sentiment = direction === 'up' ? 'bullish' : 'bearish';
    rationale = direction === 'up' ? options.rationaleUp : options.rationaleDown;
  } else {
    // Inverse indicator (oil, dollar) — rising is bearish for Indian market
    sentiment = direction === 'up' ? 'bearish' : 'bullish';
    rationale = direction === 'up' ? options.rationaleUp : options.rationaleDown;
  }

  return {
    label, symbol,
    value: Math.round(data.price * 100) / 100,
    previousValue: Math.round(data.prevClose * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    direction, sentiment, rationale,
  };
}

// ── Compute overall sentiment ────────────────────────────────
function computeOverallSentiment(
  nifty50: MarketIndicator,
  brent: MarketIndicator,
  usdInr: MarketIndicator,
  fiiDii: FiiDiiActivity | null,
  indiaVix?: MarketIndicator,
): { sentiment: MarketPulseData['overallSentiment']; score: number; verdict: string } {
  let score = 0;
  const signals: string[] = [];

  // Nifty direction (weight: 2)
  if (nifty50.sentiment === 'bullish') { score += 20; signals.push('Nifty up'); }
  else if (nifty50.sentiment === 'bearish') { score -= 20; signals.push('Nifty down'); }

  // Brent Crude (weight: 1.5, inverse for India)
  if (brent.sentiment === 'bearish') { score -= 15; signals.push('oil rising'); }
  else if (brent.sentiment === 'bullish') { score += 15; signals.push('oil falling'); }

  // USD/INR (weight: 1.5, inverse — stronger dollar = weaker rupee = bearish)
  if (usdInr.sentiment === 'bearish') { score -= 15; signals.push('rupee weakening'); }
  else if (usdInr.sentiment === 'bullish') { score += 15; signals.push('rupee strengthening'); }

  // India VIX (weight: 1 — high VIX = fear = bearish)
  if (indiaVix) {
    if (indiaVix.sentiment === 'bearish') { score -= 10; signals.push('VIX rising'); }
    else if (indiaVix.sentiment === 'bullish') { score += 10; signals.push('VIX falling'); }
  }

  // FII activity (weight: 2)
  if (fiiDii) {
    if (fiiDii.fiiSentiment === 'bullish') { score += 20; signals.push('FII buying'); }
    else if (fiiDii.fiiSentiment === 'bearish') { score -= 20; signals.push('FII selling'); }

    // DII as counter-weight (weight: 1)
    if (fiiDii.diiSentiment === 'bullish') { score += 10; signals.push('DII support'); }
    else if (fiiDii.diiSentiment === 'bearish') { score -= 10; signals.push('DII offloading'); }
  }

  // Clamp score
  score = Math.max(-100, Math.min(100, score));

  let sentiment: MarketPulseData['overallSentiment'];
  let verdict: string;

  if (score >= 30) {
    sentiment = 'bullish';
    verdict = '🟢 Bullish setup — favorable conditions for buying quality stocks';
  } else if (score <= -30) {
    sentiment = 'bearish';
    verdict = '🔴 Bearish setup — expect correction, avoid buying highs, wait for dips';
  } else {
    sentiment = 'neutral';
    verdict = '🟡 Mixed signals — stay selective, focus on fundamentally strong stocks';
  }

  return { sentiment, score, verdict };
}

// ── Service factory ──────────────────────────────────────────
export interface MarketPulseService {
  getPulse(): Promise<MarketPulseData>;
}

export function createMarketPulseService(cache: CacheService): MarketPulseService {
  return {
    async getPulse(): Promise<MarketPulseData> {
      const cached = cache.get<MarketPulseData>('market-pulse');
      if (cached) return cached;

      // Fetch all indicators in parallel
      const [nifty, sensex, brent, usdInr, gold, silver, indiaVix, fiiDii] = await Promise.all([
        fetchYahooQuote('^NSEI'),
        fetchYahooQuote('^BSESN'),
        fetchYahooQuote('BZ=F'),
        fetchYahooQuote('INR=X'),
        fetchYahooQuote('GC=F'),
        fetchYahooQuote('SI=F'),
        fetchYahooQuote('^INDIAVIX'),
        fetchFiiDii(),
      ]);

      // Fetch GIFT Nifty (uses its own previous close, like brokers)
      const giftNifty = await fetchGiftNifty();

      // Calculate Nifty pivot levels for the day
      const niftyLevels = await fetchNiftyPivotLevels(nifty?.price ?? 0);

      const niftyInd = buildIndicator('Nifty 50', '^NSEI', nifty, {
        risingIsBullish: true,
        rationaleUp: 'Benchmark up — broad market strength',
        rationaleDown: 'Benchmark down — broad market weakness',
      });

      const sensexInd = buildIndicator('Sensex', '^BSESN', sensex, {
        risingIsBullish: true,
        rationaleUp: 'Sensex up — large-cap strength',
        rationaleDown: 'Sensex down — large-cap weakness',
      });

      const brentInd = buildIndicator('Brent Crude', 'BZ=F', brent, {
        risingIsBullish: false,
        rationaleUp: 'Oil rising — pressure on Indian economy (import-heavy)',
        rationaleDown: 'Oil falling — relief for Indian economy',
      });

      const usdInrInd = buildIndicator('USD/INR', 'INR=X', usdInr, {
        risingIsBullish: false,
        rationaleUp: 'Rupee weakening — imports costlier, inflation pressure',
        rationaleDown: 'Rupee strengthening — positive for Indian assets',
      });

      const goldInd = buildIndicator('Gold', 'GC=F', gold, {
        risingIsBullish: false,
        rationaleUp: 'Gold rising — fear in markets, safe-haven demand',
        rationaleDown: 'Gold falling — risk appetite returning',
      });

      const silverInd = buildIndicator('Silver', 'SI=F', silver, {
        risingIsBullish: false,
        rationaleUp: 'Silver rising — inflation hedge demand',
        rationaleDown: 'Silver falling — industrial demand weak',
      });

      const giftNiftyInd = buildIndicator('GIFT Nifty', 'GIFT_NIFTY', giftNifty, {
        risingIsBullish: true,
        rationaleUp: 'GIFT Nifty up — signals positive opening for Indian market',
        rationaleDown: 'GIFT Nifty down — signals gap-down opening',
      });

      const indiaVixInd = buildIndicator('India VIX', '^INDIAVIX', indiaVix, {
        risingIsBullish: false,
        rationaleUp: 'VIX rising — fear increasing, expect volatility',
        rationaleDown: 'VIX falling — calm market, bullish undertone',
      });

      const overall = computeOverallSentiment(niftyInd, brentInd, usdInrInd, fiiDii, indiaVixInd);

      const result: MarketPulseData = {
        generatedAt: new Date().toISOString(),
        overallSentiment: overall.sentiment,
        overallScore: overall.score,
        verdict: overall.verdict,
        indicators: {
          nifty50: niftyInd,
          sensex: sensexInd,
          brentCrude: brentInd,
          usdInr: usdInrInd,
          gold: goldInd,
          silver: silverInd,
          giftNifty: giftNiftyInd,
          indiaVix: indiaVixInd,
        },
        niftyLevels,
        fiiDii,
      };

      cache.set('market-pulse', result, 30); // 30 sec cache — frequent refresh for live indices
      return result;
    },
  };
}
