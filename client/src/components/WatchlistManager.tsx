import { useState, useEffect, useRef } from 'react';
import { useWatchlist } from '../context/WatchlistContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/** Popular NSE stocks for autocomplete suggestions. */
const POPULAR_STOCKS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Petroleum' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services', sector: 'IT' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Banking' },
  { symbol: 'INFY.NS', name: 'Infosys', sector: 'IT' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Banking' },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', sector: 'FMCG' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Banking' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecom' },
  { symbol: 'ITC.NS', name: 'ITC', sector: 'FMCG' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro', sector: 'Construction' },
  { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', sector: 'Banking' },
  { symbol: 'AXISBANK.NS', name: 'Axis Bank', sector: 'Banking' },
  { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', sector: 'Finance' },
  { symbol: 'ASIANPAINT.NS', name: 'Asian Paints', sector: 'Paints' },
  { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', sector: 'Auto' },
  { symbol: 'HCLTECH.NS', name: 'HCL Technologies', sector: 'IT' },
  { symbol: 'WIPRO.NS', name: 'Wipro', sector: 'IT' },
  { symbol: 'TECHM.NS', name: 'Tech Mahindra', sector: 'IT' },
  { symbol: 'ULTRACEMCO.NS', name: 'UltraTech Cement', sector: 'Cement' },
  { symbol: 'NESTLEIND.NS', name: 'Nestle India', sector: 'FMCG' },
  { symbol: 'POWERGRID.NS', name: 'Power Grid Corp', sector: 'Power' },
  { symbol: 'NTPC.NS', name: 'NTPC', sector: 'Power' },
  { symbol: 'ADANIPORTS.NS', name: 'Adani Ports', sector: 'Transport' },
  { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', sector: 'Diversified' },
  { symbol: 'ADANIPOWER.NS', name: 'Adani Power', sector: 'Power' },
  { symbol: 'TATAPOWER.NS', name: 'Tata Power', sector: 'Power' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', sector: 'Auto' },
  { symbol: 'TATASTEEL.NS', name: 'Tata Steel', sector: 'Metals' },
  { symbol: 'JSWSTEEL.NS', name: 'JSW Steel', sector: 'Metals' },
  { symbol: 'COALINDIA.NS', name: 'Coal India', sector: 'Mining' },
  { symbol: 'ONGC.NS', name: 'ONGC', sector: 'Oil & Gas' },
  { symbol: 'IOC.NS', name: 'Indian Oil', sector: 'Oil & Gas' },
  { symbol: 'BPCL.NS', name: 'BPCL', sector: 'Oil & Gas' },
  { symbol: 'HAL.NS', name: 'Hindustan Aeronautics', sector: 'Defence' },
  { symbol: 'BEL.NS', name: 'Bharat Electronics', sector: 'Defence' },
  { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', sector: 'Auto' },
  { symbol: 'TVSMOTOR.NS', name: 'TVS Motor', sector: 'Auto' },
  { symbol: 'BAJAJ-AUTO.NS', name: 'Bajaj Auto', sector: 'Auto' },
  { symbol: 'HEROMOTOCO.NS', name: 'Hero MotoCorp', sector: 'Auto' },
  { symbol: 'EICHERMOT.NS', name: 'Eicher Motors', sector: 'Auto' },
  { symbol: 'DRREDDY.NS', name: "Dr. Reddy's Laboratories", sector: 'Pharma' },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', sector: 'Pharma' },
  { symbol: 'CIPLA.NS', name: 'Cipla', sector: 'Pharma' },
  { symbol: 'DIVISLAB.NS', name: 'Divi\'s Laboratories', sector: 'Pharma' },
  { symbol: 'APOLLOHOSP.NS', name: 'Apollo Hospitals', sector: 'Healthcare' },
  { symbol: 'BIOCON.NS', name: 'Biocon', sector: 'Pharma' },
  { symbol: 'TITAN.NS', name: 'Titan Company', sector: 'Consumer Durables' },
  { symbol: 'DMART.NS', name: 'Avenue Supermarts (DMart)', sector: 'Retail' },
  { symbol: 'INDHOTEL.NS', name: 'Indian Hotels (Taj)', sector: 'Hospitality' },
  { symbol: 'INDIGO.NS', name: 'InterGlobe Aviation', sector: 'Transport' },
  { symbol: 'ZOMATO.NS', name: 'Zomato', sector: 'Service' },
  { symbol: 'ETERNAL.NS', name: 'Eternal (Zomato)', sector: 'Service' },
  { symbol: 'PAYTM.NS', name: 'One 97 Communications (Paytm)', sector: 'Fintech' },
  { symbol: 'NYKAA.NS', name: 'FSN E-Commerce (Nykaa)', sector: 'Retail' },
  { symbol: 'DABUR.NS', name: 'Dabur India', sector: 'FMCG' },
  { symbol: 'BRITANNIA.NS', name: 'Britannia Industries', sector: 'FMCG' },
  { symbol: 'MARICO.NS', name: 'Marico', sector: 'FMCG' },
  { symbol: 'GODREJCP.NS', name: 'Godrej Consumer Products', sector: 'FMCG' },
  { symbol: 'CUB.NS', name: 'City Union Bank', sector: 'Banking' },
  { symbol: 'PNB.NS', name: 'Punjab National Bank', sector: 'Banking' },
  { symbol: 'BANKBARODA.NS', name: 'Bank of Baroda', sector: 'Banking' },
  { symbol: 'INDUSINDBK.NS', name: 'IndusInd Bank', sector: 'Banking' },
  { symbol: 'DELHIVERY.NS', name: 'Delhivery', sector: 'Logistics' },
  { symbol: 'IRCTC.NS', name: 'Indian Railway Catering', sector: 'Travel' },
  { symbol: 'NATIONALUM.NS', name: 'National Aluminium', sector: 'Metals' },
  { symbol: 'KPITTECH.NS', name: 'KPIT Technologies', sector: 'IT' },
  { symbol: 'NIFTYBEES.NS', name: 'Nippon India Nifty BeES', sector: 'ETF' },
  { symbol: 'GOLDBEES.NS', name: 'Nippon India Gold BeES', sector: 'ETF' },
  { symbol: 'SILVERBEES.NS', name: 'Nippon India Silver BeES', sector: 'ETF' },
  { symbol: 'JUNIORBEES.NS', name: 'Nippon India Junior BeES', sector: 'ETF' },
  { symbol: 'PHARMABEES.NS', name: 'Nippon India Pharma BeES', sector: 'ETF' },
  { symbol: 'ITBEES.NS', name: 'Nippon India IT BeES', sector: 'ETF' },
  { symbol: 'BANKBEES.NS', name: 'Nippon India Bank BeES', sector: 'ETF' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function WatchlistManager({ isOpen, onClose }: Props) {
  const { items, addStock, removeStock, isInWatchlist, resetToDefault } = useWatchlist();
  const [searchQuery, setSearchQuery] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Filter popular stocks based on search
  const suggestions = POPULAR_STOCKS.filter((stock) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (
      stock.symbol.toLowerCase().includes(q) ||
      stock.name.toLowerCase().includes(q) ||
      stock.sector.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Clear state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setCustomSymbol('');
      setMessage(null);
    }
  }, [isOpen]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddSuggestion = (stock: typeof POPULAR_STOCKS[number]) => {
    if (isInWatchlist(stock.symbol)) {
      showMessage(`${stock.name} is already in your watchlist`, 'error');
      return;
    }
    addStock(stock.symbol, stock.name, stock.sector);
    showMessage(`✓ Added ${stock.name}`, 'success');
    setSearchQuery('');
  };

  const handleAddCustom = async () => {
    if (!customSymbol.trim()) return;

    let symbol = customSymbol.trim().toUpperCase();
    // Auto-append .NS if no exchange suffix
    if (!symbol.includes('.') && !symbol.startsWith('^')) {
      symbol = `${symbol}.NS`;
    }

    if (isInWatchlist(symbol)) {
      showMessage('Already in watchlist', 'error');
      return;
    }

    setValidating(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/validate-symbol/${encodeURIComponent(symbol)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showMessage(err.message || `Symbol ${symbol} not found`, 'error');
        setValidating(false);
        return;
      }
      const data = await res.json();
      if (!data.valid) {
        showMessage(`${symbol} could not be validated`, 'error');
        setValidating(false);
        return;
      }
      addStock(data.symbol, data.name, 'Other');
      showMessage(`✓ Added ${data.name}`, 'success');
      setCustomSymbol('');
    } catch {
      showMessage(`Failed to validate ${symbol}`, 'error');
    } finally {
      setValidating(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset watchlist to the default 32 stocks? Your current custom list will be replaced.')) {
      resetToDefault();
      showMessage('Watchlist reset to default', 'success');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wm-overlay" onClick={onClose}>
      <div className="wm-dialog" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="wm-header">
          <h2 className="wm-title">Manage Watchlist</h2>
          <button className="wm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {message && (
          <div className={`wm-message wm-message-${message.type}`}>{message.text}</div>
        )}

        {/* Add Custom Symbol */}
        <div className="wm-section">
          <label className="wm-label">Add by NSE/BSE Symbol</label>
          <div className="wm-input-row">
            <input
              type="text"
              className="wm-input"
              placeholder="e.g., TCS or TCS.NS"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
              disabled={validating}
            />
            <button
              className="wm-btn wm-btn-primary"
              onClick={handleAddCustom}
              disabled={validating || !customSymbol.trim()}
            >
              {validating ? 'Checking…' : 'Add'}
            </button>
          </div>
          <p className="wm-hint">Tip: .NS is added automatically for NSE stocks. Use .BO for BSE.</p>
        </div>

        {/* Search Popular Stocks */}
        <div className="wm-section">
          <label className="wm-label">Search Popular Stocks</label>
          <input
            type="text"
            className="wm-input"
            placeholder="Search by name or sector (e.g., Banking, TCS, Pharma)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {suggestions.length > 0 && (
            <div className="wm-suggestions">
              {suggestions.map((stock) => {
                const alreadyAdded = isInWatchlist(stock.symbol);
                return (
                  <div
                    key={stock.symbol}
                    className={`wm-suggestion ${alreadyAdded ? 'wm-suggestion-added' : ''}`}
                    onClick={() => !alreadyAdded && handleAddSuggestion(stock)}
                  >
                    <div className="wm-sug-info">
                      <span className="wm-sug-name">{stock.name}</span>
                      <span className="wm-sug-meta">{stock.symbol.replace('.NS', '')} · {stock.sector}</span>
                    </div>
                    {alreadyAdded ? (
                      <span className="wm-added-badge">Already added</span>
                    ) : (
                      <span className="wm-add-icon">+</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Watchlist */}
        <div className="wm-section">
          <div className="wm-list-header">
            <label className="wm-label">Your Watchlist ({items.length})</label>
            <button className="wm-btn-text" onClick={handleReset}>Reset to default</button>
          </div>
          <div className="wm-watchlist">
            {items.length === 0 ? (
              <p className="wm-empty">No stocks in watchlist. Add some above.</p>
            ) : (
              items.map((item) => (
                <div key={item.symbol} className="wm-item">
                  <div className="wm-item-info">
                    <span className="wm-item-name">{item.name}</span>
                    <span className="wm-item-meta">{item.symbol.replace('.NS', '')} · {item.sector}</span>
                  </div>
                  <button
                    className="wm-remove-btn"
                    onClick={() => removeStock(item.symbol)}
                    title="Remove from watchlist"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
