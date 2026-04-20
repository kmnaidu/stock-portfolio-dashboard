import { useParams, Link } from 'react-router-dom';
import { SUPPORTED_SECURITIES } from 'shared/types';
import { usePortfolio } from '../context/PortfolioContext';
import PriceHeader from '../components/StockDetail/PriceHeader';
import PriceChart from '../components/StockDetail/PriceChart';
import PredictionPanel from '../components/StockDetail/PredictionPanel';
import RecommendationList from '../components/StockDetail/RecommendationList';
import MetricsPanel from '../components/StockDetail/MetricsPanel';

const validSymbols = new Set(SUPPORTED_SECURITIES.map((s) => s.symbol));

function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const { quotes } = usePortfolio();

  if (!symbol || !validSymbols.has(symbol as any)) {
    return (
      <div className="stock-detail-page">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
        <div className="detail-error">
          Invalid security symbol. Please select a valid security from the dashboard.
        </div>
      </div>
    );
  }

  const quote = quotes.get(symbol);

  return (
    <div className="stock-detail-page">
      <Link to="/" className="back-link">← Back to Dashboard</Link>

      {!quote ? (
        <div className="detail-loading">Loading quote data…</div>
      ) : (
        <>
          <PriceHeader quote={quote} />
          <PriceChart symbol={symbol} />
          <PredictionPanel symbol={symbol} currentPrice={quote.price} />
          <RecommendationList symbol={symbol} />
          <MetricsPanel symbol={symbol} />
        </>
      )}
    </div>
  );
}

export default StockDetailPage;
