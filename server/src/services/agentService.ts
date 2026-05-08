// ============================================================
// AI Agent Service — Tool-Calling Agent using Google Gemini
//
// How it works:
// 1. User asks a question (e.g., "Should I buy ICICI Bank?")
// 2. Agent sends question + tool definitions to Gemini
// 3. Gemini decides which tool to call (e.g., get_analyst_data)
// 4. Agent executes the tool, sends result back to Gemini
// 5. Gemini may call more tools or generate final answer
// 6. Loop continues until Gemini gives a text response
//
// This is the ReAct pattern: Reason → Act → Observe → Repeat
// ============================================================

import { GoogleGenerativeAI, type FunctionDeclaration, SchemaType } from '@google/generative-ai';
import type { CacheService } from './cacheService.js';
import type { AnalystDataService } from './analystDataService.js';
import type { YFService } from './yahooFinanceService.js';
import type { MarketPulseService } from './marketPulseService.js';
import { computeSupportResistance } from './supportResistanceService.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MAX_ROUNDS = 5; // Safety limit — prevent infinite loops

// ── STEP 1: Define the tools (the "menu" for Gemini) ────────

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_analyst_data',
    description: 'Get institutional analyst consensus data for a stock: target prices, P/E, PEG, growth rates, number of analysts, recommendation (buy/hold/sell). Use this when the user asks about valuation, analyst opinion, or fundamental data.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: {
          type: SchemaType.STRING,
          description: 'NSE stock symbol with .NS suffix, e.g., ICICIBANK.NS, RELIANCE.NS, TCS.NS',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_technicals',
    description: 'Get technical analysis indicators for a stock: RSI, MACD, support/resistance levels, SMA 20/50/200, buy range, and overall technical verdict. Use this when the user asks about entry/exit points, timing, or technical signals.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: {
          type: SchemaType.STRING,
          description: 'NSE stock symbol with .NS suffix',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_market_pulse',
    description: 'Get overall market conditions: Nifty 50, Sensex direction, FII/DII activity, crude oil, USD/INR, gold, silver, and overall bullish/bearish/neutral verdict. Use this when the user asks about market safety, macro conditions, or whether it is a good time to invest.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_stock_price',
    description: 'Get the current live price, daily change, and volume for a stock. Use this for basic price queries.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: {
          type: SchemaType.STRING,
          description: 'NSE stock symbol with .NS suffix',
        },
      },
      required: ['symbol'],
    },
  },
];

// ── STEP 2: Tool execution functions ─────────────────────────

interface ToolExecutors {
  get_analyst_data: (args: { symbol: string }) => Promise<string>;
  get_technicals: (args: { symbol: string }) => Promise<string>;
  get_market_pulse: () => Promise<string>;
  get_stock_price: (args: { symbol: string }) => Promise<string>;
}

function createToolExecutors(
  analystDataService: AnalystDataService,
  yfService: YFService,
  marketPulseService: MarketPulseService,
): ToolExecutors {
  return {
    async get_analyst_data({ symbol }) {
      const data = await analystDataService.getAnalystData(symbol);
      if (!data) return JSON.stringify({ error: 'No analyst data available for ' + symbol });
      return JSON.stringify({
        symbol: data.symbol,
        analysts: data.numberOfAnalystOpinions,
        consensus: data.recommendationKey,
        targetMean: data.targetMeanPrice,
        targetHigh: data.targetHighPrice,
        targetLow: data.targetLowPrice,
        trailingPE: data.trailingPE,
        forwardPE: data.forwardPE,
        pegRatio: data.pegRatio,
        revenueGrowth: data.revenueGrowth,
        earningsGrowth: data.earningsGrowth,
        profitMargins: data.profitMargins,
        marketCap: data.marketCap,
        sector: data.sector,
        industry: data.industry,
      });
    },

    async get_technicals({ symbol }) {
      try {
        const hist = await yfService.getHistorical(symbol, '1y');
        if (hist.length < 30) return JSON.stringify({ error: 'Insufficient data for ' + symbol });
        const closes = hist.map(d => d.close).filter(p => p > 0);
        const highs = hist.map(d => d.high).filter(p => p > 0);
        const lows = hist.map(d => d.low).filter(p => p > 0);
        const sr = computeSupportResistance(symbol, closes, highs, lows);
        return JSON.stringify({
          symbol,
          currentPrice: sr.currentPrice,
          rsi14: sr.rsi14,
          macdSignal: sr.macdSignal,
          sma20: sr.sma20,
          sma50: sr.sma50,
          sma200: sr.sma200,
          support1: sr.support1,
          resistance1: sr.resistance1,
          buyRangeLow: sr.buyRangeLow,
          buyRangeHigh: sr.buyRangeHigh,
          verdict: sr.verdict,
        });
      } catch {
        return JSON.stringify({ error: 'Failed to get technicals for ' + symbol });
      }
    },

    async get_market_pulse() {
      try {
        const pulse = await marketPulseService.getPulse();
        return JSON.stringify({
          sentiment: pulse.overallSentiment,
          score: pulse.overallScore,
          verdict: pulse.verdict,
          nifty: { value: pulse.indicators.nifty50.value, change: pulse.indicators.nifty50.changePercent },
          sensex: { value: pulse.indicators.sensex.value, change: pulse.indicators.sensex.changePercent },
          fiiActivity: pulse.fiiDii?.fiiSentiment ?? 'unknown',
          diiActivity: pulse.fiiDii?.diiSentiment ?? 'unknown',
        });
      } catch {
        return JSON.stringify({ error: 'Market pulse unavailable' });
      }
    },

    async get_stock_price({ symbol }) {
      try {
        const quotes = await yfService.getQuotes([symbol]);
        if (quotes.length === 0) return JSON.stringify({ error: 'Price not found for ' + symbol });
        const q = quotes[0];
        return JSON.stringify({
          symbol: q.symbol,
          name: q.shortName,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          volume: q.volume,
          dayHigh: q.dayHigh,
          dayLow: q.dayLow,
        });
      } catch {
        return JSON.stringify({ error: 'Failed to get price for ' + symbol });
      }
    },
  };
}

