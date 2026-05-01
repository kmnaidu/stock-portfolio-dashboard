"""
Python microservice that wraps yfinance to provide real analyst
recommendations, target prices, and fundamentals for Indian stocks.
"""

from flask import Flask, jsonify
import yfinance as yf
import time
import random
import os

app = Flask(__name__)

# Simple in-memory cache: { key: (data, expiry_timestamp) }
_cache = {}
CACHE_TTL_SECONDS = 24 * 60 * 60  # 24 hours (reduce API hits, critical on free tier)
_last_fetch_time = 0
_min_delay_between_fetches = 2.0  # seconds


def _cached_or_fetch(key, fetcher):
    """Returns cached value if fresh, otherwise fetches and caches."""
    global _last_fetch_time
    now = time.time()
    if key in _cache:
        data, expiry = _cache[key]
        if now < expiry:
            return data

    # Throttle: enforce minimum delay between live fetches
    elapsed = now - _last_fetch_time
    if elapsed < _min_delay_between_fetches:
        time.sleep(_min_delay_between_fetches - elapsed)

    _last_fetch_time = time.time()

    # Retry with exponential backoff for rate limits
    max_retries = 3
    for attempt in range(max_retries):
        try:
            data = fetcher()
            _cache[key] = (data, now + CACHE_TTL_SECONDS)
            return data
        except Exception as e:
            err_str = str(e).lower()
            if 'rate' in err_str or 'too many' in err_str or '429' in err_str:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(wait_time)
                    continue
            # Return error result but don't cache failures
            return {'error': str(e), 'symbol': key.split(':', 1)[1] if ':' in key else key}

    return {'error': 'Max retries exceeded', 'symbol': key}


def safe_get(info, key, default=None):
    """Safely retrieve a value from yfinance info dict."""
    val = info.get(key, default)
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
        t = yf.Ticker(symbol)
        info = t.info

        if not info or len(info) < 5:
            raise Exception('Empty info response from yfinance')

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
            'targetMeanPrice': safe_get(info, 'targetMeanPrice', 0),
            'targetHighPrice': safe_get(info, 'targetHighPrice', 0),
            'targetLowPrice': safe_get(info, 'targetLowPrice', 0),
            'targetMedianPrice': safe_get(info, 'targetMedianPrice', 0),
            'numberOfAnalystOpinions': safe_get(info, 'numberOfAnalystOpinions', 0),
            'recommendationMean': safe_get(info, 'recommendationMean', 0),
            'recommendationKey': safe_get(info, 'recommendationKey', 'none'),

            'trailingPE': safe_get(info, 'trailingPE', 0),
            'forwardPE': safe_get(info, 'forwardPE', 0),
            'priceToBook': safe_get(info, 'priceToBook', 0),
            'pegRatio': safe_get(info, 'pegRatio', 0),

            'earningsGrowth': safe_get(info, 'earningsGrowth', 0),
            'revenueGrowth': safe_get(info, 'revenueGrowth', 0),
            'profitMargins': safe_get(info, 'profitMargins', 0),
            'returnOnEquity': safe_get(info, 'returnOnEquity', 0),

            'marketCap': safe_get(info, 'marketCap', 0),
            'beta': safe_get(info, 'beta', 0),
            'trailingEps': safe_get(info, 'trailingEps', 0),
            'forwardEps': safe_get(info, 'forwardEps', 0),
            'bookValue': safe_get(info, 'bookValue', 0),

            'dividendYield': safe_get(info, 'dividendYield', 0),
            'payoutRatio': safe_get(info, 'payoutRatio', 0),

            'fiftyTwoWeekHigh': safe_get(info, 'fiftyTwoWeekHigh', 0),
            'fiftyTwoWeekLow': safe_get(info, 'fiftyTwoWeekLow', 0),

            'sector': safe_get(info, 'sector', ''),
            'industry': safe_get(info, 'industry', ''),
            'longName': safe_get(info, 'longName', symbol),

            'recommendationTrend': rec_trend,
        }

    data = _cached_or_fetch(f'analyst:{symbol}', fetch)
    return jsonify(data)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
