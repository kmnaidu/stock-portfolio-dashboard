import PortfolioSummary from '../components/PortfolioSummary';
import MarketPulse from '../components/MarketPulse';
import HoldingsSummary from '../components/HoldingsSummary';
import TopPicks from '../components/TopPicks';
import StockGrid from '../components/StockGrid';

function DashboardPage() {
  return (
    <div className="dashboard-page">
      <MarketPulse />
      <HoldingsSummary />
      <PortfolioSummary />
      <TopPicks />
      <StockGrid />
    </div>
  );
}

export default DashboardPage;
