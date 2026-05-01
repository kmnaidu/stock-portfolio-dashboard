import { useState, useEffect } from 'react';
import { useWatchlist } from '../context/WatchlistContext';

interface Props {
  symbol: string;
  name: string;
  currentPrice: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function HoldingsModal({ symbol, name, currentPrice, isOpen, onClose }: Props) {
  const { getHolding, updateHolding } = useWatchlist();
  const holding = getHolding(symbol);

  const [quantity, setQuantity] = useState<string>('');
  const [avgBuyPrice, setAvgBuyPrice] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setQuantity(holding?.quantity?.toString() ?? '');
      setAvgBuyPrice(holding?.avgBuyPrice?.toString() ?? '');
    }
  }, [isOpen, holding?.quantity, holding?.avgBuyPrice]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    const qty = quantity.trim() ? parseFloat(quantity) : undefined;
    const price = avgBuyPrice.trim() ? parseFloat(avgBuyPrice) : undefined;

    // Only save if both are valid numbers, or both are empty (to clear)
    if (qty !== undefined && (isNaN(qty) || qty < 0)) {
      alert('Please enter a valid quantity');
      return;
    }
    if (price !== undefined && (isNaN(price) || price < 0)) {
      alert('Please enter a valid buy price');
      return;
    }

    updateHolding(symbol, qty, price);
    onClose();
  };

  const handleClear = () => {
    updateHolding(symbol, undefined, undefined);
    onClose();
  };

  const qty = parseFloat(quantity) || 0;
  const avgPrice = parseFloat(avgBuyPrice) || 0;
  const invested = qty * avgPrice;
  const currentValue = qty * currentPrice;
  const pnl = currentValue - invested;
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

  const hasInputs = qty > 0 && avgPrice > 0;

  return (
    <div className="hm-overlay" onClick={onClose}>
      <div className="hm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="hm-header">
          <div>
            <h2 className="hm-title">Holdings</h2>
            <p className="hm-subtitle">{name} · Current: ₹{currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <button className="wm-close" onClick={onClose}>✕</button>
        </div>

        <div className="hm-body">
          <div className="hm-field">
            <label className="hm-label">Quantity (shares)</label>
            <input
              type="number"
              className="wm-input"
              placeholder="e.g., 50"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0"
              step="1"
            />
          </div>

          <div className="hm-field">
            <label className="hm-label">Average Buy Price (₹)</label>
            <input
              type="number"
              className="wm-input"
              placeholder="e.g., 3200"
              value={avgBuyPrice}
              onChange={(e) => setAvgBuyPrice(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          {hasInputs && (
            <div className="hm-preview">
              <h4 className="hm-preview-title">Live Preview</h4>
              <div className="hm-preview-grid">
                <div className="hm-preview-item">
                  <span className="hm-preview-label">Total Invested</span>
                  <span className="hm-preview-value">₹{invested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="hm-preview-item">
                  <span className="hm-preview-label">Current Value</span>
                  <span className="hm-preview-value">₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="hm-preview-item">
                  <span className="hm-preview-label">P&L</span>
                  <span className={`hm-preview-value ${pnl >= 0 ? 'hm-gain' : 'hm-loss'}`}>
                    {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="hm-preview-item">
                  <span className="hm-preview-label">Return %</span>
                  <span className={`hm-preview-value ${pnl >= 0 ? 'hm-gain' : 'hm-loss'}`}>
                    {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="hm-footer">
          {holding?.quantity !== undefined && (
            <button className="wm-btn-text hm-clear" onClick={handleClear}>Clear Holdings</button>
          )}
          <div className="hm-footer-actions">
            <button className="wm-btn wm-btn-secondary" onClick={onClose}>Cancel</button>
            <button className="wm-btn wm-btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
