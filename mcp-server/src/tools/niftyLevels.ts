/**
 * Tool: get_nifty_levels
 * 
 * Calculates Nifty 50 pivot point support/resistance levels.
 * Uses standard pivot formula: PP = (High + Low + Close) / 3
 * No LLM needed — pure math from yesterday's OHLC data.
 */

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0' };

export async function getNiftyLevels() {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?range=5d&interval=1d';
    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { error: 'Failed to fetch Nifty data' };

    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    const quotes = result?.indicators?.quote?.[0];
    if (!meta || !quotes) return { error: 'No Nifty data available' };

    const currentPrice = meta.regularMarketPrice ?? 0;

    // Get the last completed day's OHLC
    const highs = (quotes.high ?? []).filter((v: any): v is number => v != null);
    const lows = (quotes.low ?? []).filter((v: any): v is number => v != null);
    const closes = (quotes.close ?? []).filter((v: any): v is number => v != null);

    if (highs.length < 1 || lows.length < 1 || closes.length < 1) {
      return { error: 'Insufficient data for pivot calculation' };
    }

    const high = highs[highs.length - 1];
    const low = lows[lows.length - 1];
    const close = closes[closes.length - 1];

    // Standard Pivot Point formula
    const pivot = (high + low + close) / 3;
    const r1 = (2 * pivot) - low;
    const r2 = pivot + (high - low);
    const r3 = high + 2 * (pivot - low);
    const s1 = (2 * pivot) - high;
    const s2 = pivot - (high - low);
    const s3 = low - 2 * (high - pivot);

    const bias = currentPrice > pivot + 20 ? 'bullish' :
                 currentPrice < pivot - 20 ? 'bearish' : 'neutral';

    return {
      currentPrice: Math.round(currentPrice * 100) / 100,
      pivot: Math.round(pivot * 100) / 100,
      resistance: {
        r1: Math.round(r1 * 100) / 100,
        r2: Math.round(r2 * 100) / 100,
        r3: Math.round(r3 * 100) / 100,
      },
      support: {
        s1: Math.round(s1 * 100) / 100,
        s2: Math.round(s2 * 100) / 100,
        s3: Math.round(s3 * 100) / 100,
      },
      bias,
      calculation: {
        basedOn: 'Previous day OHLC',
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
      },
    };
  } catch (err) {
    return { error: `Failed: ${err}` };
  }
}
