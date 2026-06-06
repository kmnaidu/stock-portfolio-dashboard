// ============================================================
// Investment Decision Service — LangGraph-style sequential agent
//
// Adapted from langgraph-agent/src/index.ts for server use.
// Streams progress via callback (SSE-friendly).
//
// Flow: fetchData → fetchFundamentals → analyzeValue 
//       → analyzeNews → [conditional] → assessRisk → makeDecision
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logAICall, estimateTokens } from './aiObservability.js';

// ── API Key Rotation ─────────────────────────────────────────
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY || '',
  process.env.GEMINI_API_KEY_2 || '',
  process.env.GEMINI_API_KEY_3 || '',
  process.env.GEMINI_API_KEY_4 || '',
].filter(k => k.length > 0);

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
let keyIdx = 0;

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const startTime = Date.now();

  for (let ki = 0; ki < Math.min(GEMINI_KEYS.length, 3); ki++) {
    const apiKey = GEMINI_KEYS[keyIdx % GEMINI_KEYS.length];
    keyIdx++;
    const genAI = new GoogleGenerativeAI(apiKey);

    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
        const result = await model.generateContent(userMessage);
        const text = result.response.text();
        if (text) {
          logAICall({
            type: 'decision-agent',
            question: userMessage.slice(0, 80),
            model: modelName,
            apiKeyIndex: keyIdx - 1,
            toolsUsed: [],
            rounds: 1,
            responseTimeMs: Date.now() - startTime,
            success: true,
            tokensEstimate: estimateTokens(systemPrompt + userMessage + text),
          });
          return text.trim();
        }
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('503') || msg.includes('429') || msg.includes('high demand')) continue;
        continue;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return 'Analysis unavailable (models overloaded)';
}

// ── State ────────────────────────────────────────────────────
interface DecisionState {
  symbol: string;
  targetReturn: number;
  timeHorizon: string;
  currentPrice: number;
  high52w: number;
  low52w: number;
  changePct: number;
  volume: number;
  analystTarget: number;
  analystCount: number;
  consensus: string;
  peRatio: number;
  pegRatio: number;
  revenueGrowth: number;
  profitMargins: number;
  dividendYield: number;
  sector: string;
  vix: number;
  crude: number;
  usdInr: number;
  valueAnalysis: string;
  newsAnalysis: string;
  riskAnalysis: string;
  isStructuralProblem: boolean;
  finalDecision: string;
}

// ── Node 1: Fetch Price ──────────────────────────────────────
async function fetchData(state: DecisionState): Promise<void> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(state.symbol)}?range=1y&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    const json = (await res.json()) as any;
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return;

    state.currentPrice = meta.regularMarketPrice || 0;
    state.high52w = meta.fiftyTwoWeekHigh || 0;
    state.low52w = meta.fiftyTwoWeekLow || 0;
    const prevClose = meta.chartPreviousClose || state.currentPrice;
    state.changePct = prevClose > 0 ? Math.round(((state.currentPrice - prevClose) / prevClose) * 10000) / 100 : 0;
    state.volume = meta.regularMarketVolume || 0;
  } catch {}
}

// ── Node 2: Fetch Fundamentals ───────────────────────────────
async function fetchFundamentals(state: DecisionState): Promise<void> {
  // Try production API (Redis cache)
  try {
    const apiBase = process.env.API_BASE || 'https://stock-api-9ukf.onrender.com';
    const res = await fetch(`${apiBase}/api/analyst/${encodeURIComponent(state.symbol)}`, { signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && !data.error) {
        state.analystTarget = data.targetMeanPrice || 0;
        state.analystCount = data.numberOfAnalystOpinions || 0;
        state.consensus = data.recommendationKey || 'N/A';
        state.peRatio = data.trailingPE || 0;
        state.pegRatio = data.pegRatio || 0;
        state.revenueGrowth = (data.revenueGrowth || 0) * 100;
        state.profitMargins = (data.profitMargins || 0) * 100;
        state.dividendYield = (data.dividendYield || 0) * 100;
        state.sector = data.sector || 'Unknown';
        return;
      }
    }
  } catch {}

  // Fallback: Yahoo
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(state.symbol)}?modules=financialData,defaultKeyStatistics`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = (await res.json()) as any;
      const fd = json?.quoteSummary?.result?.[0]?.financialData;
      const ks = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
      if (fd) {
        state.analystTarget = fd.targetMeanPrice?.raw || 0;
        state.analystCount = fd.numberOfAnalystOpinions?.raw || 0;
        state.consensus = fd.recommendationKey || 'N/A';
        state.revenueGrowth = (fd.revenueGrowth?.raw || 0) * 100;
        state.profitMargins = (fd.profitMargins?.raw || 0) * 100;
      }
      if (ks) {
        state.peRatio = ks.trailingPE?.raw || 0;
        state.pegRatio = ks.pegRatio?.raw || 0;
        state.dividendYield = (ks.dividendYield?.raw || 0) * 100;
      }
    }
  } catch {}
}

// ── Node 3: Value Analysis (LLM) ────────────────────────────
async function analyzeValue(state: DecisionState): Promise<void> {
  const posInRange = state.high52w > state.low52w
    ? Math.round(((state.currentPrice - state.low52w) / (state.high52w - state.low52w)) * 100) : 50;
  const targetPrice = state.currentPrice * (1 + state.targetReturn / 100);
  const analystUpside = state.analystTarget > 0
    ? Math.round(((state.analystTarget - state.currentPrice) / state.currentPrice) * 100) : 0;

  state.valueAnalysis = await callLLM(
    'You are a value investor. Analyze valuation, peer comparison, and return feasibility. Max 100 words. Be specific with numbers.',
    `Stock: ${state.symbol} (${state.sector})
