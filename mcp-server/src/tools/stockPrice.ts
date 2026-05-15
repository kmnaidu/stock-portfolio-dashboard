/**
 * Tool: get_stock_price
 * 
 * Fetches current price, day high/low, 52-week high/low for any NSE stock.
 * Uses Yahoo Finance API (free, no key needed).
 */

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0' };

export async function getStockPrice(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { error: `Failed to fetch ${symbol}` };

    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return { error: `No data for ${symbol}` };

    const price = meta.regularMarketPrice ?? 0;
    const dayHigh = meta.regularMarketDayHigh ?? 0;
    const dayLow = meta.regularMarketDayLow ?? 0;
    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh ?? 0;
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow ?? 0;
    const volume = meta.regularMarketVolume ?? 0;

    // Calculate previous close
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    const lastBarNull = closes.length > 0 && closes[closes.length - 1] == null;
    const nonNull = closes.filter((c): c is number => c != null);
    const prevClose = lastBarNull && nonNull.length >= 1
      ? nonNull[nonNull.length - 1]
      : nonNull.length >= 2 ? nonNull[nonNull.length - 2] : 0;

    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      symbol,
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      dayHigh: Math.round(dayHigh * 100) / 100,
      dayLow: Math.round(dayLow * 100) / 100,
      fiftyTwoWeekHigh: Math.round(fiftyTwoWeekHigh * 100) / 100,
      fiftyTwoWeekLow: Math.round(fiftyTwoWeekLow * 100) / 100,
      volume,
      previousClose: Math.round(prevClose * 100) / 100,
    };
  } catch (err) {
    return { error: `Failed to fetch ${symbol}: ${err}` };
  }
}