// ── STEP 3: The Agent Loop (ReAct pattern) ───────────────────

export interface AgentResponse {
  answer: string;
  toolsUsed: string[];
  rounds: number;
  model: string;
}

export interface AgentService {
  ask(question: string): Promise<AgentResponse | null>;
  isAvailable(): boolean;
}

export function createAgentService(
  cache: CacheService,
  analystDataService: AnalystDataService,
  yfService: YFService,
  marketPulseService: MarketPulseService,
): AgentService {
  const isConfigured = Boolean(GEMINI_API_KEY);
  const executors = createToolExecutors(analystDataService, yfService, marketPulseService);

  return {
    isAvailable() { return isConfigured; },

    async ask(question: string): Promise<AgentResponse | null> {
      if (!isConfigured) return null;

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      
      // Try models in order (fallback if one is overloaded)
      const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
      let lastError: any = null;

      for (const modelName of modelNames) {
        // Retry each model up to 2 times with delay
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, 3000)); // wait 3s before retry
          try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            tools: [{ functionDeclarations: toolDeclarations }],
            systemInstruction: `You are a helpful Indian stock market assistant. You have access to tools that provide real-time stock data, analyst recommendations, technical indicators, and market conditions.

Rules:
- Use tools when you need current/live data (prices, analyst targets, technicals, market pulse).
- For general market knowledge, predictions, or educational questions, you can answer from your own knowledge WITHOUT calling tools.
- Use ₹ for Indian stock prices.
- Be concise (max 250 words in final answer).
- Always mention specific numbers when you have data from tools.
- If analyst consensus and technicals disagree, explain why.
- When giving actionable advice, end with: Buy / Hold / Wait for dip / Avoid.
- Add disclaimer: "Not financial advice."
- If the user mentions a stock name without .NS suffix, add it (e.g., "ICICI Bank" → ICICIBANK.NS).
- For prediction questions, use market pulse data + your knowledge of market patterns to give a reasoned outlook.
- ALWAYS respond in English only. Never include any other language in your response.`,
          });

          const chat = model.startChat();
          const toolsUsed: string[] = [];
          let rounds = 0;

          let response = await chat.sendMessage(question);

          while (rounds < MAX_ROUNDS) {
            rounds++;
            const candidate = response.response.candidates?.[0];
            const parts = candidate?.content?.parts ?? [];
            const functionCall = parts.find(p => p.functionCall);

            if (!functionCall?.functionCall) break;

            const toolName = functionCall.functionCall.name as keyof ToolExecutors;
            const toolArgs = (functionCall.functionCall.args ?? {}) as any;
            toolsUsed.push(toolName);

            console.log(`[Agent] Round ${rounds}: calling ${toolName}(${JSON.stringify(toolArgs)})`);

            let toolResult: string;
            try {
              if (toolName === 'get_market_pulse') {
                toolResult = await executors.get_market_pulse();
              } else {
                toolResult = await (executors[toolName] as any)(toolArgs);
              }
            } catch {
              toolResult = JSON.stringify({ error: 'Tool execution failed' });
            }

            response = await chat.sendMessage([{
              functionResponse: {
                name: toolName,
                response: { result: toolResult },
              },
            }]);
          }

          const rawText = response.response.text();
          if (!rawText) continue;

          // Filter out any leaked "thinking" text (non-Latin characters at the start)
          const finalText = rawText.replace(/^[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。！？、；：""''（）【】]+[^\n]*\n?/gm, '').trim();

          return {
            answer: finalText,
            toolsUsed,
            rounds,
            model: modelName,
          };
        } catch (err) {
          lastError = err;
          console.log(`[Agent] ${modelName} attempt ${attempt + 1} failed, trying next...`);
          continue;
        }
        break; // success — exit retry loop
        }
      }

      console.error('[Agent] All models failed:', lastError?.message || lastError);
      return null;
    },
  };
}
