// ============================================================
// AI Analysis Service — uses Google Gemini to generate
// natural language stock analysis from existing data.
// This is the "Generation" part of RAG.
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CacheService } from './cacheService.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TTL_AI_ANALYSIS = 6 * 60 * 60; // Cache AI responses for 6 hours

export interface AIAnalysisInput {
  symbol: string;
  stockName: string;
  currentPrice: number;
  // Analyst data
  analystCount?: number;
  consensusRating?: string;
  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  upsidePercent?: number;
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  profitMargins?: number;
  // Technicals
  rsi14?: number;
  macdSignal?: string;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  support1?: number;
  resistance1?: number;
  buyRangeLow?: number;
  buyRangeHigh?: number;
  verdict?: string;
  // Market context
  niftyChange?: number;
  fiiSentiment?: string;
  overallMarketSentiment?: string;
}

export interface AIAnalysisResult {
  symbol: string;
  analysis: string;
  generatedAt: string;
  model: string;
}

export interface AIAnalysisService {
  generateAnalysis(input: AIAnalysisInput): Promise<AIAnalysisResult | null>;
  isAvailable(): boolean;
}

export function createAIAnalysisService(cache: CacheService): AIAnalysisService {
  const isConfigured = Boolean(GEMINI_API_KEY);

  if (!isConfigured) {
    console.log('⚠ GEMINI_API_KEY not set — AI analysis disabled');
  } else {
    console.log('✓ Google Gemini AI configured');
  }

  return {
    isAvailable(): boolean {
      return isConfigured;
    },

    async generateAnalysis(input: AIAnalysisInput): Promise<AIAnalysisResult | null> {
      if (!isConfigured) return null;

      // Check cache first
      const cacheKey = `ai-analysis:${input.symbol}`;
      const cached = cache.get<AIAnalysisResult>(cacheKey);
      if (cached) return cached;

      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        
        // Try models in order of preference (fallback chain)
        const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
        let text = '';
        let usedModel = '';

        for (const modelName of modelNames) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const context = buildContext(input);
            const prompt = buildPrompt(input.stockName, context);
            const result = await model.generateContent(prompt);
            const response = result.response;
            text = response.text();
            usedModel = modelName;
            if (text) break;
          } catch (modelErr) {
            console.log(`AI: ${modelName} failed, trying next...`);
            continue;
          }
        }

        if (!text) return null;

        const analysisResult: AIAnalysisResult = {
          symbol: input.symbol,
          analysis: text,
          generatedAt: new Date().toISOString(),
          model: usedModel,
        };

        // Cache the result
        cache.set(cacheKey, analysisResult, TTL_AI_ANALYSIS);
        return analysisResult;
      } catch (err) {
        console.error('AI Analysis error:', err instanceof Error ? err.message : err);
        return null;
      }
    },
  };
}

function buildContext(input: AIAnalysisInput): string {
  const lines: string[] = [];

  lines.push(`Stock: ${input.stockName} (${input.symbol})`);
  lines.push(`Current Price: ₹${input.currentPrice}`);
  lines.push('');

  // Analyst data
  if (input.analystCount && input.analystCount > 0) {
    lines.push('── INSTITUTIONAL ANALYST DATA ──');
    lines.push(`Analysts covering: ${input.analystCount}`);
    lines.push(`Consensus: ${input.consensusRating || 'N/A'}`);
    if (input.targetMeanPrice) lines.push(`Target (Mean): ₹${input.targetMeanPrice} (${input.upsidePercent?.toFixed(1)}% upside)`);
    if (input.targetHighPrice) lines.push(`Target Range: ₹${input.targetLowPrice} to ₹${input.targetHighPrice}`);
    if (input.trailingPE) lines.push(`P/E (TTM): ${input.trailingPE.toFixed(1)}`);
    if (input.forwardPE) lines.push(`Forward P/E: ${input.forwardPE.toFixed(1)}`);
    if (input.pegRatio) lines.push(`PEG Ratio: ${input.pegRatio.toFixed(2)}`);
    if (input.revenueGrowth) lines.push(`Revenue Growth: ${(input.revenueGrowth * 100).toFixed(1)}%`);
    if (input.earningsGrowth) lines.push(`Earnings Growth: ${(input.earningsGrowth * 100).toFixed(1)}%`);
    if (input.profitMargins) lines.push(`Profit Margin: ${(input.profitMargins * 100).toFixed(1)}%`);
    lines.push('');
  }

  // Technical indicators
  lines.push('── TECHNICAL INDICATORS ──');
  if (input.rsi14) lines.push(`RSI (14): ${input.rsi14.toFixed(1)}`);
  if (input.macdSignal) lines.push(`MACD: ${input.macdSignal}`);
  if (input.sma20) lines.push(`SMA 20: ₹${input.sma20.toFixed(2)}`);
  if (input.sma50) lines.push(`SMA 50: ₹${input.sma50.toFixed(2)}`);
  if (input.sma200) lines.push(`SMA 200: ₹${input.sma200.toFixed(2)}`);
  if (input.support1) lines.push(`Support (S1): ₹${input.support1.toFixed(2)}`);
  if (input.resistance1) lines.push(`Resistance (R1): ₹${input.resistance1.toFixed(2)}`);
  if (input.buyRangeLow && input.buyRangeHigh) {
    lines.push(`Buy Range: ₹${input.buyRangeLow.toFixed(2)} to ₹${input.buyRangeHigh.toFixed(2)}`);
  }
  if (input.verdict) lines.push(`Technical Verdict: ${input.verdict}`);
  lines.push('');

  // Market context
  if (input.niftyChange !== undefined || input.fiiSentiment) {
    lines.push('── MARKET CONTEXT ──');
    if (input.niftyChange !== undefined) lines.push(`Nifty 50 today: ${input.niftyChange >= 0 ? '+' : ''}${input.niftyChange.toFixed(2)}%`);
    if (input.fiiSentiment) lines.push(`FII activity: ${input.fiiSentiment}`);
    if (input.overallMarketSentiment) lines.push(`Overall market: ${input.overallMarketSentiment}`);
  }

  return lines.join('\n');
}

function buildPrompt(stockName: string, context: string): string {
  return `You are an experienced Indian stock market analyst providing a brief analysis for a retail investor.

Given the following data about ${stockName}, provide a concise analysis covering:
1. Overall assessment (1-2 sentences)
2. Key strengths (bullet points)
3. Key risks (bullet points)  
4. Action suggestion: Buy / Hold / Wait for dip / Avoid — with specific price levels if possible
5. Time horizon recommendation

Rules:
- Be concise (max 200 words)
- Use ₹ for Indian prices
- Mention specific numbers from the data
- If analyst consensus and technicals contradict, explain why
- Always mention at least one risk
- End with a clear, actionable recommendation
- Add disclaimer: "This is AI-generated analysis based on available data. Not financial advice."

DATA:
${context}`;
}
