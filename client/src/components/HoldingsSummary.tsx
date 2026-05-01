import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWatchlist } from '../context/WatchlistContext';
import { usePortfolio } from '../context/PortfolioContext';
import HoldingsModal from './HoldingsModal';

function formatINR(v: number): string {
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function HoldingsSummary() {
  const { items } = useWatchlist();
  const { quotes } = usePortfolio();
  const navigate = useNavigate();

  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);

  // Filter items that have actual holdings (quantity > 0 and avgBuyPrice > 0)
  const holdings = items.filter(
    (item) => (item.quantity ?? 0) > 0 && (item.avgBuyPrice ?? 0) > 0
  );

  if (holdings.length === 0) {
    return (
      <div className="holdings-summary">
        <div className="hs-header">
          <h3 className="hs-title">💼 My Portfolio Holdings</h3>
        </div>
        <div className="hs-empty">
          You haven't added any holdings yet. Click the <strong>"Holdings"</strong> button on any stock row below
          to track your actual investments with real-time P&L.
        </div>
      </div>
    );
  }

  // Compute per-holding and total stats
  let totalInvested = 0;
  let totalCurrentValue = 0;
  const rows = holdings.map((item) => {
    const quote = quotes.get(item.symbol);
    const currentPrice = quote?.price ?? 0;
    const qty = item.quantity!;
    const avgBuy = item.avgBuyPrice!;
    const invested = qty * avgBuy;
    const current = qty * currentPrice;
    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    totalInvested += invested;
    totalCurrentValue += current;

    return {
      ...item,
      currentPrice,
      qty,
      avgBuy,
      invested,
      current,
      pnl,
      pnlPct,
    };
  });

  const totalPnl = totalCurrentValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const isOverallGain = totalPnl >= 0;

  return (
    <>
      <div className="holdings-summary">
        <div className="hs-header">
          <h3 className="hs-title">💼 My Portfolio Holdings ({holdings.length})</h3>
        </div>

        {/* Aggregate stats */}
        <div className="hs-stats">
          <div className="hs-stat">
            <span className="hs-stat-label">Total Invested</span>
            <span className="hs-stat-value">{formatINR(totalInvested)}</span>
          </div>
          <div className="hs-stat">
            <span className="hs-stat-label">Current Value</span>
            <span className="hs-stat-value">{formatINR(totalCurrentValue)}</span>
          </div>
          <div className="hs-stat">
            <span className="hs-stat-label">Total P&L</span>
            <span className={`hs-stat-value ${isOverallGain ? 'hs-gain' : 'hs-loss'}`}>
              {isOverallGain ? '+' : ''}{formatINR(totalPnl)}
            </span>
          </div>
          <div className="hs-stat">
            <span className="hs-stat-label">Overall Return</span>
            <span className={`hs-stat-value ${isOverallGain ? 'hs-gain' : 'hs-loss'}`}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Per-holding rows */}
        <div className="hs-holdings-list">
          {rows
            .sort((a, b) => b.pnl - a.pnl)
            .map((row) => {
              const isGain = row.pnl >= 0;
              return (
                <div
                  key={row.symbol}
                  className="hs-holding-row"
                  onClick={() => navigate(`/stock/${row.symbol}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/stock/${row.symbol}`)}
                >
                  <div className="hs-holding-name">
                    <span className="hs-name-primary">{row.name}</span>
                    <span className="hs-name-secondary">
                      {row.qty} shares @ {formatINR(row.avgBuy)}
                    </span>
                  </div>
                  <div className="hs-qty">
                    <span className="hs-name-secondary">LTP</span><br />
                    {formatINR(row.currentPrice)}
                  </div>
                  <div className="hs-invested">
                    <span className="hs-name-secondary">Invested</span><br />
                    {formatINR(row.invested)}
                  </div>
                  <div className="hs-current">
                    <span className="hs-name-secondary">Current</span><br />
                    {formatINR(row.current)}
                  </div>
                  <div className={`hs-pnl ${isGain ? 'hs-gain' : 'hs-loss'}`}>
                    {isGain ? '+' : ''}{formatINR(row.pnl)}
                    <span className="hs-pnl-pct">
                      {row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {editingSymbol && (() => {
        const item = items.find((i) => i.symbol === editingSymbol);
        const quote = quotes.get(editingSymbol);
        if (!item) return null;
        return (
          <HoldingsModal
            symbol={item.symbol}
            name={item.name}
            currentPrice={quote?.price ?? 0}
            isOpen={true}
            onClose={() => setEditingSymbol(null)}
          />
        );
      })()}
    </>
  );
}
