"""
Python microservice that wraps yfinance to provide real analyst
recommendations, target prices, and fundamentals for Indian stocks.

Uses curl_cffi session with ScraperAPI proxy mode to bypass Yahoo's
TLS fingerprinting + IP blocks. This is the combination that works:
- curl_cffi impersonates a real browser's TLS fingerprint
- ScraperAPI routes through residential IPs
"""

from flask import Flask, jsonify
import yfinance as yf
import time
import random
import os
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

# Configuration
CACHE_TTL_SECONDS = 24 * 60 * 60
SCRAPERAPI_KEY = os.environ.get('SCRAPERAPI_KEY', '').strip()
USE_SCRAPERAPI = bool(SCRAPERAPI_KEY)

if USE_SCRAPERAPI:
    PROXY_URL = f"http://scraperapi:{SCRAPERAPI_KEY}@proxy-server.scraperapi.com:8001"
    print(f"✓ ScraperAPI proxy configured")
else:
    PROXY_URL = None
    print("⚠ SCRAPERAPI_KEY not set — requests may be rate-limited")


# ── Simple in-memory cache ──────────────────────────────────
_cache = {}


def _cached_or_fetch(key, fetcher):
    now = time.time()
    if key in _cache:
        data, expiry = _cache[key]
        if now < expiry:
            return data

    for attempt in range(3):
        try:
            data = fetcher()
            _cache[key] = (data, now + CACHE_TTL_SECONDS)
            return data
        except Exception as e:
            if attempt < 2:
                time.sleep((2 ** attempt) + random.uniform(0, 0.5))
                continue
            return {'error': str(e), 'symbol': key.split(':', 1)[1] if ':' in key else key}

    return {'error': 'Max retries exceeded', 'symbol': key}


def safe_get(info, key, default=None):
    val = info.get(key, default)
    if val is None:
        return default
    try:
        if isinstance(val, float) and (val != val or val == float('inf') or val == float('-inf')):
            return default
    except (TypeError, ValueError):
        pass
    return val


def _make_yf_session():
    """Create a curl_cffi session (required by yfinance) with ScraperAPI proxy."""
    from curl_cffi import requests as cffi_requests

    # curl_cffi impersonates Chrome's TLS fingerprint
    session = cffi_requests.Session(impersonate="chrome124")

    if USE_SCRAPERAPI:
        session.proxies = {
            'http': PROXY_URL,
            'https': PROXY_URL,
        }
        session.verify = False

    return session


def fetch_analyst_data(symbol):
    """Fetches analyst data using yfinance Ticker via curl_cffi + ScraperAPI."""
    if USE_SCRAPERAPI:
        session = _make_yf_session()
        t = yf.Ticker(symbol, session=session)
    else:
        t = yf.Ticker(symbol)

    info = t.info

    if not info or len(info) < 5:
        raise Exception('Empty info response from yfinance')

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


@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'service': 'yfinance-python',
        'scraperapi': USE_SCRAPERAPI,
    })


@app.route('/analyst/<symbol>')
def analyst_data(symbol):
    data = _cached_or_fetch(f'analyst:{symbol}', lambda: fetch_analyst_data(symbol))
    return jsonify(data)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
