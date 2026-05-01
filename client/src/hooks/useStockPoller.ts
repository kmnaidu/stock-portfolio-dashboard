import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { QuoteData, MarketStatus } from 'shared/types';
import { useWatchlist } from '../context/WatchlistContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const POLL_INTERVAL_OPEN_MS = 15_000;
const POLL_INTERVAL_CLOSED_MS = 60_000;
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Returns the appropriate polling interval based on market status.
 * 15s when market is open/pre-market/post-market, 60s when closed or unknown.
 */
export function getPollingInterval(status: MarketStatus['status'] | null): number {
  if (status === 'open' || status === 'pre-market' || status === 'post-market') {
    return POLL_INTERVAL_OPEN_MS;
  }
  return POLL_INTERVAL_CLOSED_MS;
}

interface UseStockPollerResult {
  quotes: Map<string, QuoteData>;
  marketStatus: MarketStatus | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isConnected: boolean;
  refresh: () => void;
}

export function useStockPoller(): UseStockPollerResult {
  const { symbols } = useWatchlist();
  const [quotes, setQuotes] = useState<Map<string, QuoteData>>(new Map());
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(navigator.onLine);

  const consecutiveFailures = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep a stable key for the symbols list so memoized fetchQuotes updates when watchlist changes
  const symbolsKey = symbols.join(',');

  const pollInterval = useMemo(
    () => getPollingInterval(marketStatus?.status ?? null),
    [marketStatus?.status]
  );

  const fetchQuotes = useCallback(async () => {
    if (symbolsKey.length === 0) {
      setQuotes(new Map());
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/quotes?symbols=${encodeURIComponent(symbolsKey)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: QuoteData[] = await response.json();

      const newQuotes = new Map<string, QuoteData>();
      for (const quote of data) {
        newQuotes.set(quote.symbol, quote);
      }

      setQuotes(newQuotes);
      setLastUpdated(new Date());
      setError(null);
      consecutiveFailures.current = 0;

      if (!isConnected) {
        setIsConnected(true);
      }
    } catch (err) {
      consecutiveFailures.current += 1;
      setError(err instanceof Error ? err.message : 'Failed to fetch quotes');

      if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) {
        setIsConnected(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, symbolsKey]);

  const fetchMarketStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/market-status`);
      if (!response.ok) return;
      const data: MarketStatus = await response.json();
      setMarketStatus(data);
    } catch {
      // Market status fetch failures are non-critical
    }
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchQuotes();
    fetchMarketStatus();
  }, [fetchQuotes, fetchMarketStatus]);

  // Initial fetch
  useEffect(() => {
    fetchQuotes();
    fetchMarketStatus();
  }, [fetchQuotes, fetchMarketStatus]);

  // Polling interval — dynamically adjusts based on market status
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchQuotes();
    }, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchQuotes, pollInterval]);

  // Market status polling (every 30s)
  useEffect(() => {
    const id = setInterval(fetchMarketStatus, 30_000);
    return () => clearInterval(id);
  }, [fetchMarketStatus]);

  // Online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsConnected(true);
      consecutiveFailures.current = 0;
      // Force immediate refresh on reconnection
      fetchQuotes();
      fetchMarketStatus();
    };

    const handleOffline = () => {
      setIsConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchQuotes, fetchMarketStatus]);

  return { quotes, marketStatus, isLoading, error, lastUpdated, isConnected, refresh };
}
