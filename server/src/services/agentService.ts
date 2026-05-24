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
import { logAICall, estimateTokens } from './aiObservability.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY || '',
  process.env.GEMINI_API_KEY_2 || '',
  process.env.GEMINI_API_KEY_3 || '',
  process.env.GEMINI_API_KEY_4 || '',
].filter(k => k.length > 0);

let currentKeyIndex = 0;

function getNextKey(): string {
  if (GEMINI_API_KEYS.length === 0) return '';
  const key = GEMINI_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
  return key;
}

const MAX_ROUNDS = 5; // Safety limit — prevent infinite loops
const MAX_HISTORY = 10; // Keep last 10 message pairs (20 messages total)
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes session timeout

// ── Session Memory Store ─────────────────────────────────────
// Stores conversation history per session. Each session has a list
// of {role, parts} messages that Gemini understands.
// Sessions expire after 30 minutes of inactivity.

interface SessionMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface Session {
  messages: SessionMessage[];
  lastAccess: number;
}

const sessions = new Map<string, Session>();

// Clean expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, id) => {
    if (now - session.lastAccess > SESSION_TTL) {
      sessions.delete(id);
    }
  });
}, 5 * 60 * 1000);

function getSession(sessionId: string): Session {
  let session = sessions.get(sessionId);
  if (!session) {
    session = { messages: [], lastAccess: Date.now() };
    sessions.set(sessionId, session);
  }
  session.lastAccess = Date.now();
  return session;
}

function addToSession(sessionId: string, userMessage: string, agentResponse: string) {
  const session = getSession(sessionId);
  session.messages.push(
    { role: 'user', parts: [{ text: userMessage }] },
    { role: 'model', parts: [{ text: agentResponse }] },
  );
  // Keep only last N pairs to avoid exceeding context window
  if (session.messages.length > MAX_HISTORY * 2) {
    session.messages = session.messages.slice(-MAX_HISTORY * 2);
  }
}

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
  sessionId?: string;
}

export interface AgentService {
  ask(question: string, sessionId?: string): Promise<AgentResponse | null>;
  askStream(question: string, sessionId: string, onChunk: (text: string) => void): Promise<{ toolsUsed: string[]; rounds: number } | null>;
  isAvailable(): boolean;
}

