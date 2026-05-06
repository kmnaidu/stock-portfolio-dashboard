import { useParams, Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import PriceHeader from '../components/StockDetail/PriceHeader';
import PriceChart from '../components/StockDetail/PriceChart';
import SupportResistancePanel from '../components/StockDetail/SupportResistancePanel';
import GrowthPotentialPanel from '../components/StockDetail/GrowthPotentialPanel';
import AnalystPanel from '../components/StockDetail/AnalystPanel';
import AIAnalysis from '../components/StockDetail/AIAnalysis';
import PredictionPanel from '../components/StockDetail/PredictionPanel';
import RecommendationList from '../components/StockDetail/RecommendationList';
import MetricsPanel from '../components/StockDetail/MetricsPanel';

// Accept any valid NSE/BSE symbol or index
const SYMBOL_PATTERN = /^(\^[A-Z]+|[A-Z0-9&\-_]+\.(NS|BO))$/i;

function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const { quotes } = usePortfolio();

  if (!symbol || !SYMBOL_PATTERN.test(symbol)) {
    return (
      <div className="stock-detail-page">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
        <div className="detail-error">
          Invalid security symbol format. Expected format: RELIANCE.NS, TCS.NS, etc.
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
          <AnalystPanel symbol={symbol} currentPrice={quote.price} />
          <AIAnalysis symbol={symbol} />
          <SupportResistancePanel symbol={symbol} />
          <GrowthPotentialPanel symbol={symbol} currentPrice={quote.price} />
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
