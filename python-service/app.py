"""
Python microservice that wraps yfinance to provide real analyst
recommendations, target prices, and fundamentals for Indian stocks.
Runs on port 5001 and is called by the Node.js backend.
"""

from flask import Flask, jsonify
from functools import lru_cache
import yfinance as yf
import time

app = Flask(__name__)

# Simple in-memory cache: { key: (data, expiry_timestamp) }
_cache = {}
CACHE_TTL_SECONDS = 6 * 60 * 60  # 6 hours


def _cached_or_fetch(key, fetcher):
    """Returns cached value if fresh, otherwise fetches and caches."""
    now = time.time()
    if key in _cache:
        data, expiry = _cache[key]
        if now < expiry:
            return data
    data = fetcher()
    _cache[key] = (data, now + CACHE_TTL_SECONDS)
    return data


def safe_get(info, key, default=None):
    """Safely retrieve a value from yfinance info dict."""
    val = info.get(key, default)
    # yfinance sometimes returns 'Infinity' or NaN
    if val is None:
        return default
    try:
        if isinstance(val, float) and (val != val or val == float('inf') or val == float('-inf')):
            return default
    except (TypeError, ValueError):
        pass
    return val


@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'yfinance-python'})


@app.route('/analyst/<symbol>')
def analyst_data(symbol):
    """Returns real analyst recommendations, target prices, and fundamentals."""
    def fetch():
        try:
            t = yf.Ticker(symbol)
            info = t.info

            # Recommendations trend from analyst firms
            rec_trend = []
            try:
                recs = t.recommendations
                if recs is not None and not recs.empty:
                    for _, row in recs.iterrows():
                        rec_trend.append({
                            'period': str(row.get('period', '')),
                            'strongBuy': int(row.get('strongBuy', 0) or 0),
                            'buy': int(row.get('buy', 0) or 0),
                            'hold': int(row.get('hold', 0) or 0),
                            'sell': int(row.get('sell', 0) or 0),
                            'strongSell': int(row.get('strongSell', 0) or 0),
                        })
            except Exception:
                pass

            return {
                'symbol': symbol,
                # Analyst target prices
                'targetMeanPrice': safe_get(info, 'targetMeanPrice', 0),
                'targetHighPrice': safe_get(info, 'targetHighPrice', 0),
                'targetLowPrice': safe_get(info, 'targetLowPrice', 0),
                'targetMedianPrice': safe_get(info, 'targetMedianPrice', 0),
                'numberOfAnalystOpinions': safe_get(info, 'numberOfAnalystOpinions', 0),
                'recommendationMean': safe_get(info, 'recommendationMean', 0),
                'recommendationKey': safe_get(info, 'recommendationKey', 'none'),

                # Valuation ratios
                'trailingPE': safe_get(info, 'trailingPE', 0),
                'forwardPE': safe_get(info, 'forwardPE', 0),
                'priceToBook': safe_get(info, 'priceToBook', 0),
                'pegRatio': safe_get(info, 'pegRatio', 0),

                # Growth & profitability
                'earningsGrowth': safe_get(info, 'earningsGrowth', 0),
                'revenueGrowth': safe_get(info, 'revenueGrowth', 0),
                'profitMargins': safe_get(info, 'profitMargins', 0),
                'returnOnEquity': safe_get(info, 'returnOnEquity', 0),

                # Market data
                'marketCap': safe_get(info, 'marketCap', 0),
                'beta': safe_get(info, 'beta', 0),
                'trailingEps': safe_get(info, 'trailingEps', 0),
                'forwardEps': safe_get(info, 'forwardEps', 0),
                'bookValue': safe_get(info, 'bookValue', 0),

                # Dividend
                'dividendYield': safe_get(info, 'dividendYield', 0),
                'payoutRatio': safe_get(info, 'payoutRatio', 0),

                # 52-week
                'fiftyTwoWeekHigh': safe_get(info, 'fiftyTwoWeekHigh', 0),
                'fiftyTwoWeekLow': safe_get(info, 'fiftyTwoWeekLow', 0),

                # Company info
                'sector': safe_get(info, 'sector', ''),
                'industry': safe_get(info, 'industry', ''),
                'longName': safe_get(info, 'longName', symbol),

                # Recommendation trend history
                'recommendationTrend': rec_trend,
            }
        except Exception as e:
            return {'error': str(e), 'symbol': symbol}

    data = _cached_or_fetch(f'analyst:{symbol}', fetch)
    return jsonify(data)


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
