/**
 * Investment Decision Agent — Built with LangGraph (Enhanced)
 * 
 * Complete analysis covering:
 * - 52W position & value assessment
 * - Analyst consensus (target, ratings, P/E, PEG)
 * - Peer comparison (vs sector peers)
 * - News & upcoming catalysts (IPOs, results, policy)
 * - Market risk (VIX, crude, FII/DII, USD/INR)
 * - Historical recovery patterns
 * - Final decision with entry/stop/target
 * 
 * LangGraph Flow:
 *   START → fetchData → fetchFundamentals → analyzeValue 
 *         → analyzeNews → [conditional] → assessRisk → makeDecision → END
 *                              ↓ (if structural)
 *                         quickAvoid → END
 */

import 'dotenv/config';
import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// ═══════════════════════════════════════════════════════════════
// STATE — All data that flows through the graph
// ═══════════════════════════════════════════════════════════════

const InvestmentState = Annotation.Root({
  // Input
  symbol: Annotation<string>(),
  stockName: Annotation<string>(),
  timeHorizon: Annotation<string>(),
  targetReturn: Annotation<number>(),
  
  // Price Data (from fetchData)
  currentPrice: Annotation<number>(),
  high52w: Annotation<number>(),
  low52w: Annotation<number>(),
  changePct: Annotation<number>(),
  volume: Annotation<number>(),
  dayHigh: Annotation<number>(),
  dayLow: Annotation<number>(),
  
  // Fundamentals (from fetchFundamentals)
  analystTarget: Annotation<number>(),
  analystCount: Annotation<number>(),
  consensus: Annotation<string>(),
  peRatio: Annotation<number>(),
  pegRatio: Annotation<number>(),
  revenueGrowth: Annotation<number>(),
  profitMargins: Annotation<number>(),
  dividendYield: Annotation<number>(),
  sector: Annotation<string>(),
  
  // Market Data (from assessRisk)
  vix: Annotation<number>(),
  crude: Annotation<number>(),
  usdInr: Annotation<number>(),
  niftyChange: Annotation<number>(),
  
  // Analysis outputs (from each agent node)
  valueAnalysis: Annotation<string>(),
  newsAnalysis: Annotation<string>(),
  riskAnalysis: Annotation<string>(),
  
  // Decision flags
  isStructuralProblem: Annotation<boolean>(),
  
  // Final output
  finalDecision: Annotation<string>(),
});

// ═══════════════════════════════════════════════════════════════
// LLM — with multi-key + multi-model fallback (resilient)
// ═══════════════════════════════════════════════════════════════

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY || '',
  process.env.GEMINI_API_KEY_2 || '',
  process.env.GEMINI_API_KEY_3 || '',
  process.env.GEMINI_API_KEY_4 || '',
].filter(k => k.length > 0);

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
let keyIdx = 0;

/** Call Gemini with automatic key rotation + model fallback */
async function callLLM(messages: Array<{ role: string; content: string }>): Promise<string> {
  for (let ki = 0; ki < Math.min(GEMINI_KEYS.length, 3); ki++) {
    const apiKey = GEMINI_KEYS[keyIdx % GEMINI_KEYS.length];
    keyIdx++;

    for (const model of MODELS) {
      try {
        const llm = new ChatGoogleGenerativeAI({ model, apiKey, temperature: 0.3, maxRetries: 1 });
        const response = await llm.invoke(messages as any);
        return response.content as string;
      } catch (err: any) {
        const status = err?.status || err?.statusCode || 0;
        const msg = err?.message || '';
        // 503 = overloaded, 429 = rate limited — try next model/key
        if (status === 503 || status === 429 || msg.includes('503') || msg.includes('429') || msg.includes('high demand')) {
          continue;
        }
        // Other errors — still try next but log
        console.error(`   ⚠ ${model} failed: ${msg.slice(0, 60)}`);
        continue;
      }
    }
    // All models failed with this key, small delay before next key
    await new Promise(r => setTimeout(r, 1500));
  }
  return 'Analysis unavailable (all models overloaded — try again in 30s)';
}

// ═══════════════════════════════════════════════════════════════
// NODE 1: Fetch Stock Price Data (Yahoo Finance)
// ═══════════════════════════════════════════════════════════════