export function createAgentService(
  cache: CacheService,
  analystDataService: AnalystDataService,
  yfService: YFService,
  marketPulseService: MarketPulseService,
): AgentService {
  const isConfigured = GEMINI_API_KEYS.length > 0;
  const executors = createToolExecutors(analystDataService, yfService, marketPulseService);

  return {
    isAvailable() { return isConfigured; },

    async ask(question: string, sessionId?: string): Promise<AgentResponse | null> {
      if (!isConfigured) return null;

      const askStartTime = Date.now();

      // Get conversation history for this session
      const history = sessionId ? getSession(sessionId).messages : [];

      // Try each API key (rotation on 429 errors)
      const keysToTry = GEMINI_API_KEYS.length;
      let lastError: any = null;

      for (let keyAttempt = 0; keyAttempt < keysToTry; keyAttempt++) {
        const apiKey = getNextKey();
        const genAI = new GoogleGenerativeAI(apiKey);
      
      // Try models in order (fallback if one is overloaded)
      const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
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

          const chat = model.startChat({ history });
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
          // Also filter out raw tool response JSON that Gemini sometimes echoes
          let finalText = rawText
            .replace(/^[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。！？、；：""''（）【】]+[^\n]*\n?/gm, '')
            .replace(/\{"[\w_]+_response":\s*\{[^}]*\}\}\s*/g, '')
            .replace(/\{"\w+":\s*"\\"\{[^}]*\}\\?"[^}]*\}\s*/g, '')
            .trim();

          // Remove any remaining lines that look like raw JSON tool responses
          finalText = finalText.split('\n').filter(line => {
            const trimmed = line.trim();
            return !(trimmed.startsWith('{"get_') || trimmed.startsWith('{"result"'));
          }).join('\n').trim();

          // Save to session memory (so next question has context)
          if (sessionId) {
            addToSession(sessionId, question, finalText);
          }

          // Log successful AI call
          logAICall({
            type: 'agent',
            question,
            model: modelName,
            apiKeyIndex: currentKeyIndex,
            toolsUsed,
            rounds,
            responseTimeMs: Date.now() - askStartTime,
            success: true,
            sessionId,
            tokensEstimate: estimateTokens(question + finalText),
          });

          return {
            answer: finalText,
            toolsUsed,
            rounds,
            model: modelName,
            sessionId: sessionId || undefined,
          };
        } catch (err) {
          lastError = err;
          logAICall({
            type: 'agent',
            question,
            model: modelName,
            apiKeyIndex: currentKeyIndex,
            toolsUsed: [],
            rounds: 0,
            responseTimeMs: Date.now() - askStartTime,
            success: false,
            error: (err as any)?.message || 'unknown',
            sessionId,
            tokensEstimate: 0,
          });
          console.log(`[Agent] ${modelName} attempt ${attempt + 1} failed, trying next...`);
          continue;
        }
        break; // success — exit retry loop
        }
      }
      } // end key rotation loop

      console.error('[Agent] All keys and models exhausted:', lastError?.message || lastError);
      return null;
    },

    // ── Streaming version of ask ─────────────────────────────
    // Calls onChunk(text) for each piece of text as Gemini generates it.
    // Used by the SSE endpoint for real-time word-by-word display.
    async askStream(question: string, sessionId: string, onChunk: (text: string) => void): Promise<{ toolsUsed: string[]; rounds: number } | null> {
      if (!isConfigured) return null;

      const history = getSession(sessionId).messages;
      const apiKey = getNextKey();
      const genAI = new GoogleGenerativeAI(apiKey);

      const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash'];

      for (const modelName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            tools: [{ functionDeclarations: toolDeclarations }],
            systemInstruction: `You are a helpful Indian stock market assistant. You have access to tools that provide real-time stock data, analyst recommendations, technical indicators, and market conditions.

Rules:
- Use tools when you need current/live data.
- Use ₹ for Indian stock prices.
- Be concise (max 250 words).
- Always mention specific numbers when you have data from tools.
- When giving actionable advice, end with: Buy / Hold / Wait for dip / Avoid.
- Add disclaimer: "Not financial advice."
- ALWAYS respond in English only.`,
          });

          const chat = model.startChat({ history });
          const toolsUsed: string[] = [];
          let rounds = 0;

          // First, handle tool calls (non-streaming) until we get a text response
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
              functionResponse: { name: toolName, response: { result: toolResult } },
            }]);
          }

          // Now stream the final text response
          // Re-send the last response as a streaming request
          const finalText = response.response.text();
          if (!finalText) continue;

          // Clean the text
          const cleanText = finalText
            .replace(/^[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。！？、；：""''（）【】]+[^\n]*\n?/gm, '')
            .replace(/\{"[\w_]+_response":\s*\{[^}]*\}\}\s*/g, '')
            .trim()
            .split('\n')
            .filter(line => !line.trim().startsWith('{"get_') && !line.trim().startsWith('{"result"'))
            .join('\n')
            .trim();

          // Simulate streaming by sending words in chunks
          const words = cleanText.split(/(\s+)/);
          for (let i = 0; i < words.length; i += 3) {
            const chunk = words.slice(i, i + 3).join('');
            onChunk(chunk);
            await new Promise(r => setTimeout(r, 30)); // 30ms between chunks
          }

          // Save to session
          addToSession(sessionId, question, cleanText);

          return { toolsUsed, rounds };
        } catch (err) {
          console.log(`[Agent Stream] ${modelName} failed:`, (err as any)?.message);
          continue;
        }
      }

      return null;
    },
  };
}
