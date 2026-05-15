/**
 * Tool: get_market_pulse
 * 
 * Fetches Indian market pulse — all key indicators in one call.
 * Includes: Nifty 50, Sensex, GIFT Nifty, India VIX, Crude, USD/INR, Gold, Silver
 * Also calculates an overall sentiment score (-100 to +100).
 */

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0' };

async function fetchQuote(symbol: string): Promise<{ price: number; prevClose: number; change: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? 0;
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    const lastBarNull = closes.length > 0 && closes[closes.length - 1] == null;
    const nonNull = closes.filter((c): c is number => c != null);
    const prevClose = lastBarNull && nonNull.length >= 1
      ? nonNull[nonNull.length - 1]
      : nonNull.length >= 2 ? nonNull[nonNull.length - 2] : 0;

    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return { price, prevClose, change, changePct };
  } catch { return null; }
}

export async function getMarketPulse() {
  const [nifty, sensex, crude, usdInr, gold, silver, vix] = await Promise.all([
    fetchQuote('^NSEI'),
    fetchQuote('^BSESN'),
    fetchQuote('BZ=F'),
    fetchQuote('INR=X'),
    fetchQuote('GC=F'),
    fetchQuote('SI=F'),
    fetchQuote('^INDIAVIX'),
  ]);

  // Fetch GIFT Nifty from TradingView
  let giftNifty = null;
  try {
    const res = await fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: ['close', 'change', 'change_abs'], symbols: { tickers: ['NSEIX:NIFTY1!'] } }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = (await res.json()) as any;
      const d = json?.data?.[0]?.d;
      if (d) {
        const giftPrice = d[0];
        const niftyPrice = nifty?.price ?? 0;
        giftNifty = {
          price: giftPrice,
          gapFromNifty: Math.round((giftPrice - niftyPrice) * 100) / 100,
          gapPercent: niftyPrice > 0 ? Math.round(((giftPrice - niftyPrice) / niftyPrice) * 10000) / 100 : 0,
        };
      }
    }
  } catch { /* ignore */ }

  // Calculate sentiment score
  let score = 0;
  if (nifty && nifty.changePct > 0.3) score += 20;
  else if (nifty && nifty.changePct < -0.3) score -= 20;
  if (crude && crude.changePct > 1) score -= 15; // oil up = bad for India
  else if (crude && crude.changePct < -1) score += 15;
  if (usdInr && usdInr.changePct > 0.3) score -= 15; // rupee weak = bad
  else if (usdInr && usdInr.changePct < -0.3) score += 15;
  if (vix && vix.changePct > 5) score -= 10; // VIX spike = fear
  else if (vix && vix.changePct < -5) score += 10;

  const sentiment = score >= 20 ? 'bullish' : score <= -20 ? 'bearish' : 'neutral';

  return {
    generatedAt: new Date().toISOString(),
    sentiment,
    score,
    indicators: {
      nifty50: nifty ? { price: Math.round(nifty.price * 100) / 100, change: Math.round(nifty.change * 100) / 100, changePct: Math.round(nifty.changePct * 100) / 100 } : null,
      sensex: sensex ? { price: Math.round(sensex.price * 100) / 100, change: Math.round(sensex.change * 100) / 100, changePct: Math.round(sensex.changePct * 100) / 100 } : null,
      giftNifty,
      indiaVix: vix ? { value: Math.round(vix.price * 100) / 100, change: Math.round(vix.changePct * 100) / 100 } : null,
      brentCrude: crude ? { price: Math.round(crude.price * 100) / 100, change: Math.round(crude.changePct * 100) / 100 } : null,
      usdInr: usdInr ? { price: Math.round(usdInr.price * 100) / 100, change: Math.round(usdInr.changePct * 100) / 100 } : null,
      gold: gold ? { price: Math.round(gold.price * 100) / 100, change: Math.round(gold.changePct * 100) / 100 } : null,
      silver: silver ? { price: Math.round(silver.price * 100) / 100, change: Math.round(silver.changePct * 100) / 100 } : null,
    },
  };
}
