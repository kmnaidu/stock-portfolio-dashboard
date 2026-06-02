/**
 * Daily Stock Briefing — Autonomous Agent
 * 
 * Runs twice daily (9 AM + 2 PM) via cron.
 * Fetches prices, news, market conditions for YOUR stocks.
 * Generates AI-powered briefing and sends via WhatsApp.
 * 
 * Setup: Add to server/.env:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, MY_WHATSAPP
 *   GEMINI_API_KEY (any of your 4 keys)
 * 
 * Run manually: npx tsx scripts/daily-briefing.ts
 * Cron: 0 9,14 * * 1-5 cd /path/to/project && npx tsx scripts/daily-briefing.ts
 */

import 'dotenv/config';

// ── Configuration ────────────────────────────────────────────
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const MY_WHATSAPP = process.env.MY_WHATSAPP || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// ── YOUR Stocks to Monitor ───────────────────────────────────
const MY_STOCKS = [
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', buyTarget: 1200, sellTarget: 1350 },
  { symbol: 'RELIANCE.NS', name: 'Reliance', buyTarget: 1300, sellTarget: 1500 },
  { symbol: 'HAL.NS', name: 'HAL', buyTarget: 4000, sellTarget: 4800 },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', buyTarget: 740, sellTarget: 850 },
  { symbol: 'SBIN.NS', name: 'SBI', buyTarget: 900, sellTarget: 1050 },
  { symbol: 'INFY.NS', name: 'Infosys', buyTarget: 1050, sellTarget: 1250 },
  { symbol: 'M&M.NS', name: 'M&M', buyTarget: 2800, sellTarget: 3500 },
  { symbol: 'ETERNAL.NS', name: 'Eternal (Zomato)', buyTarget: 220, sellTarget: 300 },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', buyTarget: 1750, sellTarget: 2100 },
];

// ── Fetch Stock Price ────────────────────────────────────────
async function getPrice(symbol: string): Promise<{ price: number; change: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return { price: Math.round(price * 100) / 100, change: Math.round(change * 100) / 100, changePct: Math.round(changePct * 100) / 100 };
  } catch { return null; }
}

// ── Fetch News (Google RSS) ──────────────────────────────────
async function fetchNews(query: string): Promise<string[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const titles: string[] = [];
    const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    let match;
    while ((match = regex.exec(xml)) !== null && titles.length < 5) {
      const title = (match[1] || match[2] || '').trim();
      if (title && title !== 'Google News' && title.length > 15) titles.push(title);
    }
    return titles;
  } catch { return []; }
}

// ── Fetch Market Indicators ──────────────────────────────────
async function getMarketData(): Promise<string> {
  const [nifty, vix, crude, usdInr] = await Promise.all([
    getPrice('^NSEI'),
    getPrice('^INDIAVIX'),
    getPrice('BZ=F'),
    getPrice('INR=X'),
  ]);

  // GIFT Nifty from TradingView
  let giftNifty = '';
  try {
    const res = await fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: ['close', 'change'], symbols: { tickers: ['NSEIX:NIFTY1!'] } }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as any;
    const d = json?.data?.[0]?.d;
    if (d) giftNifty = `GIFT Nifty: ${d[0]} (${d[1] >= 0 ? '+' : ''}${d[1].toFixed(2)}%)`;
  } catch {}

  return [
    nifty ? `Nifty: ${nifty.price} (${nifty.changePct >= 0 ? '+' : ''}${nifty.changePct}%)` : '',
    giftNifty,
    vix ? `VIX: ${vix.price} (${vix.changePct >= 0 ? '+' : ''}${vix.changePct}%)` : '',
    crude ? `Crude: $${crude.price} (${crude.changePct >= 0 ? '+' : ''}${crude.changePct}%)` : '',
    usdInr ? `USD/INR: ₹${usdInr.price}` : '',
  ].filter(Boolean).join(' | ');
}

// ── Call Gemini ──────────────────────────────────────────────
async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(30000),
    });
    const json = (await res.json()) as any;
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || 'Analysis unavailable';
  } catch (err) {
    return 'Analysis unavailable: ' + (err as any)?.message;
  }
}

// ── Send WhatsApp ────────────────────────────────────────────
async function sendWhatsApp(message: string): Promise<boolean> {
  if (!TWILIO_SID || !MY_WHATSAPP) { console.log('WhatsApp not configured'); return false; }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: TWILIO_FROM, To: MY_WHATSAPP, Body: message }).toString(),
    });
    const data = (await res.json()) as any;
    return !!data.sid;
  } catch { return false; }
}

// ── Main: Generate Briefing ──────────────────────────────────
async function generateBriefing() {
  const hour = new Date().getHours();
  const timeLabel = hour < 12 ? 'Morning' : 'Mid-Day';
  console.log(`\n🔔 Generating ${timeLabel} Briefing...\n`);

  // 1. Fetch all stock prices
  console.log('📈 Fetching prices...');
  const stockData: string[] = [];
  for (const stock of MY_STOCKS) {
    const data = await getPrice(stock.symbol);
    if (data) {
      const arrow = data.changePct >= 0 ? '▲' : '▼';
      stockData.push(`${stock.name} (${stock.symbol}): ₹${data.price} ${arrow} ${data.changePct}% | Buy target: ₹${stock.buyTarget} | Sell target: ₹${stock.sellTarget}`);
    }
  }

  // 2. Fetch news for each stock + market
  console.log('📰 Fetching news...');
  const allNews: string[] = [];
  for (const stock of MY_STOCKS) {
    const news = await fetchNews(`${stock.name} stock India`);
    if (news.length > 0) allNews.push(`${stock.name}: ${news[0]}`);
  }
  const marketNews = await fetchNews('India stock market RBI government policy');
  allNews.push(...marketNews.slice(0, 3).map(n => `Market: ${n}`));

  // 3. Fetch market indicators
  console.log('📊 Fetching market data...');
  const marketData = await getMarketData();

  // 4. Generate AI briefing
  console.log('🤖 Generating AI analysis...');
  const prompt = `You are a stock market analyst. Generate a WhatsApp briefing for an Indian retail investor.

FORMAT RULES (STRICT):
- Use WhatsApp formatting: *bold* for headers, _italic_ for emphasis
- Use line breaks between sections
- Keep TOTAL message under 1200 characters
- Use emojis sparingly (start of sections only)
- No markdown (no #, no **, no bullet dashes)
- Use • for bullet points

MARKET:
${marketData}

MY STOCKS:
${stockData.join('\n')}

NEWS:
${allNews.join('\n')}

Generate EXACTLY this structure:

📰 *NEWS*
• [most impactful news 1]
• [most impactful news 2]

📊 *MY STOCKS*
• STOCK ₹price (change%) → ACTION
• STOCK ₹price (change%) → ACTION
(one line per stock, max 7 stocks)

💡 *WHAT TO DO*
BUY: [stocks to buy or "None today"]
SELL: [stocks to sell or "Hold all"]
WATCH: [stocks near target]

Keep it concise. One line per stock. No long explanations.`;

  const briefing = await callGemini(prompt);

  // 5. Format final message
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const message = `📊 *${timeLabel} Briefing* | ${date} ${time}\n\n${briefing}\n\n_${marketData}_`;

  console.log('\n' + message + '\n');

  // 6. Send WhatsApp
  console.log('📱 Sending WhatsApp...');
  const sent = await sendWhatsApp(message);
  console.log(sent ? '✓ WhatsApp sent!' : '✗ WhatsApp failed (check credentials)');
}

generateBriefing();
