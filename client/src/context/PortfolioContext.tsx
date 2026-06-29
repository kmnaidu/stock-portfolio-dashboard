import { createContext, useContext, type ReactNode } from 'react';
import type { QuoteData, MarketStatus, VWAPResult } from 'shared/types';
import { useStockPoller } from '../hooks/useStockPoller';
import { useVWAPPoller } from '../hooks/useVWAPPoller';
import { useWatchlist } from './WatchlistContext';

export interface PortfolioContextValue {
  quotes: Map<string, QuoteData>;
  vwap: Map<string, VWAPResult>;
  marketStatus: MarketStatus | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  refreshAll: () => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { quotes, marketStatus, isConnected, lastUpdated, refresh } = useStockPoller();
  const { symbols } = useWatchlist();
  const { vwap } = useVWAPPoller(symbols, marketStatus?.status ?? null);

  const value: PortfolioContextValue = {
    quotes,
    vwap,
    marketStatus,
    isConnected,
    lastUpdated,
    refreshAll: refresh,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio(): PortfolioContextValue {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
