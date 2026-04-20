import { usePortfolio } from '../context/PortfolioContext';
import type { QuoteData, PortfolioSummary as PortfolioSummaryType } from 'shared/types';

/**
 * Pure computation function for portfolio summary metrics.
 * Exported for independent property-based testing.
 */
export function computePortfolioSummary(quotes: QuoteData[]): PortfolioSummaryType {
  const totalValue = quotes.reduce((sum, q) => sum + q.price, 0);
  const totalDailyChange = quotes.reduce((sum, q) => sum + q.change, 0);
  const previousTotal = totalValue - totalDailyChange;
  const totalDailyChangePercent =
    previousTotal !== 0 ? (totalDailyChange / previousTotal) * 100 : 0;

  return {
    totalValue,
    totalDailyChange,
    totalDailyChangePercent,
    securitiesCount: quotes.length,
    lastUpdated: new Date().toISOString(),
  };
}

/** Format a number as Indian Rupees with locale grouping (e.g. ₹1,23,456.78) */
function formatINR(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format a percentage with sign and 2 decimal places */
function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** Format an absolute change with sign */
function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + formatINR(value);
}

export default function PortfolioSummaryCard() {
  const { quotes } = usePortfolio();
  const quotesArray = Array.from(quotes.values());

  if (quotesArray.length === 0) {
    return null;
  }

  const summary = computePortfolioSummary(quotesArray);
  const isGain = summary.totalDailyChange >= 0;
  const colorClass = isGain ? 'gain' : 'loss';

  return (
    <div className="portfolio-summary-card">
      <div className="summary-metric">
        <span className="summary-label">Portfolio Value</span>
        <span className="summary-value">{formatINR(summary.totalValue)}</span>
      </div>
      <div className="summary-metric">
        <span className="summary-label">Daily Change</span>
        <span className={`summary-value ${colorClass}`}>{formatChange(summary.totalDailyChange)}</span>
      </div>
      <div className="summary-metric">
        <span className="summary-label">Daily Change %</span>
        <span className={`summary-value ${colorClass}`}>{formatPercent(summary.totalDailyChangePercent)}</span>
      </div>
      <div className="summary-metric">
        <span className="summary-label">Securities</span>
        <span className="summary-value">{summary.securitiesCount}</span>
      </div>
    </div>
  );
}
