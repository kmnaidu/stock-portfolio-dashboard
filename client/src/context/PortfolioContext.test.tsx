import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PortfolioProvider, usePortfolio } from './PortfolioContext';
import { WatchlistProvider } from './WatchlistContext';
import type { ReactNode } from 'react';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
  new Response(JSON.stringify([]), { status: 200 })
));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <WatchlistProvider>
      <PortfolioProvider>{children}</PortfolioProvider>
    </WatchlistProvider>
  );
}

describe('PortfolioContext', () => {
  it('provides context values when used within PortfolioProvider', () => {
    const { result } = renderHook(() => usePortfolio(), { wrapper });

    expect(result.current.quotes).toBeInstanceOf(Map);
    expect(result.current.isConnected).toBe(true);
    expect(typeof result.current.refreshAll).toBe('function');
  });

  it('throws when usePortfolio is used outside PortfolioProvider', () => {
    expect(() => {
      renderHook(() => usePortfolio());
    }).toThrow('usePortfolio must be used within a PortfolioProvider');
  });
});
