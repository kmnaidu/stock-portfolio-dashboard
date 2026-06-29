// ============================================================
// Intraday Service — VWAP (Volume Weighted Average Price)
//
// VWAP is the benchmark price for intraday traders. It tells you
// where the market has been trading on a volume-weighted basis
// today. Many institutions buy near VWAP and sell above it.
//
// Formula: VWAP = Σ(typical_price × volume) / Σ(volume)
// where typical_price = (high + low + close) / 3
//
// Data source: Yahoo Finance 5-min bars for today (15-min delayed on free tier)
// ============================================================

import type { CacheService } from './cacheService.js';

const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const VWAP_TTL = 300; // 5 minutes (intraday bars refresh slowly on free tier)
const FETCH_TIMEOUT_MS = 8000;

export interface VWAPResult {
  symbol: string;
  vwap: number;                  // Volume-weighted average price
  currentPrice: number;          // Latest close from intraday bars
  distance: number;              // currentPrice - vwap (absolute)
  distancePercent: number;       // % distance from VWAP
  signal: 'above' | 'below' | 'at'; // Position relative to VWAP
  barsUsed: number;              // Number of 5-min bars in calculation
  isStale: boolean;              // True if data is from a previous session
  asOf: string;                  // ISO timestamp of last bar
}

export interface IntradayService {
  computeVWAP(symbol: string): Promise<VWAPResult | null>;
  computeVWAPBatch(symbols: string[]): Promise<Record<string, VWAPResult | null>>;
}

/**
 * Pure VWAP calculation — exported for testing.
 * Returns null if input arrays are invalid or all volumes are zero.
 */
export function calculateVWAP(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
): { vwap: number; barsUsed: number } | null {
  if (
    highs.length === 0 ||
    highs.length !== lows.length ||
    highs.length !== closes.length ||
    highs.length !== volumes.length
  ) {
    return null;
  }

  let totalPV = 0;
  let totalVolume = 0;
  let barsUsed = 0;

  for (let i = 0; i < highs.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i];

    // Skip bars with missing or invalid data
    if (h == null || l == null || c == null || v == null) continue;
    if (h <= 0 || l <= 0 || c <= 0 || v <= 0) continue;

    const typicalPrice = (h + l + c) / 3;
    totalPV += typicalPrice * v;
    totalVolume += v;
    barsUsed++;
  }

  if (totalVolume === 0 || barsUsed === 0) return null;

  return {
    vwap: totalPV / totalVolume,
    barsUsed,
  };
}

/**
 * Determine if the intraday data is from today's session (IST) or stale.
 * Outside market hours, Yahoo returns the most recent session's bars.
 */
function isDataStale(lastBarTimestampMs: number): boolean {
  const now = new Date();
  const last = new Date(lastBarTimestampMs);

  // Convert both to IST date (UTC + 5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffsetMs);
  const lastIST = new Date(last.getTime() + istOffsetMs);

  // Compare year-month-day in IST
  const sameDay =
    nowIST.getUTCFullYear() === lastIST.getUTCFullYear() &&
    nowIST.getUTCMonth() === lastIST.getUTCMonth() &&
    nowIST.getUTCDate() === lastIST.getUTCDate();

  return !sameDay;
}

async function fetchIntradayBars(symbol: string): Promise<{
  timestamps: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
} | null> {
  const url = `${YF_BASE}/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
  try {
    const res = await fetch(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const quotes = result.indicators?.quote?.[0] ?? {};
    if (timestamps.length === 0) return null;

    return {
      timestamps,
      high: quotes.high ?? [],
      low: quotes.low ?? [],
      close: quotes.close ?? [],
      volume: quotes.volume ?? [],
    };
  } catch {
    return null;
  }
}

export function createIntradayService(cache: CacheService): IntradayService {
  const cacheKey = (symbol: string) => `vwap:${symbol}`;

  async function computeOne(symbol: string): Promise<VWAPResult | null> {
    // Check cache first
    const cached = cache.get<VWAPResult>(cacheKey(symbol));
    if (cached) return cached;

    const bars = await fetchIntradayBars(symbol);
    if (!bars) return null;

    const result = calculateVWAP(bars.high, bars.low, bars.close, bars.volume);
    if (!result) return null;

    // Latest valid close
    let currentPrice = 0;
    let lastTimestampMs = 0;
    for (let i = bars.close.length - 1; i >= 0; i--) {
      const c = bars.close[i];
      if (c != null && c > 0) {
        currentPrice = c;
        lastTimestampMs = (bars.timestamps[i] ?? 0) * 1000;
        break;
      }
    }
    if (currentPrice === 0) return null;

    const distance = currentPrice - result.vwap;
    const distancePercent = result.vwap !== 0 ? (distance / result.vwap) * 100 : 0;
    const signal: 'above' | 'below' | 'at' =
      Math.abs(distancePercent) < 0.05 ? 'at' : distance > 0 ? 'above' : 'below';

    const vwapResult: VWAPResult = {
      symbol,
      vwap: Math.round(result.vwap * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      distance: Math.round(distance * 100) / 100,
      distancePercent: Math.round(distancePercent * 100) / 100,
      signal,
      barsUsed: result.barsUsed,
      isStale: isDataStale(lastTimestampMs),
      asOf: new Date(lastTimestampMs).toISOString(),
    };

    cache.set(cacheKey(symbol), vwapResult, VWAP_TTL);
    return vwapResult;
  }

  return {
    computeVWAP: computeOne,

    async computeVWAPBatch(symbols: string[]): Promise<Record<string, VWAPResult | null>> {
      // Fetch all in parallel — each call is independent
      const results = await Promise.all(
        symbols.map(async (sym) => {
          try {
            const r = await computeOne(sym);
            return [sym, r] as const;
          } catch {
            return [sym, null] as const;
          }
        }),
      );

      return Object.fromEntries(results);
    },
  };
}