Price: ₹${state.currentPrice} | 52W: ₹${state.low52w}-₹${state.high52w} (${posInRange}% of range)
P/E: ${state.peRatio.toFixed(1)} | PEG: ${state.pegRatio.toFixed(2)} | Rev Growth: ${state.revenueGrowth.toFixed(1)}%
Analyst: ${state.consensus} (${state.analystCount}) Target ₹${state.analystTarget} (+${analystUpside}%)
My Target: ${state.targetReturn}% (₹${targetPrice.toFixed(0)}) in ${state.timeHorizon}
Rate: DEEP VALUE / VALUE / FAIR / EXPENSIVE.`
  );
  await new Promise(r => setTimeout(r, 2000));
}

// ── Node 4: News Analysis (LLM) ─────────────────────────────
async function analyzeNews(state: DecisionState): Promise<void> {
  const stockName = state.symbol.replace('.NS', '');
  let stockNews: string[] = [];
  let marketNews: string[] = [];

  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(stockName + ' stock India')}&hl=en-IN&gl=IN`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    const xml = await res.text();
    const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    let match;
    while ((match = regex.exec(xml)) !== null && stockNews.length < 8) {
      const title = (match[1] || match[2] || '').trim();
      if (title && title !== 'Google News' && title.length > 15) stockNews.push(title);
    }
  } catch {}

  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent('India stock market RBI FED ' + state.sector)}&hl=en-IN&gl=IN`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    const xml = await res.text();
    const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    let match;
    while ((match = regex.exec(xml)) !== null && marketNews.length < 5) {
      const title = (match[1] || match[2] || '').trim();
      if (title && title !== 'Google News' && title.length > 15) marketNews.push(title);
    }
  } catch {}

  const newsText = await callLLM(
    `You are a news analyst for Indian stocks. Analyze:
1. Is the decline TEMPORARY or STRUCTURAL?
2. Upcoming CATALYSTS (earnings, IPO, policy)?
3. RBI/FED/government impact?
Max 120 words. End with verdict: TEMPORARY or STRUCTURAL.`,
    `Stock: ${state.symbol} (${state.sector}), Change: ${state.changePct}%
STOCK NEWS:\n${stockNews.join('\n') || 'None'}
MARKET NEWS:\n${marketNews.join('\n') || 'None'}`
  );

  state.newsAnalysis = newsText;
  const lastPart = newsText.slice(-80).toLowerCase();
  state.isStructuralProblem = lastPart.endsWith('structural') || lastPart.includes('verdict: structural');
  await new Promise(r => setTimeout(r, 2000));
}

// ── Node 5: Risk Assessment (LLM) ───────────────────────────
async function assessRisk(state: DecisionState): Promise<void> {
  try {
    const [vixRes, crudeRes, inrRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/^INDIAVIX?range=2d&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?range=2d&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/INR=X?range=2d&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
    ]);
    const getP = async (r: Response) => { const j = (await r.json()) as any; return j?.chart?.result?.[0]?.meta?.regularMarketPrice || 0; };
    state.vix = await getP(vixRes);
    state.crude = await getP(crudeRes);
    state.usdInr = await getP(inrRes);
  } catch {}

  state.riskAnalysis = await callLLM(
    `You are a risk analyst for Indian markets. Assess VIX, crude, rupee, FII sentiment. Rate: LOW / MEDIUM / HIGH. Max 100 words.`,
    `Stock: ${state.symbol} (${state.sector})
