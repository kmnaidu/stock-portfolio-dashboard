import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';

function getISTTime(): string {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return 'status-open';
    case 'closed':
      return 'status-closed';
    case 'pre-market':
    case 'post-market':
      return 'status-prepost';
    default:
      return 'status-closed';
  }
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Market Open';
    case 'closed':
      return 'Market Closed';
    case 'pre-market':
      return 'Pre-Market';
    case 'post-market':
      return 'Post-Market';
    default:
      return 'Unknown';
  }
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function Header() {
  const { marketStatus, isConnected, lastUpdated, refreshAll } = usePortfolio();
  const [istTime, setIstTime] = useState(getISTTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setIstTime(getISTTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const status = marketStatus?.status ?? 'closed';

  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-title">
          <h1>Stock Portfolio Dashboard</h1>
        </Link>
        <div className="header-right">
          <span className={`market-status-badge ${getStatusColor(status)}`}>
            {formatStatusLabel(status)}
          </span>
          <span className="ist-clock">{istTime} IST</span>
          {lastUpdated && (
            <span className="last-updated">Updated: {formatLastUpdated(lastUpdated)} IST</span>
          )}
          <button className="refresh-btn" onClick={refreshAll} title="Refresh all data">
            🔄
          </button>
        </div>
      </header>
      {!isConnected && (
        <div className="connection-lost-banner">
          ⚠ Connection Lost — Displaying stale data
        </div>
      )}
    </>
  );
}

export default Header;
