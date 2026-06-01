// ============================================================
// Multi-Agent Service — Deep Analysis using 5 specialist agents
//
// Architecture:
//   1. Orchestrator (rule-based, no LLM) → decides which agents to call
//   2. Analyst Agent → fundamentals (P/E, target, growth)
//   3. Technical Agent → RSI, MACD, support/resistance
//   4. Risk Agent → VIX, crude, FII, market conditions
//   5. News Agent → recent headlines from Google News RSS
//   6. Synthesis Agent → combines all into final recommendation
//
// Total: 5 Gemini calls per deep analysis
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AnalystDataService } from './analystDataService.js';
import type { YFService } from './yahooFinanceService.js';
import type { MarketPulseService } from './marketPulseService.js';
import { computeSupportResistance } from './supportResistanceService.js';
import { logAICall, estimateTokens } from './aiObservability.js';

// ── API Key Rotation (shared with agentService) ──────────────
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY || '',
  process.env.GEMINI_API_KEY_2 || '',
  process.env.GEMINI_API_KEY_3 || '',
  process.env.GEMINI_API_KEY_4 || '',
].filter(k => k.length > 0);

let keyIndex = 0;
function getKey(): string {
  const key = GEMINI_API_KEYS[keyIndex % GEMINI_API_KEYS.length];
  keyIndex++;
  return key;
}

// ── Helper: Call Gemini with focused prompt ───────────────────
async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
  const startTime = Date.now();
  const genAI = new GoogleGenerativeAI(getKey());
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userMessage);
      const text = result.response.text();
      if (text) {
        logAICall({
          type: 'multi-agent',
          question: userMessage.slice(0, 100),
          model: modelName,
          apiKeyIndex: keyIndex - 1,
          toolsUsed: [],
          rounds: 1,
          responseTimeMs: Date.now() - startTime,
          success: true,
          tokensEstimate: estimateTokens(systemPrompt + userMessage + text),
        });
        return text.trim();
      }
    } catch (err) {
      logAICall({
        type: 'multi-agent',
        question: userMessage.slice(0, 100),
        model: modelName,
        apiKeyIndex: keyIndex - 1,
        toolsUsed: [],
        rounds: 1,
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: (err as any)?.message || 'unknown',
        tokensEstimate: 0,
      });
      console.log(`[MultiAgent] ${modelName} failed, trying next...`);
      continue;
    }
  }
  return 'Analysis unavailable';
}

