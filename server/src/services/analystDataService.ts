// ============================================================
// Analyst Data Service — fetches real analyst recommendations,
// target prices, and fundamentals from the Python yfinance
// microservice running on port 5001.
// ============================================================

import type { CacheService } from './cacheService.js';

const PYTHON_SERVICE_BASE = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
const TTL_ANALYST = 6 * 60 * 60; // 6 hours

export interface AnalystData {
  symbol: string;
  // Analyst target prices
  targetMeanPrice: number;
  targetHighPrice: number;
  targetLowPrice: number;
  targetMedianPrice: number;
  numberOfAnalystOpinions: number;
  recommendationMean: number;      // 1 = Strong Buy, 5 = Strong Sell (yfinance convention)
  recommendationKey: string;       // 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' | 'none'

  // Valuation ratios
  trailingPE: number;
  forwardPE: number;
  priceToBook: number;
  pegRatio: number;

  // Growth & profitability
  earningsGrowth: number;          // e.g. 0.125 = 12.5%
  revenueGrowth: number;
  profitMargins: number;
  returnOnEquity: number;

  // Market data
  marketCap: number;
  beta: number;
  trailingEps: number;
  forwardEps: number;
  bookValue: number;

  // Dividend
  dividendYield: number;
  payoutRatio: number;

  // 52-week
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;

  // Company info
  sector: string;
  industry: string;
  longName: string;

  // Recommendation trend history (latest first)
  recommendationTrend: {
    period: string;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  }[];
}

export interface AnalystDataService {
  getAnalystData(symbol: string): Promise<AnalystData | null>;
  isAvailable(): Promise<boolean>;
}

export function createAnalystDataService(cache: CacheService): AnalystDataService {
  return {
    async isAvailable(): Promise<boolean> {
      try {
        const res = await fetch(`${PYTHON_SERVICE_BASE}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async getAnalystData(symbol: string): Promise<AnalystData | null> {
      const cacheKey = `analyst:${symbol}`;
      const cached = cache.get<AnalystData>(cacheKey);
      if (cached) return cached;

      try {
        const res = await fetch(`${PYTHON_SERVICE_BASE}/analyst/${encodeURIComponent(symbol)}`, {
          signal: AbortSignal.timeout(60000), // 60s — ScraperAPI + proxy needs time
        });

        if (!res.ok) return null;

        const json = (await res.json()) as any;
        if (json.error) return null;

        const data: AnalystData = {
          symbol: json.symbol ?? symbol,
          targetMeanPrice: json.targetMeanPrice ?? 0,
          targetHighPrice: json.targetHighPrice ?? 0,
          targetLowPrice: json.targetLowPrice ?? 0,
          targetMedianPrice: json.targetMedianPrice ?? 0,
          numberOfAnalystOpinions: json.numberOfAnalystOpinions ?? 0,
          recommendationMean: json.recommendationMean ?? 0,
          recommendationKey: json.recommendationKey ?? 'none',

          trailingPE: json.trailingPE ?? 0,
          forwardPE: json.forwardPE ?? 0,
          priceToBook: json.priceToBook ?? 0,
          pegRatio: json.pegRatio ?? 0,

          earningsGrowth: json.earningsGrowth ?? 0,
          revenueGrowth: json.revenueGrowth ?? 0,
          profitMargins: json.profitMargins ?? 0,
          returnOnEquity: json.returnOnEquity ?? 0,

          marketCap: json.marketCap ?? 0,
          beta: json.beta ?? 0,
          trailingEps: json.trailingEps ?? 0,
          forwardEps: json.forwardEps ?? 0,
          bookValue: json.bookValue ?? 0,

          dividendYield: json.dividendYield ?? 0,
          payoutRatio: json.payoutRatio ?? 0,

          fiftyTwoWeekHigh: json.fiftyTwoWeekHigh ?? 0,
          fiftyTwoWeekLow: json.fiftyTwoWeekLow ?? 0,

          sector: json.sector ?? '',
          industry: json.industry ?? '',
          longName: json.longName ?? symbol,

          recommendationTrend: Array.isArray(json.recommendationTrend)
            ? json.recommendationTrend
            : [],
        };

        cache.set(cacheKey, data, TTL_ANALYST);
        return data;
      } catch {
        return null;
      }
    },
  };
}
