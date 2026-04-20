import { createContext, useContext, type ReactNode } from 'react';
import type { QuoteData, MarketStatus } from 'shared/types';
import { useStockPoller } from '../hooks/useStockPoller';

export interface PortfolioContextValue {
  quotes: Map<string, QuoteData>;
  marketStatus: MarketStatus | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  refreshAll: () => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { quotes, marketStatus, isConnected, lastUpdated, refresh } = useStockPoller();

  const value: PortfolioContextValue = {
    quotes,
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
