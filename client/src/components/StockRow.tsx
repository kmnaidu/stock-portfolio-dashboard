import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QuoteData } from 'shared/types';

/**
 * Pure function to determine price direction based on current price vs previous close.
 * Exported for property-based testing.
 */
export function getPriceDirection(
  currentPrice: number,
  previousClose: number
): 'up' | 'down' | 'neutral' {
  if (currentPrice > previousClose) return 'up';
  if (currentPrice < previousClose) return 'down';
  return 'neutral';
}

/** Format a number as Indian Rupees (₹ with en-IN locale) */
function formatINR(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format volume with compact notation */
function formatVolume(value: number): string {
  return value.toLocaleString('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
}

/** Format a percentage with sign */
function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** Format absolute change with sign */
function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + formatINR(value);
}

/** Format a timestamp for display */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

interface StockRowProps {
  quote: QuoteData;
}

export default function StockRow({ quote }: StockRowProps) {
  const navigate = useNavigate();
  const prevPriceRef = useRef<number>(quote.price);
  const [flashClass, setFlashClass] = useState('');

  const direction = getPriceDirection(quote.price, quote.previousClose);
  const directionClass = direction === 'up' ? 'price-up' : direction === 'down' ? 'price-down' : '';

  // Price flash animation: compare new price to previous render's price
  useEffect(() => {
    const prevPrice = prevPriceRef.current;
    if (quote.price > prevPrice) {
      setFlashClass('flash-green');
    } else if (quote.price < prevPrice) {
      setFlashClass('flash-red');
    }
    prevPriceRef.current = quote.price;

    const timer = setTimeout(() => setFlashClass(''), 600);
    return () => clearTimeout(timer);
  }, [quote.price]);

  const isUnavailable = quote.price === 0 && quote.volume === 0;

  if (isUnavailable) {
    return (
      <tr
        className="stock-row stock-row-unavailable"
        onClick={() => navigate(`/stock/${quote.symbol}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/stock/${quote.symbol}`)}
      >
        <td className="cell-name">{quote.shortName}</td>
        <td colSpan={6} className="cell-unavailable">Data Unavailable</td>
      </tr>
    );
  }

  return (
    <tr
      className={`stock-row ${flashClass}`}
      onClick={() => navigate(`/stock/${quote.symbol}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/stock/${quote.symbol}`)}
    >
      <td className="cell-name">
        <span className="stock-name">{quote.shortName}</span>
        <span className="stock-symbol">{quote.symbol.replace('.NS', '')}</span>
      </td>
      <td className={`cell-price ${directionClass}`}>{formatINR(quote.price)}</td>
      <td className={`cell-change ${directionClass}`}>{formatChange(quote.change)}</td>
      <td className={`cell-change-pct ${directionClass}`}>{formatPercent(quote.changePercent)}</td>
      <td className="cell-high">{formatINR(quote.dayHigh)}</td>
      <td className="cell-low">{formatINR(quote.dayLow)}</td>
      <td className="cell-volume">{formatVolume(quote.volume)}</td>
      <td className="cell-updated">{formatTimestamp(quote.lastUpdated)}</td>
    </tr>
  );
}
