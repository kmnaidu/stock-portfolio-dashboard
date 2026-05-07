import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface GlobalIndex {
  symbol: string;
  name: string;
  region: string;
  flag: string;
  price: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
}

interface GlobalMarketsData {
  generatedAt: string;
  indices: GlobalIndex[];
}

function formatNumber(v: number, decimals = 2): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function GlobalMarkets() {
  const [data, setData] = useState<GlobalMarketsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/api/global-markets`);
        if (!res.ok) throw new Error('fail');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    }
    fetchData();
    const id = setInterval(fetchData, 60 * 1000); // Refresh every 60 seconds
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) {
    return (
      <div className="gm-panel">
        <h3 className="gm-title">🌍 Global Markets</h3>
        <div className="gm-loading">Loading global indices…</div>
      </div>
    );
  }

  if (!data || data.indices.length === 0) return null;

  return (
    <div className="gm-panel">
      <h3 className="gm-title">🌍 Global Markets</h3>
      <div className="gm-grid">
        {data.indices.map((idx) => (
          <div key={idx.symbol} className={`gm-card gm-${idx.direction}`}>
            <div className="gm-card-top">
              <span className="gm-flag">{idx.flag}</span>
              <span className="gm-name">{idx.name}</span>
            </div>
            <div className="gm-card-price">
              {formatNumber(idx.price)}
            </div>
            <div className={`gm-card-change gm-change-${idx.direction}`}>
              {idx.direction === 'up' ? '▲' : idx.direction === 'down' ? '▼' : '—'}
              {' '}{idx.change >= 0 ? '+' : ''}{formatNumber(idx.change)}
              {' '}({idx.changePercent >= 0 ? '+' : ''}{formatNumber(idx.changePercent)}%)
            </div>
            <div className="gm-region">{idx.region}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
