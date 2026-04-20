import PortfolioSummary from '../components/PortfolioSummary';
import StockGrid from '../components/StockGrid';

function DashboardPage() {
  return (
    <div className="dashboard-page">
      <PortfolioSummary />
      <StockGrid />
    </div>
  );
}

export default DashboardPage;
