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
  // Petroleum & Energy
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Petroleum' },
  { symbol: 'ADANIPOWER.NS', name: 'Adani Power', sector: 'Power' },
  { symbol: 'TATAPOWER.NS', name: 'Tata Power', sector: 'Power' },

  // Banking
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Banking' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Banking' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Banking' },
  { symbol: 'CUB.NS', name: 'City Union Bank', sector: 'Banking' },

  // IT
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services', sector: 'IT' },
  { symbol: 'INFY.NS', name: 'Infosys', sector: 'IT' },
  { symbol: 'KPITTECH.NS', name: 'KPIT Technologies', sector: 'IT' },

  // Auto
  { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', sector: 'Auto' },
  { symbol: 'TVSMOTOR.NS', name: 'TVS Motor', sector: 'Auto' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', sector: 'Auto' }, // TMC → TATAMOTORS

  // Engineering & Defence
  { symbol: 'HAL.NS', name: 'Hindustan Aeronautics', sector: 'Engineering' },
  { symbol: 'BEL.NS', name: 'Bharat Electronics', sector: 'Engineering' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro', sector: 'Construction' },

  // Telecom
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecom' },

  // Pharma & Health
  { symbol: 'DRREDDY.NS', name: "Dr. Reddy's Laboratories", sector: 'Pharma' },
  { symbol: 'BIOCON.NS', name: 'Biocon', sector: 'Pharma' },

  // FMCG & Consumer
  { symbol: 'ITC.NS', name: 'ITC', sector: 'Tobacco' },
  { symbol: 'DABUR.NS', name: 'Dabur India', sector: 'Personal Care' },

  // Metals
  { symbol: 'NATIONALUM.NS', name: 'National Aluminium', sector: 'Metals' },

  // Transport & Service
  { symbol: 'INDIGO.NS', name: 'InterGlobe Aviation (IndiGo)', sector: 'Transport' },
  { symbol: 'ETERNAL.NS', name: 'Eternal (Zomato)', sector: 'Service' },
  { symbol: 'DELHIVERY.NS', name: 'Delhivery', sector: 'Service' },

  // Hospitality
  { symbol: 'INDHOTEL.NS', name: 'Indian Hotels (Taj)', sector: 'Hospitality' },

  // ETFs
  { symbol: 'NIFTYBEES.NS', name: 'Nippon India Nifty BeES', sector: 'ETF' },
  { symbol: 'GOLDBEES.NS', name: 'Nippon India Gold BeES', sector: 'ETF' },
] as const;

export type SupportedSymbol = typeof SUPPORTED_SECURITIES[number]['symbol'];

export type TimeRange = '1d' | '1w' | '1mo' | '3mo' | '6mo' | '1y';

export type SortField = 'name' | 'price' | 'dailyChangePercent' | 'volume';
export type SortDirection = 'asc' | 'desc';
