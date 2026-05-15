/**
 * Tool: get_commodity_futures
 * 
 * Fetches live commodity futures from TradingView Scanner API.
 * Includes: Gold, Silver, Crude Oil WTI, Brent, Copper, Natural Gas,
 *           Soybeans, Wheat, Gasoline
 */

const COMMODITIES = [
  { ticker: 'COMEX:GC1!', name: 'Gold', flag: '🥇' },
  { ticker: 'COMEX:SI1!', name: 'Silver', flag: '🥈' },
  { ticker: 'NYMEX:CL1!', name: 'Crude Oil WTI', flag: '🛢️' },
  { ticker: 'NYMEX:BZ1!', name: 'Brent Oil', flag: '🛢️' },
  { ticker: 'COMEX:HG1!', name: 'Copper', flag: '🔶' },
  { ticker: 'NYMEX:NG1!', name: 'Natural Gas', flag: '🔥' },
  { ticker: 'CBOT:ZS1!', name: 'US Soybeans', flag: '🌱' },
  { ticker: 'CBOT:ZW1!', name: 'US Wheat', flag: '🌾' },
  { ticker: 'NYMEX:RB1!', name: 'Gasoline RBOB', flag: '⛽' },
];

export async function getCommodityFutures() {
  try {
    const payload = JSON.stringify({
      columns: ['close', 'change', 'change_abs', 'high', 'low'],
      symbols: { tickers: COMMODITIES.map(c => c.ticker) },
    });

    const res = await fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { error: 'Failed to fetch commodity futures' };
    const json = (await res.json()) as any;

    const commodities = json.data.map((item: any) => {
      const meta = COMMODITIES.find(c => c.ticker === item.s);
      const [price, changePct, changeAbs, high, low] = item.d;
      return {
        name: meta?.name || item.s,
        flag: meta?.flag || '',
        price: Math.round(price * 10000) / 10000,
        change: Math.round(changeAbs * 10000) / 10000,
        changePercent: Math.round(changePct * 100) / 100,
        high: Math.round(high * 10000) / 10000,
        low: Math.round(low * 10000) / 10000,
        direction: changePct > 0.05 ? 'up' : changePct < -0.05 ? 'down' : 'flat',
      };
    });

    return { generatedAt: new Date().toISOString(), commodities };
  } catch (err) {
    return { error: `Failed: ${err}` };
  }
}
