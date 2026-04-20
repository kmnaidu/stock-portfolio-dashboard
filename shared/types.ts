// ============================================================
// Shared data model interfaces for Stock Portfolio Dashboard
// ============================================================

export interface QuoteData {
  symbol: string;
  shortName: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketState: string;
  lastUpdated: string;
}

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PredictionData {
  symbol: string;
  generatedAt: string;
  disclaimer: string;
  predictions: {
    horizon: '1w' | '1mo' | '3mo';
    predictedPrice: number;
    confidence: number;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
    direction: 'up' | 'down' | 'neutral';
  }[];
}

export interface RecommendationData {
  symbol: string;
  consensusRating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  consensusScore: number;
  totalAnalysts: number;
  recommendations: {
    firm: string;
    rating: 'Buy' | 'Hold' | 'Sell' | 'Strong Buy' | 'Strong Sell';
    targetPrice: number;
    date: string;
  }[];
}

export interface PortfolioSummary {
  totalValue: number;
  totalDailyChange: number;
  totalDailyChangePercent: number;
  securitiesCount: number;
  lastUpdated: string;
}

export interface MarketStatus {
  status: 'pre-market' | 'open' | 'closed' | 'post-market';
  currentTimeIST: string;
  nextOpenTime?: string;
  nextCloseTime?: string;
}

export interface PredictionSet {
  symbol: string;
  generatedAt: string;
  predictions: {
    horizon: '1w' | '1mo' | '3mo';
    predictedPrice: number;
    confidence: number;
    direction: 'up' | 'down' | 'neutral';
  }[];
}

export const SUPPORTED_SECURITIES = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Energy' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Banking' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Banking' },
  { symbol: 'HAL.NS', name: 'Hindustan Aeronautics', sector: 'Defence' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecom' },
  { symbol: 'NIFTYBEES.NS', name: 'Nippon India Nifty BeES', sector: 'ETF' },
  { symbol: 'GOLDBEES.NS', name: 'Nippon India Gold BeES', sector: 'ETF' },
] as const;

export type SupportedSymbol = typeof SUPPORTED_SECURITIES[number]['symbol'];

export type TimeRange = '1d' | '1w' | '1mo' | '3mo' | '6mo' | '1y';

export type SortField = 'name' | 'price' | 'dailyChangePercent' | 'volume';
export type SortDirection = 'asc' | 'desc';
