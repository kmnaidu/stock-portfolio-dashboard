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
  { key: 'actions', label: '' },
];

export default function StockGrid() {
  const { quotes } = usePortfolio();
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAll, setShowAll] = useState(false);

  const INITIAL_COUNT = 10;

  // Priority stocks always shown first in the initial view
  const PRIORITY_SYMBOLS = [
    'RELIANCE.NS', 'HDFCBANK.NS', 'SBIN.NS', 'HAL.NS', 'ICICIBANK.NS',
    'DABUR.NS', 'TVSMOTOR.NS', 'TATAMOTORS.NS', 'BHARTIARTL.NS', 'INDHOTEL.NS',
  ];

  const quotesArray = Array.from(quotes.values());
  const sortedQuotes = sortQuotes(quotesArray, sortField, sortDirection);

  // When collapsed, show priority stocks first, then fill remaining slots
  let visibleQuotes: QuoteData[];
  if (showAll) {
    visibleQuotes = sortedQuotes;
  } else {
    const priorityQuotes = PRIORITY_SYMBOLS
      .map(sym => sortedQuotes.find(q => q.symbol === sym))
      .filter((q): q is QuoteData => q !== undefined);
    const remaining = sortedQuotes.filter(q => !PRIORITY_SYMBOLS.includes(q.symbol));
    const fillCount = Math.max(0, INITIAL_COUNT - priorityQuotes.length);
    visibleQuotes = [...priorityQuotes, ...remaining.slice(0, fillCount)];
  }
  const hasMore = sortedQuotes.length > INITIAL_COUNT;

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
          {visibleQuotes.map((quote) => (
            <StockRow key={quote.symbol} quote={quote} />
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button
          className="stock-grid-toggle"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? `Show Less ▲`
            : `Show All ${sortedQuotes.length} Stocks ▼`}
        </button>
      )}
    </div>
  );
}