async function fetchData(state: typeof InvestmentState.State) {
  console.log(`\n📈 [Node 1] Fetching price data for ${state.symbol}...`);
  
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(state.symbol)}?range=1y&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const json = (await res.json()) as any;
    const meta = json?.chart?.result?.[0]?.meta;
    
    const currentPrice = meta?.regularMarketPrice || 0;
    const high52w = meta?.fiftyTwoWeekHigh || 0;
    const low52w = meta?.fiftyTwoWeekLow || 0;
    const dayHigh = meta?.regularMarketDayHigh || currentPrice;
    const dayLow = meta?.regularMarketDayLow || currentPrice;
    const prevClose = meta?.chartPreviousClose || currentPrice;
    const changePct = prevClose > 0 ? Math.round(((currentPrice - prevClose) / prevClose) * 10000) / 100 : 0;
    const volume = meta?.regularMarketVolume || 0;
    
    console.log(`   Price: ₹${currentPrice} | Day: ₹${dayLow}-₹${dayHigh} | 52W: ₹${low52w}-₹${high52w} | Vol: ${volume}`);
    
    return { currentPrice, high52w, low52w, changePct, volume, dayHigh, dayLow };
  } catch (err) {
    console.error('   ❌ Price fetch failed:', (err as any)?.message);
    return { currentPrice: 0, high52w: 0, low52w: 0, changePct: 0, volume: 0, dayHigh: 0, dayLow: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// NODE 2: Fetch Fundamentals (from our production API / Redis cache)
// ═══════════════════════════════════════════════════════════════

async function fetchFundamentals(state: typeof InvestmentState.State) {
  console.log(`📊 [Node 2] Fetching fundamentals for ${state.symbol}...`);
  
  let analystTarget = 0, analystCount = 0, consensus = 'N/A';
  let peRatio = 0, pegRatio = 0, revenueGrowth = 0, profitMargins = 0, dividendYield = 0;
  let sector = 'Unknown';
  
  // Try our production API first (has Redis-cached analyst data)
  try {
    const apiBase = process.env.API_BASE || 'https://stock-api-9ukf.onrender.com';
    const res = await fetch(`${apiBase}/api/analyst/${encodeURIComponent(state.symbol)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && !data.error) {
        analystTarget = data.targetMeanPrice || data.targetMean || 0;
        analystCount = data.numberOfAnalystOpinions || data.analysts || 0;
        consensus = data.recommendationKey || data.consensus || 'N/A';
        peRatio = data.trailingPE || 0;
        pegRatio = data.pegRatio || 0;
        revenueGrowth = (data.revenueGrowth || 0) * 100;
        profitMargins = (data.profitMargins || 0) * 100;
        sector = data.sector || 'Unknown';
      }
    }
  } catch {}
  
  // Fallback: try Yahoo quoteSummary directly
  if (analystTarget === 0) {
    try {
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(state.symbol)}?modules=financialData,defaultKeyStatistics`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const json = (await res.json()) as any;
        const fd = json?.quoteSummary?.result?.[0]?.financialData;
        const ks = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
        if (fd) {
          analystTarget = fd.targetMeanPrice?.raw || 0;
          analystCount = fd.numberOfAnalystOpinions?.raw || 0;
          consensus = fd.recommendationKey || 'N/A';
          revenueGrowth = (fd.revenueGrowth?.raw || 0) * 100;
          profitMargins = (fd.profitMargins?.raw || 0) * 100;
        }
        if (ks) {
          peRatio = ks.trailingPE?.raw || ks.forwardPE?.raw || 0;
          pegRatio = ks.pegRatio?.raw || 0;
          dividendYield = (ks.dividendYield?.raw || 0) * 100;
        }
      }
    } catch {}
  }
  
  console.log(`   Analyst: ${consensus} (${analystCount} analysts) | Target: ₹${analystTarget}`);
  console.log(`   P/E: ${peRatio.toFixed(1)} | PEG: ${pegRatio.toFixed(2)} | Rev Growth: ${revenueGrowth.toFixed(1)}%`);
  console.log(`   Div Yield: ${dividendYield.toFixed(1)}% | Profit Margin: ${profitMargins.toFixed(1)}%`);
  
  return { analystTarget, analystCount, consensus, peRatio, pegRatio, revenueGrowth, profitMargins, dividendYield, sector };
}

// ═══════════════════════════════════════════════════════════════
// NODE 3: Analyze Value + Peers (LLM)
// ═══════════════════════════════════════════════════════════════

async function analyzeValue(state: typeof InvestmentState.State) {
  console.log('💰 [Node 3] Analyzing value & peer comparison...');
  
  const positionInRange = state.high52w > state.low52w 
    ? Math.round(((state.currentPrice - state.low52w) / (state.high52w - state.low52w)) * 100) 
    : 50;
  const targetPrice = state.currentPrice * (1 + state.targetReturn / 100);
  const analystUpside = state.analystTarget > 0 
    ? Math.round(((state.analystTarget - state.currentPrice) / state.currentPrice) * 100)
    : 0;

  const result = await callLLM([
    { role: 'system', content: 'You are a value investor. Analyze valuation, peer comparison, and return feasibility. Max 100 words. Be specific with numbers.' },
    { role: 'user', content: `Stock: ${state.symbol} (${state.sector})
Price: ₹${state.currentPrice} | 52W Range: ₹${state.low52w} - ₹${state.high52w}
Position in 52W range: ${positionInRange}% (0%=at low, 100%=at high)
P/E: ${state.peRatio.toFixed(1)} | PEG: ${state.pegRatio.toFixed(2)}
Revenue Growth: ${state.revenueGrowth.toFixed(1)}% | Profit Margin: ${state.profitMargins.toFixed(1)}%
Dividend Yield: ${state.dividendYield.toFixed(1)}%
Analyst Consensus: ${state.consensus} from ${state.analystCount} analysts
Analyst Target: ₹${state.analystTarget} (${analystUpside}% upside)
My Target: ${state.targetReturn}% (₹${targetPrice.toFixed(0)}) in ${state.timeHorizon}

Is my target achievable? How does valuation compare to sector peers? Rate: DEEP VALUE / VALUE / FAIR / EXPENSIVE.` }
  ]);
  
  await new Promise(r => setTimeout(r, 2000)); // Rate limit delay
  return { valueAnalysis: result };
}

// ═══════════════════════════════════════════════════════════════
// NODE 4: Analyze News + Upcoming Catalysts (LLM)
// ═══════════════════════════════════════════════════════════════

async function analyzeNews(state: typeof InvestmentState.State) {
  console.log('📰 [Node 4] Analyzing news & catalysts...');
  
  const stockName = state.symbol.replace('.NS', '');
  
  // Fetch stock-specific news
  let stockNews: string[] = [];
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(stockName + ' stock India')}&hl=en-IN&gl=IN`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await res.text();
    const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    let match;
    while ((match = regex.exec(xml)) !== null && stockNews.length < 8) {
      const title = (match[1] || match[2] || '').trim();
      if (title && title !== 'Google News' && title.length > 15) stockNews.push(title);
    }
  } catch {}
  
  // Fetch sector/market news
  let marketNews: string[] = [];
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent('India stock market RBI FED policy ' + state.sector)}&hl=en-IN&gl=IN`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await res.text();
    const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    let match;
    while ((match = regex.exec(xml)) !== null && marketNews.length < 5) {
      const title = (match[1] || match[2] || '').trim();
      if (title && title !== 'Google News' && title.length > 15) marketNews.push(title);
    }
  } catch {}

  const result = await callLLM([
    { role: 'system', content: `You are a news analyst for Indian stocks. Analyze:
1. Is the current decline TEMPORARY (market-wide, one-time event) or STRUCTURAL (fundamental business problem)?
2. What are upcoming CATALYSTS (earnings, IPO, policy, sector events)?
3. How do RBI/FED/government decisions impact this stock?
Max 120 words. End with verdict: TEMPORARY or STRUCTURAL.` },
    { role: 'user', content: `Stock: ${state.symbol} (${state.sector})
Current change: ${state.changePct}%

STOCK NEWS:
${stockNews.join('\n') || 'No recent stock-specific news'}

MARKET/SECTOR NEWS:
${marketNews.join('\n') || 'No recent market news'}` }
  ]);
  
  const newsText = result;
  // Only flag as structural if the FINAL verdict says STRUCTURAL
  const lastPart = newsText.slice(-80).toLowerCase();
  const isStructural = lastPart.endsWith('structural') || lastPart.includes('verdict: structural');
  
  await new Promise(r => setTimeout(r, 2000));
  return { newsAnalysis: newsText, isStructuralProblem: isStructural };
}