VIX: ${state.vix} | Crude: $${state.crude} | USD/INR: ₹${state.usdInr} | Change: ${state.changePct}%`
  );
  await new Promise(r => setTimeout(r, 2000));
}

// ── Node 6: Final Decision (LLM) ────────────────────────────
async function makeDecision(state: DecisionState): Promise<void> {
  const posInRange = state.high52w > state.low52w
    ? Math.round(((state.currentPrice - state.low52w) / (state.high52w - state.low52w)) * 100) : 50;
  const targetPrice = state.currentPrice * (1 + state.targetReturn / 100);

  state.finalDecision = await callLLM(
    `You are a senior investment advisor. Give a CLEAR, ACTIONABLE decision.
Include: VERDICT (BUY/HOLD/WAIT/AVOID), ENTRY STRATEGY, STOP LOSS, TARGET, CATALYSTS, RISKS, CONFIDENCE.
Use ₹ for prices. Max 250 words.`,
    `Stock: ${state.symbol} (${state.sector}) | Goal: ${state.targetReturn}% in ${state.timeHorizon}
Price: ₹${state.currentPrice} | 52W: ₹${state.low52w}-₹${state.high52w} (${posInRange}%)
Target needed: ₹${targetPrice.toFixed(0)}
Analyst: ${state.consensus} (${state.analystCount}) → ₹${state.analystTarget}
P/E: ${state.peRatio.toFixed(1)} | PEG: ${state.pegRatio.toFixed(2)} | Rev: ${state.revenueGrowth.toFixed(1)}%

VALUE: ${state.valueAnalysis}
NEWS: ${state.newsAnalysis}
RISK: ${state.riskAnalysis}
VIX: ${state.vix} | Crude: $${state.crude} | USD/INR: ₹${state.usdInr}`
  );
}

// ── Orchestrator (SSE-friendly) ──────────────────────────────
export interface InvestmentDecisionService {
  runDecision(symbol: string, targetReturn: number, timeHorizon: string, onProgress: (msg: string) => void): Promise<void>;
  isAvailable(): boolean;
}

export function createInvestmentDecisionService(): InvestmentDecisionService {
  return {
    isAvailable() { return GEMINI_KEYS.length > 0; },

    async runDecision(symbol: string, targetReturn: number, timeHorizon: string, onProgress: (msg: string) => void) {
      const state: DecisionState = {
        symbol, targetReturn, timeHorizon,
        currentPrice: 0, high52w: 0, low52w: 0, changePct: 0, volume: 0,
        analystTarget: 0, analystCount: 0, consensus: 'N/A', peRatio: 0,
        pegRatio: 0, revenueGrowth: 0, profitMargins: 0, dividendYield: 0, sector: 'Unknown',
        vix: 0, crude: 0, usdInr: 0,
        valueAnalysis: '', newsAnalysis: '', riskAnalysis: '',
        isStructuralProblem: false, finalDecision: '',
      };

      // Node 1
      onProgress(`📈 Fetching price data for ${symbol}...`);
      await fetchData(state);
      if (state.currentPrice === 0) {
        onProgress(`❌ Could not find stock "${symbol}". Check the symbol and try again.`);
        return;
      }
      onProgress(`Price: ₹${state.currentPrice} | 52W: ₹${state.low52w}-₹${state.high52w}`);

      // Node 2
      onProgress(`📊 Fetching fundamentals...`);
      await fetchFundamentals(state);
      onProgress(`Analyst: ${state.consensus} (${state.analystCount}) → Target ₹${state.analystTarget}`);

      // Node 3
      onProgress(`💰 Analyzing value & peers...`);
      await analyzeValue(state);
      onProgress(state.valueAnalysis);

      // Node 4
      onProgress(`📰 Analyzing news & catalysts...`);
      await analyzeNews(state);
      onProgress(state.newsAnalysis);

      // Conditional: structural → quick avoid
      if (state.isStructuralProblem) {
        onProgress('');
        onProgress('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        onProgress(`🚫 **VERDICT: AVOID ${symbol}**`);
        onProgress('Structural problem detected. Do not buy until resolved.');
        onProgress(`Consider alternatives in ${state.sector} sector.`);
        return;
      }

      // Node 5
      onProgress(`⚠️ Assessing market risk...`);
      await assessRisk(state);
      onProgress(`VIX: ${state.vix} | Crude: $${state.crude} | USD/INR: ₹${state.usdInr}`);
      onProgress(state.riskAnalysis);

      // Node 6
      onProgress('');
      onProgress('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      onProgress(`🎯 **INVESTMENT DECISION: ${symbol}**`);
      onProgress(`Goal: ${targetReturn}% in ${timeHorizon}`);
      onProgress('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      await makeDecision(state);
      onProgress(state.finalDecision);
      onProgress('');
      onProgress('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      onProgress('🔧 LangGraph: 4 LLM calls | ⚠️ Not financial advice.');
    },
  };
}
