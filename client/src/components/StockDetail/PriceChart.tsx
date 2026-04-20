import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { HistoricalDataPoint, TimeRange } from 'shared/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const RANGES: { label: string; value: TimeRange }[] = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
];

interface PriceChartProps {
  symbol: string;
}

/** Format a date string for the X-axis based on the selected range */
function formatXLabel(dateStr: string, range: TimeRange): string {
  const d = new Date(dateStr);
  if (range === '1d') {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '1w') {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Format price for tooltip */
function formatPrice(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PriceChart({ symbol }: PriceChartProps) {
  const [range, setRange] = useState<TimeRange>('1mo');
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (r: TimeRange) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/historical/${symbol}?range=${r}`);
      if (!res.ok) throw new Error('fetch failed');
      const json: HistoricalDataPoint[] = await res.json();
      setData(json);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange);
  };

  const chartData = data.map((pt) => ({
    date: pt.date,
    price: pt.close,
    label: formatXLabel(pt.date, range),
  }));

  return (
    <div className="price-chart-container">
      <div className="price-chart-header">
        <h3 className="price-chart-title">Price History</h3>
        <div className="range-selector">
          {RANGES.map((r) => (
            <button
              key={r.value}
              className={`range-btn${range === r.value ? ' range-btn-active' : ''}`}
              onClick={() => handleRangeChange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="price-chart-loading">Loading chart data…</div>
      ) : chartData.length === 0 ? (
        <div className="price-chart-empty">No data available for this range.</div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2196F3" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2196F3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#636e72' }}
              tickLine={false}
              axisLine={{ stroke: '#e9ecef' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: '#636e72' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `₹${v.toLocaleString('en-IN')}`}
              width={80}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#2196F3"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#2196F3', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/** Custom tooltip component */
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { date: string; price: number } }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const { date, price } = payload[0].payload;
  const d = new Date(date);
  const formattedDate = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-price">{formatPrice(price)}</div>
      <div className="chart-tooltip-date">{formattedDate} {formattedTime}</div>
    </div>
  );
}
