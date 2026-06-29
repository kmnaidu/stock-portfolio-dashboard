import { useEffect, useState, useCallback, useRef } from 'react';
import type { VWAPResult, MarketStatus } from 'shared/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// VWAP refreshes much slower than quotes — Yahoo intraday is ~15 min delayed
// During market hours: every 5 min. Outside: every 30 min.
const POLL_INTERVAL_OPEN_MS = 5 * 60 * 1000;
const POLL_INTERVAL_CLOSED_MS = 30 * 60 * 1000;

/**
 * Polls the /api/vwap endpoint for a list of symbols.
 * Returns a Map keyed by symbol → VWAPResult.
 *
 * Decoupled from quote polling because:
 *   - VWAP fetches are heavier (one Yahoo call per symbol)
 *   - VWAP changes slowly (5-min bars, 15-min delay)
 *   - Quotes refresh every 15 s; VWAP every 5 min is plenty
 */
export function useVWAPPoller(
  symbols: string[],
  marketStatus: MarketStatus['status'] | null,
): { vwap: Map<string, VWAPResult> } {
  const [vwap, setVwap] = useState<Map<string, VWAPResult>>(new Map());
  const symbolsKey = symbols.join(',');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVWAP = useCallback(async () => {
    if (symbolsKey.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/vwap?symbols=${encodeURIComponent(symbolsKey)}`);
      if (!res.ok) return;
      const json = (await res.json()) as { results: Record<string, VWAPResult | null> };
      const next = new Map<string, VWAPResult>();
      for (const [sym, r] of Object.entries(json.results)) {
        if (r) next.set(sym, r);
      }
      setVwap(next);
    } catch {
      // Silent failure — VWAP is supplementary data
    }
  }, [symbolsKey]);

  // Initial fetch on mount or symbols change
  useEffect(() => {
    fetchVWAP();
  }, [fetchVWAP]);

  // Interval polling, adjusted by market status
  useEffect(() => {
    const interval =
      marketStatus === 'open' || marketStatus === 'pre-market' || marketStatus === 'post-market'
        ? POLL_INTERVAL_OPEN_MS
        : POLL_INTERVAL_CLOSED_MS;

    intervalRef.current = setInterval(fetchVWAP, interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchVWAP, marketStatus]);

  return { vwap };
}
