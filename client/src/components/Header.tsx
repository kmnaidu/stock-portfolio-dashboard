import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import WatchlistManager from './WatchlistManager';

function getISTTime(): string {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'open': return 'status-open';
    case 'closed': return 'status-closed';
    case 'pre-market':
    case 'post-market': return 'status-prepost';
    default: return 'status-closed';
  }
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'open': return 'Market Open';
    case 'closed': return 'Market Closed';
    case 'pre-market': return 'Pre-Market';
    case 'post-market': return 'Post-Market';
    default: return 'Unknown';
  }
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function Header() {
  const { marketStatus, isConnected, lastUpdated, refreshAll } = usePortfolio();
  const [istTime, setIstTime] = useState(getISTTime());
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  // Theme: light / dark, persisted in localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIstTime(getISTTime());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const status = marketStatus?.status ?? 'closed';
  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-title">
          <h1>📈 Stock Portfolio</h1>
        </Link>
        <div className="header-right">
          <span className={`market-status-badge ${getStatusColor(status)}`}>
            {formatStatusLabel(status)}
          </span>
          <span className="ist-clock">{istTime}</span>
          {lastUpdated && (
            <span className="last-updated">Updated {formatLastUpdated(lastUpdated)}</span>
          )}
          <button
            className="watchlist-btn"
            onClick={() => setWatchlistOpen(true)}
            title="Manage your watchlist"
          >
            ⭐ Watchlist
          </button>
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
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
      <WatchlistManager isOpen={watchlistOpen} onClose={() => setWatchlistOpen(false)} />
    </>
  );
}

export default Header;
