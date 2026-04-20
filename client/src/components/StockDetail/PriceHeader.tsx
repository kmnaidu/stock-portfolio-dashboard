import type { QuoteData } from 'shared/types';
import { getPriceDirection } from '../StockRow';

/** Format a number as Indian Rupees (₹ with en-IN locale) */
function formatINR(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format absolute change with sign */
function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + formatINR(value);
}

/** Format a percentage with sign */
function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

interface PriceHeaderProps {
  quote: QuoteData;
}

export default function PriceHeader({ quote }: PriceHeaderProps) {
  const direction = getPriceDirection(quote.price, quote.previousClose);
  const directionClass =
    direction === 'up' ? 'price-up' : direction === 'down' ? 'price-down' : '';

  const isClosed = quote.marketState === 'CLOSED';

  return (
    <div className="price-header">
      <h2 className="price-header-name">{quote.shortName}</h2>

      <div className="price-header-row">
        <span className={`price-header-price ${directionClass}`}>
          {formatINR(quote.price)}
        </span>

        <span className={`price-header-change ${directionClass}`}>
          {formatChange(quote.change)}
        </span>

        <span className={`price-header-change-pct ${directionClass}`}>
          ({formatPercent(quote.changePercent)})
        </span>
      </div>

      {isClosed && (
        <p className="price-header-closed-label">
          Market Closed — Last closing price
        </p>
      )}
    </div>
  );
}
