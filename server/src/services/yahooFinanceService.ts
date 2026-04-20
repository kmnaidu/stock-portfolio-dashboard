// ============================================================
// Yahoo Finance Service — uses the v8 chart API exclusively
// (no crumb/auth required). Extracts quotes, historical data,
// financial metrics, and generates recommendation-like data
// from available chart metadata.
// ============================================================

import type {
  QuoteData,
  HistoricalDataPoint,
  RecommendationData,
  TimeRange,
} from 'shared/types.js';
import type { CacheService } from './cacheService.js';

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// ── SummaryData interface ────────────────────────────────────
export interface SummaryData {
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  peRatio: number;
  dividendYield: number;
}

// ── TTL constants (seconds) ──────────────────────────────────
const TTL_QUOTES = 10;
const TTL_HISTORICAL = 3600;       // 1 hour
const TTL_RECOMMENDATIONS = 21600; // 6 hours

// ── Cache key helpers ────────────────────────────────────────
function quotesKey(symbols: string[]): string {
  return `quotes:${[...symbols].sort().join(',')}`;
}
function historicalKey(symbol: string, range: TimeRange): string {
  return `historical:${symbol}:${range}`;
}
function recommendationsKey(symbol: string): string {
  return `recommendations:${symbol}`;
}
function summaryKey(symbol: string): string {
  return `summary:${symbol}`;
}

// ── Range → chart query params ───────────────────────────────
interface ChartQueryOptions {
  period1: Date;
  period2: Date;
  interval: string;
}

function rangeToQueryOptions(range: TimeRange): ChartQueryOptions {
  const now = new Date();
  const period2 = now;
  let period1: Date;
  let interval: string;

  switch (range) {
    case '1d':
      period1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      interval = '5m';
      break;
    case '1w':
      period1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      interval = '15m';
      break;
    case '1mo':
      period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      interval = '1d';
      break;
    case '3mo':
      period1 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      interval = '1d';
      break;
    case '6mo':
      period1 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      interval = '1d';
      break;
    case '1y':
      period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      interval = '1d';
      break;
    default:
      period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      interval = '1d';
  }

  return { period1, period2, interval };
}

// ── Generic chart fetch helper ───────────────────────────────

interface ChartResult {
  meta: Record<string, any>;
  timestamps: number[];
  quotes: Record<string, any>;
}

async function fetchChartRaw(
  symbol: string,
  queryString: string,
): Promise<ChartResult | null> {
  const url = `${YF_BASE}/${encodeURIComponent(symbol)}?${queryString}`;
  const res = await fetch(url, { headers: YF_HEADERS });
  if (!res.ok) return null;

  const json = (await res.json()) as any;
  const result = json?.chart?.result?.[0];
  if (!result) return null;

  return {
    meta: result.meta ?? {},
    timestamps: result.timestamp ?? [],
    quotes: result.indicators?.quote?.[0] ?? {},
  };
}

// ── Fetch historical OHLCV data ──────────────────────────────

async function fetchChart(
  symbol: string,
  opts: ChartQueryOptions,
): Promise<HistoricalDataPoint[]> {
  const p1 = Math.floor(opts.period1.getTime() / 1000);
  const p2 = Math.floor(opts.period2.getTime() / 1000);
  const data = await fetchChartRaw(symbol, `period1=${p1}&period2=${p2}&interval=${opts.interval}`);
  if (!data) return [];

  return data.timestamps.map((ts: number, i: number) => ({
    date: new Date(ts * 1000).toISOString(),
    open: data.quotes.open?.[i] ?? 0,
    high: data.quotes.high?.[i] ?? 0,
    low: data.quotes.low?.[i] ?? 0,
    close: data.quotes.close?.[i] ?? 0,
    volume: data.quotes.volume?.[i] ?? 0,
  }));
}

// ── Fetch real-time quotes via chart API ─────────────────────