// ═══════════════════════════════════════════════════════════════
// NODE 5: Assess Market Risk + FII/DII (LLM)
// ═══════════════════════════════════════════════════════════════

async function assessRisk(state: typeof InvestmentState.State) {
  console.log('⚠️  [Node 5] Assessing market risk & institutional flows...');
  
  let vix = 0, crude = 0, usdInr = 0, niftyChange = 0;
  
  try {
    const [vixRes, crudeRes, inrRes, niftyRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/^INDIAVIX?range=2d&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?range=2d&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/INR=X?range=2d&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?range=2d&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
    ]);
    
    const getPrice = async (res: Response) => {
      const j = (await res.json()) as any;
      return j?.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
    };
    
    vix = await getPrice(vixRes);
    crude = await getPrice(crudeRes);
    usdInr = await getPrice(inrRes);
    const niftyPrice = await getPrice(niftyRes);
    niftyChange = state.changePct; // Use market change for now
  } catch {}
  
  console.log(`   VIX: ${vix} | Crude: $${crude} | USD/INR: ₹${usdInr}`);

  const result = await callLLM([
    { role: 'system', content: `You are a risk analyst for Indian markets. Assess:
1. Market volatility (VIX level and direction)
2. Crude oil impact on India
3. Rupee impact on this sector
4. FII sentiment (are foreigners buying or selling?)
5. Overall market risk for buying NOW
Rate risk: LOW / MEDIUM / HIGH. Max 100 words.` },
    { role: 'user', content: `Stock: ${state.symbol} (${state.sector})
India VIX: ${vix} | Brent Crude: $${crude} | USD/INR: ₹${usdInr}
Stock change today: ${state.changePct}%
Volume: ${state.volume.toLocaleString()}` }
  ]);
  
  await new Promise(r => setTimeout(r, 2000));
  return { riskAnalysis: result, vix, crude, usdInr, niftyChange };
}