// ── News Fetcher (Google News RSS — free, no API key) ────────
async function fetchNews(stockName: string): Promise<string[]> {
  try {
    const query = encodeURIComponent(`${stockName} stock India`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    // Extract titles from RSS XML
    const titles: string[] = [];
    const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    let match;
    while ((match = regex.exec(xml)) !== null && titles.length < 8) {
      const title = (match[1] || match[2] || '').trim();
      if (title && title !== 'Google News' && title.length > 10) {
        titles.push(title);
      }
    }
    return titles;
  } catch {
    return [];
  }
}

// ── Agent 1: Analyst Agent ───────────────────────────────────
async function analystAgent(symbol: string, analystDataService: AnalystDataService): Promise<string> {
  // ETFs don't have analyst coverage
  const etfSymbols = ['NIFTYBEES.NS', 'GOLDBEES.NS', 'BANKBEES.NS', 'JUNIORBEES.NS', 'ITBEES.NS'];
  if (etfSymbols.includes(symbol) || symbol.includes('BEES')) {
    return `${symbol} is an ETF (Exchange Traded Fund) — analyst recommendations are not applicable. ETFs track an index/commodity and don't have individual analyst coverage, target prices, or buy/sell ratings.`;
  }

  const data = await analystDataService.getAnalystData(symbol);
  if (!data) return `No analyst data available for ${symbol}. This may be a less-covered stock or data is temporarily unavailable.`;

  return callGemini(
    `You are a fundamental analyst. Analyze ONLY: valuation (P/E, PEG), analyst consensus, target price, growth rates, and sector outlook. Be specific with numbers. Max 120 words. End with your fundamental verdict: Strong Buy / Buy / Hold / Sell.`,
    `Fundamental analysis for ${symbol}:\n${JSON.stringify(data, null, 2)}`
  );
}

// ── Agent 2: Technical Agent ─────────────────────────────────
async function technicalAgent(symbol: string, yfService: YFService): Promise<string> {
  let techData: any = null;
  try {
    const history = await yfService.getHistorical(symbol, '3mo');
    if (history && history.length > 0) {
      const closes = history.map(h => h.close);
      const highs = history.map(h => h.high);
      const lows = history.map(h => h.low);
      techData = computeSupportResistance(symbol, closes, highs, lows);
    }
  } catch { /* ignore */ }

  let currentPrice = 0;
  try {
    const quotes = await yfService.getQuotes([symbol]);
    if (quotes.length > 0) currentPrice = quotes[0].price;
  } catch { /* ignore */ }

  return callGemini(
    `You are a technical analyst. Analyze ONLY: RSI, MACD signal, support/resistance levels, trend direction (SMA 20/50/200), and entry/exit points. Include next week's expected trading range. Max 120 words. End with technical verdict: Bullish / Neutral / Bearish.`,
    `Technical analysis for ${symbol}:\nCurrent Price: ₹${currentPrice}\nSupport/Resistance: ${JSON.stringify(techData, null, 2)}`
  );
}

// ── Agent 3: Risk Agent ──────────────────────────────────────
async function riskAgent(symbol: string, marketPulseService: MarketPulseService): Promise<string> {
  const pulse = await marketPulseService.getPulse();

  return callGemini(
    `You are a risk analyst. Assess ONLY: India VIX level, crude oil impact, FII/DII flows, USD/INR movement, and geopolitical risks. Rate overall risk for buying this stock: LOW / MEDIUM / HIGH. Max 120 words.`,
    `Risk assessment for ${symbol}:\nMarket conditions: ${JSON.stringify({
      nifty: pulse.indicators.nifty50,
      vix: pulse.indicators.indiaVix,
      crude: pulse.indicators.brentCrude,
      usdInr: pulse.indicators.usdInr,
      fiiDii: pulse.fiiDii,
      sentiment: pulse.overallSentiment,
      score: pulse.overallScore,
    }, null, 2)}`
  );
}

// ── Agent 4: News Agent ──────────────────────────────────────
async function newsAgent(symbol: string): Promise<string> {
  // Extract stock name from symbol (RELIANCE.NS → Reliance)
  const stockName = symbol.replace('.NS', '').replace('.BO', '');
  const headlines = await fetchNews(stockName);

  if (headlines.length === 0) {
    return 'No recent news found for this stock.';
  }

  return callGemini(
    `You are a news analyst. Summarize the impact of recent news on this stock in a clean format.

Output format (use emojis for clarity):
1. Start with "Overall News Sentiment: 🟢 Positive / 🔴 Negative / 🟡 Mixed"
2. List top 3-4 impactful headlines as bullet points with emoji:
   • 🟢 [headline summary] — why it's positive
   • 🔴 [headline summary] — why it's negative
   • 🟡 [headline summary] — mixed/neutral impact
3. End with one line: "Key risk from news: [one sentence]"

Skip low-impact or generic headlines. Max 100 words. Be concise.`,
    `Recent news for ${symbol}:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
  );
}

// ── Agent 5: Synthesis Agent ─────────────────────────────────
async function synthesisAgent(
  symbol: string,
  analystOutput: string,
  technicalOutput: string,
  riskOutput: string,
  newsOutput: string,
): Promise<string> {
  return callGemini(
    `You are a senior investment advisor combining 4 specialist analyses into ONE actionable recommendation.

Structure your response EXACTLY like this:
1. VERDICT (one line: BUY / HOLD / WAIT FOR DIP / AVOID)
2. KEY POINTS (3-4 bullet points combining all analyses)
3. NEXT WEEK FORECAST (expected price range, support, resistance)
4. STRATEGY (specific entry price, stop loss, target)
5. RISK WARNING (one line)

Use ₹ for prices. Max 200 words. Be decisive, not vague.`,
    `Deep analysis for ${symbol}:

FUNDAMENTAL ANALYSIS:
${analystOutput}

TECHNICAL ANALYSIS:
${technicalOutput}

RISK ASSESSMENT:
${riskOutput}

NEWS IMPACT:
${newsOutput}

Provide your final combined recommendation with next week forecast.`
  );
}

// ── Main Multi-Agent Orchestrator ────────────────────────────
export interface MultiAgentService {
  deepAnalysis(symbol: string, onProgress: (msg: string) => void): Promise<string | null>;
  isAvailable(): boolean;
}

export function createMultiAgentService(
  analystDataService: AnalystDataService,
  yfService: YFService,
  marketPulseService: MarketPulseService,
): MultiAgentService {
  return {
    isAvailable() {
      return GEMINI_API_KEYS.length > 0;
    },

    async deepAnalysis(symbol: string, onProgress: (msg: string) => void): Promise<string | null> {
      if (GEMINI_API_KEYS.length === 0) return null;

      try {
        // Validate symbol first — check if Yahoo has data for it
        let currentPrice = 0;
        try {
          const quotes = await yfService.getQuotes([symbol]);
          if (quotes.length > 0 && quotes[0].price > 0) {
            currentPrice = quotes[0].price;
          }
        } catch { /* ignore */ }

        if (currentPrice === 0) {
          onProgress(`❌ Stock "${symbol}" not found on NSE/BSE.`);
          onProgress('');
          onProgress('Did you mean one of these?');
          onProgress('• HDFCBANK.NS (HDFC Bank)');
          onProgress('• RELIANCE.NS (Reliance Industries)');
          onProgress('• TCS.NS (Tata Consultancy)');
          onProgress('• INFY.NS (Infosys)');
          onProgress('• SBIN.NS (State Bank of India)');
          onProgress('• ICICIBANK.NS (ICICI Bank)');
          onProgress('');
          onProgress('💡 Tip: Use the exact NSE symbol with .NS suffix');
          return 'invalid_symbol';
        }

        // Run all 4 specialist agents in parallel
        onProgress('🔍 Analyst Agent analyzing fundamentals...');
        const analystResult = await analystAgent(symbol, analystDataService);

        onProgress('🔍 Technical Agent analyzing charts...');
        const technicalResult = await technicalAgent(symbol, yfService);

        onProgress('🔍 Risk Agent assessing market conditions...');
        const riskResult = await riskAgent(symbol, marketPulseService);

        onProgress('🔍 News Agent scanning headlines...');
        const newsResult = await newsAgent(symbol);

        onProgress('');
        onProgress('📊 **Analyst Agent:**');
        onProgress(analystResult);
        onProgress('');
        onProgress('📈 **Technical Agent:**');
        onProgress(technicalResult);
        onProgress('');
        onProgress('⚠️ **Risk Agent:**');
        onProgress(riskResult);
        onProgress('');
        onProgress('📰 **News Agent:**');
        onProgress(newsResult);
        onProgress('');
        onProgress('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        onProgress('📝 **Synthesis Agent** combining all analyses...');
        onProgress('');

        // Synthesis agent combines everything
        const synthesis = await synthesisAgent(symbol, analystResult, technicalResult, riskResult, newsResult);

        onProgress(synthesis);
        onProgress('');
        onProgress('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        onProgress('🔧 Agents: Analyst, Technical, Risk, News, Synthesis · 5 calls');
        onProgress('⚠️ Not financial advice.');

        return 'complete';
      } catch (err) {
        console.error('[MultiAgent] Error:', err);
        return null;
      }
    },
  };
}
