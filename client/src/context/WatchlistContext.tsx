import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { SUPPORTED_SECURITIES } from 'shared/types';

const STORAGE_KEY = 'user-watchlist';

export interface WatchlistItem {
  symbol: string;
  name: string;
  sector: string;
  addedAt: string;
  // Portfolio holdings (optional — null means watch-only, no holdings)
  quantity?: number;
  avgBuyPrice?: number;
}

export interface WatchlistContextValue {
  items: WatchlistItem[];
  symbols: string[];
  addStock: (symbol: string, name: string, sector?: string) => void;
  removeStock: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
  updateHolding: (symbol: string, quantity: number | undefined, avgBuyPrice: number | undefined) => void;
  getHolding: (symbol: string) => { quantity?: number; avgBuyPrice?: number } | undefined;
  resetToDefault: () => void;
  exportJSON: () => string;
  importJSON: (json: string) => boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

function getDefaultWatchlist(): WatchlistItem[] {
  return SUPPORTED_SECURITIES.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    sector: s.sector,
    addedAt: new Date().toISOString(),
  }));
}

function loadFromStorage(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultWatchlist();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultWatchlist();
    return parsed.filter((item) =>
      typeof item === 'object' &&
      typeof item.symbol === 'string' &&
      typeof item.name === 'string'
    );
  } catch {
    return getDefaultWatchlist();
  }
}

function saveToStorage(items: WatchlistItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>(loadFromStorage);

  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  const addStock = useCallback((symbol: string, name: string, sector: string = 'Other') => {
    setItems((prev) => {
      if (prev.some((item) => item.symbol === symbol)) return prev;
      return [
        ...prev,
        { symbol, name, sector, addedAt: new Date().toISOString() },
      ];
    });
  }, []);

  const removeStock = useCallback((symbol: string) => {
    setItems((prev) => prev.filter((item) => item.symbol !== symbol));
  }, []);

  const isInWatchlist = useCallback((symbol: string) => {
    return items.some((item) => item.symbol === symbol);
  }, [items]);

  const updateHolding = useCallback((symbol: string, quantity: number | undefined, avgBuyPrice: number | undefined) => {
    setItems((prev) =>
      prev.map((item) =>
        item.symbol === symbol
          ? { ...item, quantity, avgBuyPrice }
          : item
      )
    );
  }, []);

  const getHolding = useCallback((symbol: string) => {
    const item = items.find((i) => i.symbol === symbol);
    if (!item) return undefined;
    return { quantity: item.quantity, avgBuyPrice: item.avgBuyPrice };
  }, [items]);

  const resetToDefault = useCallback(() => {
    setItems(getDefaultWatchlist());
  }, []);

  const exportJSON = useCallback(() => JSON.stringify(items, null, 2), [items]);

  const importJSON = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return false;
      const valid = parsed.filter((item) =>
        typeof item === 'object' &&
        typeof item.symbol === 'string' &&
        typeof item.name === 'string'
      );
      if (valid.length === 0) return false;
      setItems(valid);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value: WatchlistContextValue = {
    items,
    symbols: items.map((item) => item.symbol),
    addStock,
    removeStock,
    isInWatchlist,
    updateHolding,
    getHolding,
    resetToDefault,
    exportJSON,
    importJSON,
  };

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error('useWatchlist must be used within a WatchlistProvider');
  return context;
}
