"""
Python microservice that wraps yfinance to provide real analyst
recommendations, target prices, and fundamentals for Indian stocks.

Uses ScraperAPI to route requests through residential IPs when running
on cloud providers (Render, Railway, etc.) that Yahoo Finance blocks.
"""

from flask import Flask, jsonify
import yfinance as yf
import requests
import time
import random
import os

app = Flask(__name__)

# Configuration
CACHE_TTL_SECONDS = 24 * 60 * 60
SCRAPERAPI_KEY = os.environ.get('SCRAPERAPI_KEY', '').strip()
USE_SCRAPERAPI = bool(SCRAPERAPI_KEY)

# Configure yfinance to use ScraperAPI proxy at the session level
# yfinance accepts a proxy arg, so we'll pass it on each Ticker call
if USE_SCRAPERAPI:
    # ScraperAPI proxy endpoint
    PROXY_URL = f"http://scraperapi:{SCRAPERAPI_KEY}@proxy-server.scraperapi.com:8001"
    print(f"✓ ScraperAPI proxy configured (key starts with {SCRAPERAPI_KEY[:6]}...)")
else:
    PROXY_URL = None
    print("⚠ SCRAPERAPI_KEY not set — requests go directly (may be rate-limited)")


# ── Custom session with ScraperAPI proxy ────────────────────
def make_session():
    """Create a requests.Session configured with ScraperAPI proxy."""
    session = requests.Session()
    if USE_SCRAPERAPI:
        session.proxies = {
            'http': PROXY_URL,
            'https': PROXY_URL,
        }
        # ScraperAPI requires SSL verification to be disabled
        session.verify = False
        # Suppress the SSL warning
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    return session


# ── Simple in-memory cache ──────────────────────────────────
_cache = {}
_last_fetch_time = 0
_min_delay_between_fetches = 1.0


def _cached_or_fetch(key, fetcher):
    global _last_fetch_time
    now = time.time()
    if key in _cache:
        data, expiry = _cache[key]
        if now < expiry:
            return data

    elapsed = now - _last_fetch_time
    if elapsed < _min_delay_between_fetches:
        time.sleep(_min_delay_between_fetches - elapsed)

    _last_fetch_time = time.time()

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


# ── Direct Yahoo Finance API calls through ScraperAPI ──────

def fetch_via_scraperapi(url):
    """Fetch a Yahoo Finance URL through ScraperAPI."""
    if not USE_SCRAPERAPI:
        # Direct fetch if no proxy
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=30)
        r.raise_for_status()
        return r.json()

    # ScraperAPI REST API endpoint (easier than proxy mode)
    api_url = 'https://api.scraperapi.com'
    params = {
        'api_key': SCRAPERAPI_KEY,
        'url': url,
        'country_code': 'us',  # US IPs work best for Yahoo
    }
    r = requests.get(api_url, params=params, timeout=60)
    if r.status_code == 429:
        raise Exception('Too Many Requests. Rate limited. Try after a while.')
    r.raise_for_status()
    return r.json()


def fetch_analyst_data(symbol):
    """Fetches analyst data using direct Yahoo API through ScraperAPI."""
    # Yahoo Finance v10 quoteSummary with needed modules
    modules = 'assetProfile,financialData,defaultKeyStatistics,summaryDetail,recommendationTrend,summaryProfile,price'
    url = f'https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules={modules}'

    data = fetch_via_scraperapi(url)
    result = data.get('quoteSummary', {}).get('result', [])
    if not result:
        return {'error': 'No data', 'symbol': symbol}

    summary = result[0]
    key_stats = summary.get('defaultKeyStatistics', {})
    fin_data = summary.get('financialData', {})
    detail = summary.get('summaryDetail', {})
    rec_trend_data = summary.get('recommendationTrend', {})
    price_data = summary.get('price', {})
    profile = summary.get('summaryProfile', {})

    def raw(obj, key, default=0):
        val = obj.get(key, {})
        if isinstance(val, dict):
            return val.get('raw', default)
        return val if val is not None else default

    rec_trend = []
    for period in rec_trend_data.get('trend', []):
        rec_trend.append({
            'period': period.get('period', ''),
            'strongBuy': period.get('strongBuy', 0) or 0,
            'buy': period.get('buy', 0) or 0,
            'hold': period.get('hold', 0) or 0,
            'sell': period.get('sell', 0) or 0,
            'strongSell': period.get('strongSell', 0) or 0,
        })

    # Recommendation key mapping from recommendationMean
    rec_mean = raw(fin_data, 'recommendationMean', 0)
    if rec_mean == 0:
        rec_key = 'none'
    elif rec_mean <= 1.5:
        rec_key = 'strong_buy'
    elif rec_mean <= 2.5:
        rec_key = 'buy'
    elif rec_mean <= 3.5:
        rec_key = 'hold'
    elif rec_mean <= 4.5:
        rec_key = 'sell'
    else:
        rec_key = 'strong_sell'

    return {
        'symbol': symbol,
        'targetMeanPrice': raw(fin_data, 'targetMeanPrice', 0),
        'targetHighPrice': raw(fin_data, 'targetHighPrice', 0),
        'targetLowPrice': raw(fin_data, 'targetLowPrice', 0),
        'targetMedianPrice': raw(fin_data, 'targetMedianPrice', 0),
        'numberOfAnalystOpinions': raw(fin_data, 'numberOfAnalystOpinions', 0),
        'recommendationMean': rec_mean,
        'recommendationKey': fin_data.get('recommendationKey', rec_key),

        'trailingPE': raw(detail, 'trailingPE', 0),
        'forwardPE': raw(detail, 'forwardPE', 0) or raw(key_stats, 'forwardPE', 0),
        'priceToBook': raw(key_stats, 'priceToBook', 0),
        'pegRatio': raw(key_stats, 'pegRatio', 0),

        'earningsGrowth': raw(fin_data, 'earningsGrowth', 0),
        'revenueGrowth': raw(fin_data, 'revenueGrowth', 0),
        'profitMargins': raw(fin_data, 'profitMargins', 0),
        'returnOnEquity': raw(fin_data, 'returnOnEquity', 0),

        'marketCap': raw(price_data, 'marketCap', 0) or raw(detail, 'marketCap', 0),
        'beta': raw(key_stats, 'beta', 0) or raw(detail, 'beta', 0),
        'trailingEps': raw(key_stats, 'trailingEps', 0),
        'forwardEps': raw(key_stats, 'forwardEps', 0),
        'bookValue': raw(key_stats, 'bookValue', 0),

        'dividendYield': raw(detail, 'dividendYield', 0),
        'payoutRatio': raw(detail, 'payoutRatio', 0),

        'fiftyTwoWeekHigh': raw(detail, 'fiftyTwoWeekHigh', 0) or raw(key_stats, 'fiftyTwoWeekHigh', 0),
        'fiftyTwoWeekLow': raw(detail, 'fiftyTwoWeekLow', 0) or raw(key_stats, 'fiftyTwoWeekLow', 0),

        'sector': profile.get('sector', ''),
        'industry': profile.get('industry', ''),
        'longName': price_data.get('longName') or price_data.get('shortName') or symbol,

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