// ═══════════════════════════════════════════════════════════════
// NODE 6: Make Final Investment Decision (LLM)
// ═══════════════════════════════════════════════════════════════

async function makeDecision(state: typeof InvestmentState.State) {
  console.log('💡 [Node 6] Making final investment decision...');
  
  const positionInRange = state.high52w > state.low52w 
    ? Math.round(((state.currentPrice - state.low52w) / (state.high52w - state.low52w)) * 100) 
    : 50;
  const targetPrice = state.currentPrice * (1 + state.targetReturn / 100);

  const result = await callLLM([
    { role: 'system', content: `You are a senior investment advisor. Give a CLEAR, ACTIONABLE decision.

Your response MUST include:
1. VERDICT: BUY / HOLD / WAIT FOR DIP / AVOID
2. REASONING: 3 key points combining all analyses
3. ENTRY STRATEGY: Specific price levels for phased buying
4. STOP LOSS: Where to exit if thesis fails
5. TARGET: Price target + expected timeline
6. UPCOMING CATALYSTS: Events that could accelerate returns
7. KEY RISKS: What to watch that could change the thesis
8. CONFIDENCE: HIGH / MEDIUM / LOW with reasoning

Use ₹ for prices. Be decisive, not vague. Max 250 words.` },
    { role: 'user', content: `═══ INVESTMENT DECISION REQUEST ═══
Stock: ${state.symbol} (${state.sector})
Goal: ${state.targetReturn}% return in ${state.timeHorizon}

═══ PRICE DATA ═══
Current: ₹${state.currentPrice}
52W Range: ₹${state.low52w} - ₹${state.high52w} (at ${positionInRange}% of range)
Target price needed: ₹${targetPrice.toFixed(0)}
Today: ${state.changePct > 0 ? '+' : ''}${state.changePct}%

═══ FUNDAMENTALS ═══
Analyst Consensus: ${state.consensus} (${state.analystCount} analysts)
Analyst Target: ₹${state.analystTarget} (${state.analystTarget > 0 ? Math.round(((state.analystTarget - state.currentPrice) / state.currentPrice) * 100) : 0}% upside)
P/E: ${state.peRatio.toFixed(1)} | PEG: ${state.pegRatio.toFixed(2)}
Revenue Growth: ${state.revenueGrowth.toFixed(1)}% | Profit Margin: ${state.profitMargins.toFixed(1)}%
Dividend Yield: ${state.dividendYield.toFixed(1)}%

═══ VALUE ANALYSIS ═══
${state.valueAnalysis}

═══ NEWS & CATALYSTS ═══
${state.newsAnalysis}

═══ RISK ASSESSMENT ═══
${state.riskAnalysis}
VIX: ${state.vix} | Crude: $${state.crude} | USD/INR: ₹${state.usdInr}` }
  ]);
  
  return { finalDecision: result };
}

