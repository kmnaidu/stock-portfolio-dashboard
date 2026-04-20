import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PortfolioProvider } from './context/PortfolioContext';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import StockDetailPage from './pages/StockDetailPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <PortfolioProvider>
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/stock/:symbol" element={<StockDetailPage />} />
          </Routes>
        </main>
      </PortfolioProvider>
    </BrowserRouter>
  );
}

export default App;