async function fetchQuotes(symbols: string[]): Promise<QuoteData[]> {
  const results: QuoteData[] = [];

  for (const symbol of symbols) {
    try {
      const data = await fetchChartRaw(symbol, 'range=1d&interval=1m&includePrePost=false');
      if (!data) continue;

      const meta = data.meta;

      // Compute day high/low/volume from intraday data
      let dayHigh = 0;
      let dayLow = Infinity;
      let totalVolume = 0;

      if (data.timestamps.length > 0) {
        for (let i = 0; i < data.timestamps.length; i++) {
          const h = data.quotes.high?.[i];
          const l = data.quotes.low?.[i];
          const v = data.quotes.volume?.[i];
          if (h != null && h > dayHigh) dayHigh = h;
          if (l != null && l < dayLow) dayLow = l;
          if (v != null) totalVolume += v;
        }
      }
      if (dayLow === Infinity) dayLow = 0;

      const price = meta.regularMarketPrice ?? 0;
      const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;

      results.push({
        symbol: meta.symbol ?? symbol,
        shortName: meta.shortName ?? meta.longName ?? symbol.replace('.NS', ''),
        price,
        previousClose,
        change: price - previousClose,
        changePercent: previousClose !== 0 ? ((price - previousClose) / previousClose) * 100 : 0,
        dayHigh: meta.regularMarketDayHigh ?? dayHigh,
        dayLow: meta.regularMarketDayLow ?? dayLow,
        volume: meta.regularMarketVolume ?? totalVolume,
        marketState: meta.marketState ?? 'CLOSED',
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      // Skip failed symbols
    }
  }

  return results;
}

// ── Generate analyst-style recommendations from price trends ─
// Since Yahoo's quoteSummary API requires authentication,
// we derive recommendation-like signals from price momentum,
// moving averages, and trend analysis using the chart data.

type ConsensusRating = RecommendationData['consensusRating'];

function computeTrendRecommendation(
  closingPrices: number[],
  symbol: string,
): RecommendationData {
  if (closingPrices.length < 20) {
    return {
      symbol,
      consensusRating: 'Hold',
      consensusScore: 3,
      totalAnalysts: 0,
      recommendations: [],
    };
  }

  const n = closingPrices.length;
  const currentPrice = closingPrices[n - 1];

  // Simple Moving Averages
  const sma20 = closingPrices.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 = n >= 50
    ? closingPrices.slice(-50).reduce((a, b) => a + b, 0) / 50
    : sma20;

  // Price momentum (% change over last 30 days)
  const price30dAgo = n >= 30 ? closingPrices[n - 30] : closingPrices[0];
  const momentum30d = ((currentPrice - price30dAgo) / price30dAgo) * 100;

  // Price momentum (% change over last 7 days)
  const price7dAgo = n >= 7 ? closingPrices[n - 7] : closingPrices[0];
  const momentum7d = ((currentPrice - price7dAgo) / price7dAgo) * 100;

  // Volatility (standard deviation of last 20 days returns)
  const returns: number[] = [];
  for (let i = Math.max(1, n - 20); i < n; i++) {
    returns.push((closingPrices[i] - closingPrices[i - 1]) / closingPrices[i - 1]);
  }
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const volatility = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length
  );

  // Score each signal (1-5 scale)
  const signals: { firm: string; score: number; rationale: string }[] = [];

  // SMA crossover signal
  const smaCrossScore = currentPrice > sma20
    ? (currentPrice > sma50 ? 4.5 : 3.5)
    : (currentPrice < sma50 ? 1.5 : 2.5);
  signals.push({
    firm: 'Moving Average Analysis',
    score: smaCrossScore,
    rationale: currentPrice > sma20 ? 'Price above 20-day SMA' : 'Price below 20-day SMA',
  });

  // Momentum signal
  let momentumScore: number;
  if (momentum30d > 5) momentumScore = 5;
  else if (momentum30d > 2) momentumScore = 4;
  else if (momentum30d > -2) momentumScore = 3;
  else if (momentum30d > -5) momentumScore = 2;
  else momentumScore = 1;
  signals.push({
    firm: 'Momentum Analysis',
    score: momentumScore,
    rationale: `30-day momentum: ${momentum30d.toFixed(1)}%`,
  });

  // Short-term trend signal
  let shortTermScore: number;
  if (momentum7d > 3) shortTermScore = 5;
  else if (momentum7d > 1) shortTermScore = 4;
  else if (momentum7d > -1) shortTermScore = 3;
  else if (momentum7d > -3) shortTermScore = 2;
  else shortTermScore = 1;
  signals.push({
    firm: 'Short-Term Trend',
    score: shortTermScore,
    rationale: `7-day momentum: ${momentum7d.toFixed(1)}%`,
  });

  // Volatility signal (lower volatility = more favorable)
  const annualizedVol = volatility * Math.sqrt(252) * 100;
  let volScore: number;
  if (annualizedVol < 15) volScore = 4;
  else if (annualizedVol < 25) volScore = 3.5;
  else if (annualizedVol < 35) volScore = 3;
  else volScore = 2;
  signals.push({
    firm: 'Volatility Assessment',
    score: volScore,
    rationale: `Annualized volatility: ${annualizedVol.toFixed(1)}%`,
  });

  // Compute consensus
  const avgScore = signals.reduce((sum, s) => sum + s.score, 0) / signals.length;
  const rounded = Math.round(avgScore);
  const ratingMap: Record<number, ConsensusRating> = {
    5: 'Strong Buy', 4: 'Buy', 3: 'Hold', 2: 'Sell', 1: 'Strong Sell',
  };
  const consensusRating = ratingMap[Math.max(1, Math.min(5, rounded))] ?? 'Hold';

  // Build recommendation entries
  const ratingFromScore = (s: number): RecommendationData['recommendations'][0]['rating'] => {
    if (s >= 4.5) return 'Strong Buy';
    if (s >= 3.5) return 'Buy';
    if (s >= 2.5) return 'Hold';
    if (s >= 1.5) return 'Sell';
    return 'Strong Sell';
  };

  const today = new Date().toISOString().slice(0, 10);
  const recommendations = signals.map((s) => ({
    firm: s.firm,
    rating: ratingFromScore(s.score),
    targetPrice: Math.round(currentPrice * (1 + (s.score - 3) * 0.05) * 100) / 100,
    date: today,
  }));

  return {
    symbol,
    consensusRating,
    consensusScore: Math.round(avgScore * 100) / 100,
    totalAnalysts: signals.length,
    recommendations,
  };
}

// ── YFService interface ──────────────────────────────────────
export interface YFService {
  getQuotes(symbols: string[]): Promise<QuoteData[]>;
  getHistorical(symbol: string, range: TimeRange): Promise<HistoricalDataPoint[]>;
  getRecommendations(symbol: string): Promise<RecommendationData>;
  getQuoteSummary(symbol: string): Promise<SummaryData>;
}

// ── Factory ──────────────────────────────────────────────────

export function createYahooFinanceService(cache: CacheService): YFService {
  return {
    async getQuotes(symbols: string[]): Promise<QuoteData[]> {
      if (symbols.length === 0) return [];

      const cacheKey = quotesKey(symbols);
      const cached = cache.get<QuoteData[]>(cacheKey);
      if (cached) return cached;

      const quotes = await fetchQuotes(symbols);
      cache.set(cacheKey, quotes, TTL_QUOTES);
      return quotes;
    },

    async getHistorical(
      symbol: string,
      range: TimeRange,
    ): Promise<HistoricalDataPoint[]> {
      const cacheKey = historicalKey(symbol, range);
      const cached = cache.get<HistoricalDataPoint[]>(cacheKey);
      if (cached) return cached;

      const opts = rangeToQueryOptions(range);
      const points = await fetchChart(symbol, opts);
      cache.set(cacheKey, points, TTL_HISTORICAL);
      return points;
    },

    async getRecommendations(symbol: string): Promise<RecommendationData> {
      const cacheKey = recommendationsKey(symbol);
      const cached = cache.get<RecommendationData>(cacheKey);
      if (cached) return cached;

      // Fetch 6 months of daily data for trend analysis
      const data = await fetchChartRaw(symbol, 'range=6mo&interval=1d');
      if (!data || data.timestamps.length < 20) {
        return {
          symbol,
          consensusRating: 'Hold',
          consensusScore: 3,
          totalAnalysts: 0,
          recommendations: [],
        };
      }

      const closingPrices = data.timestamps.map(
        (_: number, i: number) => data.quotes.close?.[i] ?? 0
      ).filter((p: number) => p > 0);

      const result = computeTrendRecommendation(closingPrices, symbol);
      cache.set(cacheKey, result, TTL_RECOMMENDATIONS);
      return result;
    },

    async getQuoteSummary(symbol: string): Promise<SummaryData> {
      const cacheKey = summaryKey(symbol);
      const cached = cache.get<SummaryData>(cacheKey);
      if (cached) return cached;

      // Use 1-year daily chart to get 52-week data from meta
      const data = await fetchChartRaw(symbol, 'range=1y&interval=1d');
      if (!data) {
        return { fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0, marketCap: 0, peRatio: 0, dividendYield: 0 };
      }

      const meta = data.meta;

      // 52-week high/low from meta (reliable)
      const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh ?? 0;
      const fiftyTwoWeekLow = meta.fiftyTwoWeekLow ?? 0;

      // Market cap, P/E, dividend yield are not available from chart API
      // We'll return 0 for these — the frontend handles this gracefully
      // by showing "N/A" or hiding the metric
      const result: SummaryData = {
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
        marketCap: 0,
        peRatio: 0,
        dividendYield: 0,
      };

      cache.set(cacheKey, result, TTL_RECOMMENDATIONS);
      return result;
    },
  };
}