// ═══════════════════════════════════════════════════════════════
// NODE 7: Quick Avoid (structural problem detected)
// ═══════════════════════════════════════════════════════════════

async function quickAvoid(state: typeof InvestmentState.State) {
  console.log('🚫 [Node 7] Structural problem — recommending AVOID');
  return {
    finalDecision: `🚫 VERDICT: AVOID ${state.symbol}

REASON: Structural problem detected.

${state.newsAnalysis}

RECOMMENDATION: Do not buy until the structural issue resolves. 
Consider alternatives in ${state.sector} sector.
Re-evaluate after next quarterly results.`
  };
}

// ═══════════════════════════════════════════════════════════════
// CONDITIONAL EDGE: Route after news analysis
// ═══════════════════════════════════════════════════════════════

function routeAfterNews(state: typeof InvestmentState.State): string {
  if (state.isStructuralProblem) {
    return 'quickAvoid';
  }
  return 'assessRisk';
}

// ═══════════════════════════════════════════════════════════════
// BUILD THE GRAPH
// ═══════════════════════════════════════════════════════════════

const graph = new StateGraph(InvestmentState)
  .addNode('fetchData', fetchData)
  .addNode('fetchFundamentals', fetchFundamentals)
  .addNode('analyzeValue', analyzeValue)
  .addNode('analyzeNews', analyzeNews)
  .addNode('assessRisk', assessRisk)
  .addNode('makeDecision', makeDecision)
  .addNode('quickAvoid', quickAvoid)
  
  .addEdge('__start__', 'fetchData')
  .addEdge('fetchData', 'fetchFundamentals')
  .addEdge('fetchFundamentals', 'analyzeValue')
  .addEdge('analyzeValue', 'analyzeNews')
  .addConditionalEdges('analyzeNews', routeAfterNews, {
    assessRisk: 'assessRisk',
    quickAvoid: 'quickAvoid',
  })
  .addEdge('assessRisk', 'makeDecision')
  .addEdge('makeDecision', '__end__')
  .addEdge('quickAvoid', '__end__');

const app = graph.compile();

