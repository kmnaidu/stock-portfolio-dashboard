import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStockPoller, getPollingInterval } from './useStockPoller';
import { WatchlistProvider } from '../context/WatchlistContext';
import type { QuoteData } from 'shared/types';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <WatchlistProvider>{children}</WatchlistProvider>;
}

const mockQuote: QuoteData = {
  symbol: 'RELIANCE.NS',
  shortName: 'Reliance Industries',
  price: 2500,
  previousClose: 2480,
  change: 20,
  changePercent: 0.81,
  dayHigh: 2520,
  dayLow: 2470,
  volume: 1000000,
  marketState: 'REGULAR',
  lastUpdated: new Date().toISOString(),
};

function createFetchResponse(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status }));
}

describe('useStockPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches quotes on mount and populates the map', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/api/quotes')) {
        return createFetchResponse([mockQuote]);
      }
      if (url.includes('/api/market-status')) {
        return createFetchResponse({ status: 'open', currentTimeIST: '10:00 AM' });
      }
      return createFetchResponse({}, 404);
    });

    const { result } = renderHook(() => useStockPoller(), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.quotes.size).toBe(1);
    expect(result.current.quotes.get('RELIANCE.NS')).toEqual(mockQuote);
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
    expect(result.current.error).toBeNull();
  });

  it('sets isConnected to false after 3 consecutive failures', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/api/market-status')) {
        return createFetchResponse({ status: 'open', currentTimeIST: '10:00 AM' });
      }
      return Promise.reject(new Error('Network error'));
    });

    const { result } = renderHook(() => useStockPoller(), { wrapper });

    // Failure 1 (mount)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.isConnected).toBe(true); // only 1 failure so far

    // Failure 2 (first poll)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(result.current.isConnected).toBe(true); // 2 failures

    // Failure 3 (second poll)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(result.current.isConnected).toBe(false); // 3 failures → disconnected
  });

  it('calls refresh and re-fetches data', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/api/quotes')) {
        return createFetchResponse([mockQuote]);
      }
      if (url.includes('/api/market-status')) {
        return createFetchResponse({ status: 'open', currentTimeIST: '10:00 AM' });
      }
      return createFetchResponse({}, 404);
    });

    const { result } = renderHook(() => useStockPoller(), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const callsBefore = fetchMock.mock.calls.length;

    await act(async () => {
      result.current.refresh();
      await vi.advanceTimersByTimeAsync(10);
    });

    // refresh triggers both fetchQuotes and fetchMarketStatus
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe('getPollingInterval', () => {
  it('returns 15s for open market', () => {
    expect(getPollingInterval('open')).toBe(15_000);
  });

  it('returns 15s for pre-market', () => {
    expect(getPollingInterval('pre-market')).toBe(15_000);
  });

  it('returns 15s for post-market', () => {
    expect(getPollingInterval('post-market')).toBe(15_000);
  });

  it('returns 60s for closed market', () => {
    expect(getPollingInterval('closed')).toBe(60_000);
  });

  it('returns 60s when status is null (unknown)', () => {
    expect(getPollingInterval(null)).toBe(60_000);
  });
});
