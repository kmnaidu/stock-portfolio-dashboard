import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import StockRow from './StockRow';
import type { QuoteData, SortField, SortDirection } from 'shared/types';

/**
 * Pure sorting function for quotes.
 * Exported for property-based testing.
 */
export function sortQuotes(
  quotes: QuoteData[],
  field: SortField,
  direction: SortDirection
): QuoteData[] {
  const sorted = [...quotes];
  sorted.sort((a, b) => {
    let cmp: number;
    switch (field) {
      case 'name':
        cmp = a.shortName.localeCompare(b.shortName);
        break;
      case 'price':
        cmp = a.price - b.price;
        break;
      case 'dailyChangePercent':
        cmp = a.changePercent - b.changePercent;
        break;
      case 'volume':
        cmp = a.volume - b.volume;
        break;
      default:
        cmp = 0;
    }
    return direction === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

/** Column definitions for the stock grid */
const COLUMNS: { key: string; label: string; sortField?: SortField }[] = [
  { key: 'name', label: 'Name', sortField: 'name' },
  { key: 'price', label: 'Price', sortField: 'price' },
  { key: 'change', label: 'Change' },
  { key: 'changePct', label: 'Change %', sortField: 'dailyChangePercent' },
  { key: 'high', label: 'Day High' },
  { key: 'low', label: 'Day Low' },
  { key: 'volume', label: 'Volume', sortField: 'volume' },
  { key: 'updated', label: 'Last Updated' },
];

export default function StockGrid() {
  const { quotes } = usePortfolio();
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const quotesArray = Array.from(quotes.values());
  const sortedQuotes = sortQuotes(quotesArray, sortField, sortDirection);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (quotesArray.length === 0) {
    return (
      <div className="stock-grid-empty">
        <p>Loading securities…</p>
      </div>
    );
  }

  return (
    <div className="stock-grid-wrapper">
      <table className="stock-grid">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`grid-header ${col.sortField ? 'sortable' : ''} ${
                  col.sortField === sortField ? 'sorted' : ''
                }`}
                onClick={col.sortField ? () => handleSort(col.sortField!) : undefined}
              >
                {col.label}
                {col.sortField === sortField && (
                  <span className="sort-indicator">
                    {sortDirection === 'asc' ? ' ▲' : ' ▼'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedQuotes.map((quote) => (
            <StockRow key={quote.symbol} quote={quote} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