// ═══════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const symbol = process.argv[2] || 'ICICIBANK.NS';
  const targetReturn = parseInt(process.argv[3] || '20');
  const timeHorizon = process.argv[4] || '6 months';
  
  const W = 60; // output width
  const line = '─'.repeat(W);
  const doubleLine = '═'.repeat(W);
  
  console.log('');
  console.log(doubleLine);
  console.log(`  🔬 INVESTMENT DECISION AGENT`);
  console.log(`  ${symbol} → ${targetReturn}% in ${timeHorizon}`);
  console.log(doubleLine);
  
  const startTime = Date.now();
  
  const result = await app.invoke({
    symbol,
    stockName: symbol.replace('.NS', ''),
    timeHorizon,
    targetReturn,
    currentPrice: 0, high52w: 0, low52w: 0, changePct: 0, volume: 0,
    dayHigh: 0, dayLow: 0,
    analystTarget: 0, analystCount: 0, consensus: '', peRatio: 0,
    pegRatio: 0, revenueGrowth: 0, profitMargins: 0, dividendYield: 0, sector: '',
    vix: 0, crude: 0, usdInr: 0, niftyChange: 0,
    valueAnalysis: '', newsAnalysis: '', riskAnalysis: '',
    isStructuralProblem: false,
    finalDecision: '',
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // ── Calculated metrics ──
  const posInRange = result.high52w > result.low52w 
    ? Math.round(((result.currentPrice - result.low52w) / (result.high52w - result.low52w)) * 100)
    : 0;
  const analystUpside = result.analystTarget > 0 
    ? Math.round(((result.analystTarget - result.currentPrice) / result.currentPrice) * 100)
    : 0;
  const targetPrice = result.currentPrice * (1 + targetReturn / 100);
  const distFromHigh = result.high52w > 0
    ? Math.round(((result.high52w - result.currentPrice) / result.high52w) * 100)
    : 0;
  
  // ── Visuals: position bar ──
  const barLen = 20;
  const filledLen = Math.round((posInRange / 100) * barLen);
  const posBar = '█'.repeat(filledLen) + '░'.repeat(barLen - filledLen);
  
  // ── Output ──
  console.log('');
  console.log(line);
  console.log(`  📊 DATA SNAPSHOT`);
  console.log(line);
  console.log(`  💰 Price    : ₹${result.currentPrice}  (${result.changePct >= 0 ? '+' : ''}${result.changePct}% today)`);
  console.log(`  📍 52W Range: ₹${result.low52w} [${posBar}] ₹${result.high52w}`);
  console.log(`               ${posInRange}% from low  |  ${distFromHigh}% below high`);
  console.log(`  🎯 My Target: ₹${targetPrice.toFixed(0)} (${targetReturn}% from current)`);
  console.log('');
  console.log(`  📈 Analyst  : ${result.consensus.toUpperCase()} (${result.analystCount} analysts)`);
  console.log(`               Target ₹${result.analystTarget} → +${analystUpside}% upside`);
  console.log(`  📊 Valuation: P/E ${result.peRatio.toFixed(1)} | PEG ${result.pegRatio.toFixed(2)} | Rev Growth ${result.revenueGrowth.toFixed(1)}%`);
  console.log(`               Margin ${result.profitMargins.toFixed(1)}% | Div Yield ${result.dividendYield.toFixed(1)}%`);
  console.log('');
  console.log(`  🌍 Macro    : VIX ${result.vix} | Crude $${result.crude} | USD/INR ₹${result.usdInr}`);
  console.log(line);
  
  // ── Value Analysis summary ──
  console.log(`  💰 VALUE ASSESSMENT`);
  console.log(line);
  wrapPrint(result.valueAnalysis, 56);
  console.log('');
  
  // ── News Analysis summary ──
  console.log(line);
  console.log(`  📰 NEWS & CATALYSTS`);
  console.log(line);
  wrapPrint(result.newsAnalysis, 56);
  console.log('');
  
  // ── Risk summary ──
  console.log(line);
  console.log(`  ⚠️  RISK ASSESSMENT`);
  console.log(line);
  wrapPrint(result.riskAnalysis, 56);
  console.log('');
  
  // ── Final Decision ──
  console.log(doubleLine);
  console.log(`  🏁 FINAL DECISION`);
  console.log(doubleLine);
  // Print decision with clean formatting
  result.finalDecision.split('\n').forEach((rawLine: string) => {
    const trimmed = rawLine.trim();
    if (!trimmed) { console.log(''); return; }
    // Highlight verdict lines
    if (trimmed.startsWith('VERDICT') || trimmed.startsWith('1.') || trimmed.startsWith('2.') || 
        trimmed.startsWith('3.') || trimmed.startsWith('4.') || trimmed.startsWith('5.') ||
        trimmed.startsWith('6.') || trimmed.startsWith('7.') || trimmed.startsWith('8.')) {
      console.log(`  ${trimmed}`);
    } else {
      console.log(`  ${trimmed}`);
    }
  });
  console.log('');
  console.log(doubleLine);
  console.log(`  ⏱️  ${elapsed}s | 4 LLM calls | ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`);
  console.log(doubleLine);
  console.log('');
}

// Helper: word-wrap and indent text for terminal display
function wrapPrint(text: string, maxWidth: number) {
  const lines = text.split('\n');
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) { console.log(''); continue; }
    
    // Keep short lines as-is
    if (trimmed.length <= maxWidth) {
      console.log(`  ${trimmed}`);
      continue;
    }
    
    // Word wrap long lines
    const words = trimmed.split(' ');
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).length > maxWidth && current.length > 0) {
        console.log(`  ${current}`);
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) console.log(`  ${current}`);
  }
}

main().catch(console.error);
