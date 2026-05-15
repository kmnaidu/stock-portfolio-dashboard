/**
 * Tool: get_index_futures
 * 
 * Fetches live index futures from TradingView Scanner API.
 * These trade after hours — useful for predicting next day's opening.
 * 
 * Includes: Nifty 50, Bank Nifty, S&P 500, NASDAQ 100, Dow Jones,
 *           Russell 2000, DAX, CAC 40
 */

const FUTURES = [
  { ticker: 'NSEIX:NIFTY1!', name: 'Nifty 50 Futures', flag: '🇮🇳' },
  { ticker: 'NSEIX:BANKNIFTY1!', name: 'Bank Nifty Futures', flag: '🇮🇳' },
  { ticker: 'CME_MINI:ES1!', name: 'S&P 500 Futures', flag: '🇺🇸' },
  { ticker: 'CME_MINI:NQ1!', name: 'NASDAQ 100 Futures', flag: '🇺🇸' },
  { ticker: 'CBOT_MINI:YM1!', name: 'Dow Jones Futures', flag: '🇺🇸' },
  { ticker: 'CME_MINI:RTY1!', name: 'Russell 2000 Futures', flag: '🇺🇸' },
  { ticker: 'EUREX:FDAX1!', name: 'DAX Futures', flag: '🇩🇪' },
  { ticker: 'EURONEXT:FCE1!', name: 'CAC 40 Futures', flag: '🇫🇷' },
];

export async function getIndexFutures() {
  try {
    const payload = JSON.stringify({
      columns: ['close', 'change', 'change_abs', 'high', 'low'],
      symbols: { tickers: FUTURES.map(f => f.ticker) },
    });

    const res = await fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { error: 'Failed to fetch index futures' };
    const json = (await res.json()) as any;

    const futures = json.data.map((item: any) => {
      const meta = FUTURES.find(f => f.ticker === item.s);
      const [price, changePct, changeAbs, high, low] = item.d;
      return {
        name: meta?.name || item.s,
        flag: meta?.flag || '',
        price: Math.round(price * 100) / 100,
        change: Math.round(changeAbs * 100) / 100,
        changePercent: Math.round(changePct * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        direction: changePct > 0.05 ? 'up' : changePct < -0.05 ? 'down' : 'flat',
      };
    });

    return { generatedAt: new Date().toISOString(), futures };
  } catch (err) {
    return { error: `Failed: ${err}` };
  }
}
