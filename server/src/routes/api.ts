// ============================================================
// REST API Routes — factory function that accepts service
// instances and returns an Express Router.
// ============================================================

import { Router, type Request, type Response } from 'express';
import { SUPPORTED_SECURITIES, type TimeRange } from 'shared/types.js';
import type { YFService } from '../services/yahooFinanceService.js';
import type { MarketStatusService } from '../services/marketStatusService.js';
import type { PredictionEngine } from '../services/predictionEngine.js';
import type { CacheService } from '../services/cacheService.js';
import { computeSupportResistance } from '../services/supportResistanceService.js';
import { computeGrowthPotential } from '../services/growthPotentialService.js';
import type { AnalystDataService } from '../services/analystDataService.js';
import type { MarketPulseService } from '../services/marketPulseService.js';
import type { AIAnalysisService } from '../services/aiAnalysisService.js';
import type { AgentService } from '../services/agentService.js';
import type { MultiAgentService } from '../services/multiAgentService.js';
import { getAIStats, getAILogs } from '../services/aiObservability.js';

const VALID_RANGES = new Set<string>(['1d', '1w', '1mo', '3mo', '6mo', '1y']);

// Accept any valid NSE symbol (alphanumeric + optional .NS suffix)
// Also allow BSE symbols (.BO) and indices (^ prefix)
const SYMBOL_PATTERN = /^(\^[A-Z]+|[A-Z0-9&\-_]+\.(NS|BO))$/i;

function validateSymbol(symbol: string, res: Response): boolean {
  if (!symbol || !SYMBOL_PATTERN.test(symbol)) {
    res.status(400).json({
      error: 'INVALID_SYMBOL',
      message: `Symbol '${symbol}' is not a valid NSE/BSE format. Expected format: RELIANCE.NS, TCS.NS, ^NSEI, etc.`,
    });
    return false;
  }
  return true;
}

/** Parse symbols from query param. Falls back to SUPPORTED_SECURITIES. */
function parseSymbols(symbolsParam: string | undefined): string[] {
  if (!symbolsParam || typeof symbolsParam !== 'string') {
    return SUPPORTED_SECURITIES.map((s) => s.symbol);
  }
  return symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SYMBOL_PATTERN.test(s));
}

export function createApiRouter(services: {
  yfService: YFService;
  marketStatusService: MarketStatusService;
  predictionEngine: PredictionEngine;
  analystDataService: AnalystDataService;
  marketPulseService: MarketPulseService;
  aiAnalysisService: AIAnalysisService;
  agentService: AgentService;
  multiAgentService: MultiAgentService;
  cache: CacheService;
}): Router {
  const { yfService, marketStatusService, predictionEngine, analystDataService, marketPulseService, aiAnalysisService } = services;
  const agentService = services.agentService;
  const multiAgentService = services.multiAgentService;
  const router = Router();

  // Track all stock symbols ever requested by users (for dynamic prewarm)
  const requestedStocks = new Set<string>();

  // GET /api/health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // GET /api/requested-stocks — returns all symbols ever requested by users
  router.get('/requested-stocks', (_req: Request, res: Response) => {
    res.json({
      stocks: [...requestedStocks].sort(),
      count: requestedStocks.size,
    });
  });

  // GET /api/quotes?symbols=RELIANCE.NS,TCS.NS — accepts custom watchlist
  router.get('/quotes', async (req: Request, res: Response) => {
    try {
      const symbols = parseSymbols(req.query.symbols as string | undefined);
      if (symbols.length === 0) {
        res.json([]);
        return;
      }
      const quotes = await yfService.getQuotes(symbols);
      res.json(quotes);
    } catch {
      res.status(503).json({ error: 'DATA_UNAVAILABLE', message: 'Failed to fetch quotes' });
    }
  });

  // GET /api/validate-symbol/:symbol — check if a symbol is valid and has data
  router.get('/validate-symbol/:symbol', async (req: Request, res: Response) => {
    const rawSymbol = (req.params.symbol as string).toUpperCase();
    // Auto-append .NS if missing
    const symbol = SYMBOL_PATTERN.test(rawSymbol) ? rawSymbol : `${rawSymbol}.NS`;
    if (!validateSymbol(symbol, res)) return;

    try {
      const quotes = await yfService.getQuotes([symbol]);
      if (quotes.length === 0 || quotes[0].price === 0) {
        res.status(404).json({ error: 'SYMBOL_NOT_FOUND', symbol });
        return;
      }
      res.json({
        valid: true,
        symbol: quotes[0].symbol,
        name: quotes[0].shortName,
        price: quotes[0].price,
      });
    } catch {
      res.status(404).json({ error: 'SYMBOL_NOT_FOUND', symbol });
    }
  });

  // GET /api/quotes/:symbol — real-time quote for a single security
  router.get('/quotes/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol as string;
    if (!validateSymbol(symbol, res)) return;

    try {
      const quotes = await yfService.getQuotes([symbol]);
      if (quotes.length === 0) {
        res.status(503).json({ error: 'DATA_UNAVAILABLE', symbol });
        return;
      }
      res.json(quotes[0]);
    } catch {
      res.status(503).json({ error: 'DATA_UNAVAILABLE', symbol });
    }
  });

  // GET /api/historical/:symbol — historical OHLCV data
  router.get('/historical/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol as string;
    if (!validateSymbol(symbol, res)) return;

    const range = (req.query.range as string) || '1mo';
    if (!VALID_RANGES.has(range)) {
      res.status(400).json({
        error: 'INVALID_RANGE',
        message: `Invalid range '${range}'. Valid ranges: ${[...VALID_RANGES].join(', ')}`,
      });
      return;
    }

    try {
      const data = await yfService.getHistorical(symbol, range as TimeRange);
      res.json(data);
    } catch {
      res.status(503).json({ error: 'DATA_UNAVAILABLE', symbol });
    }
  });

  // GET /api/predictions/:symbol — price predictions (1w, 1mo, 3mo)
  router.get('/predictions/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol as string;
    if (!validateSymbol(symbol, res)) return;

    try {
      // Fetch 6 months of historical data for the prediction engine
      const historicalData = await yfService.getHistorical(symbol, '6mo');
      if (historicalData.length < 30) {
        res.json({
          error: 'PREDICTION_UNAVAILABLE',
          symbol,
          message: 'Insufficient historical data for predictions',
        });
        return;
      }
      const predictions = predictionEngine.generatePredictions(symbol, historicalData);
      res.json(predictions);
    } catch {
      res.json({
        error: 'PREDICTION_UNAVAILABLE',
        symbol,
        message: 'Failed to generate predictions',
      });
    }
  });

  // GET /api/recommendations/:symbol — analyst recommendations
  router.get('/recommendations/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol as string;
    if (!validateSymbol(symbol, res)) return;

    try {
      const recommendations = await yfService.getRecommendations(symbol);
      res.json(recommendations);
    } catch {
      res.status(503).json({ error: 'DATA_UNAVAILABLE', symbol });
    }
  });

  // GET /api/market-status — current NSE market status and IST time
  router.get('/market-status', (_req: Request, res: Response) => {
    const status = marketStatusService.getStatus();
    res.json(status);
  });

  // GET /api/summary/:symbol — detailed financial metrics
  router.get('/summary/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol as string;
    if (!validateSymbol(symbol, res)) return;

    try {
      const summary = await yfService.getQuoteSummary(symbol);
      res.json(summary);
    } catch {
      res.status(503).json({ error: 'DATA_UNAVAILABLE', symbol });
    }
  });

  // GET /api/support-resistance/:symbol — support/resistance levels, buy range, verdict
  router.get('/support-resistance/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol as string;
    if (!validateSymbol(symbol, res)) return;

    // Track this stock as requested
    requestedStocks.add(symbol);

    const cacheKey = `sr:${symbol}`;
    const cached = services.cache.get<any>(cacheKey);
    if (cached) { res.json(cached); return; }

    try {
      const historicalData = await yfService.getHistorical(symbol, '1y');
      if (historicalData.length < 30) {
        res.json({ error: 'INSUFFICIENT_DATA', symbol, message: 'Not enough historical data' });
        return;
      }

      const closes = historicalData.map(d => d.close).filter(p => p > 0);
      const highs = historicalData.map(d => d.high).filter(p => p > 0);
      const lows = historicalData.map(d => d.low).filter(p => p > 0);

      const result = computeSupportResistance(symbol, closes, highs, lows);
      services.cache.set(cacheKey, result, 3600);
      res.json(result);
    } catch {
      res.status(503).json({ error: 'DATA_UNAVAILABLE', symbol });
    }
  });

  // GET /api/growth-potential/:symbol — estimated 1Y upside with volume & Bollinger analysis
  router.get('/growth-potential/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol as string;
    if (!validateSymbol(symbol, res)) return;

    const cacheKey = `gp:${symbol}`;
    const cached = services.cache.get<any>(cacheKey);
    if (cached) { res.json(cached); return; }

    try {
      const historicalData = await yfService.getHistorical(symbol, '1y');
      if (historicalData.length < 30) {
        res.json({ error: 'INSUFFICIENT_DATA', symbol });
        return;
      }

      const closes = historicalData.map(d => d.close).filter(p => p > 0);
      const highs = historicalData.map(d => d.high).filter(p => p > 0);
      const lows = historicalData.map(d => d.low).filter(p => p > 0);
      const volumes = historicalData.map(d => d.volume);

      // Get 52-week data from summary
      const summary = await yfService.getQuoteSummary(symbol);

      const result = computeGrowthPotential(
        symbol, closes, highs, lows, volumes,
        summary.fiftyTwoWeekHigh, summary.fiftyTwoWeekLow,
      );
      services.cache.set(cacheKey, result, 3600);
      res.json(result);
    } catch {
      res.status(503).json({ error: 'DATA_UNAVAILABLE', symbol });
    }
  });

  // GET /api/growth-potential — ranked list of all stocks by upside potential
  router.get('/growth-potential', async (_req: Request, res: Response) => {
    const cacheKey = 'gp:all';
    const cached = services.cache.get<any>(cacheKey);
    if (cached) { res.json(cached); return; }

    try {
      const results = [];
      for (const sec of SUPPORTED_SECURITIES) {
        try {
          const historicalData = await yfService.getHistorical(sec.symbol, '1y');
          if (historicalData.length < 30) continue;

          const closes = historicalData.map(d => d.close).filter(p => p > 0);
          const highs = historicalData.map(d => d.high).filter(p => p > 0);
          const lows = historicalData.map(d => d.low).filter(p => p > 0);
          const volumes = historicalData.map(d => d.volume);

          const summary = await yfService.getQuoteSummary(sec.symbol);
          const gp = computeGrowthPotential(
            sec.symbol, closes, highs, lows, volumes,
            summary.fiftyTwoWeekHigh, summary.fiftyTwoWeekLow,
          );
          results.push({ ...gp, name: sec.name, sector: sec.sector });
        } catch {
          // Skip failed symbols
        }
      }

      // Sort by estimated upside descending
      results.sort((a, b) => b.estimatedUpsidePercent - a.estimatedUpsidePercent);
      services.cache.set(cacheKey, results, 3600);
      res.json(results);
    } catch {
      res.status(503).json({ error: 'DATA_UNAVAILABLE', message: 'Failed to compute growth potential' });
    }
  });

  // GET /api/analyst/:symbol — real analyst data from Python yfinance service
  router.get('/analyst/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol as string;
    if (!validateSymbol(symbol, res)) return;

    // Track this stock as requested
    requestedStocks.add(symbol);

    const data = await analystDataService.getAnalystData(symbol);
    if (!data) {
      res.status(503).json({
        error: 'ANALYST_DATA_UNAVAILABLE',
        symbol,
        message: 'Python yfinance service unavailable or no data for this symbol',
      });
      return;
    }
    res.json(data);
  });

  // GET /api/top-picks?symbols=... — ranks user's watchlist by REAL analyst upside
  router.get('/top-picks', async (req: Request, res: Response) => {
    const symbols = parseSymbols(req.query.symbols as string | undefined);
    const cacheKey = `top-picks:${symbols.sort().join(',')}`;
    const cached = services.cache.get<any>(cacheKey);
    if (cached) { res.json(cached); return; }

    try {
      // Get current quotes for all symbols
      const quotes = await yfService.getQuotes(symbols);
      const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

      const results: any[] = [];

      // Sequential fetch with short timeout per stock
      // Cached stocks return instantly; uncached may timeout — skipped gracefully
      for (const symbol of symbols) {
        try {
          const analyst = await analystDataService.getAnalystData(symbol);
          const quote = quoteMap.get(symbol);
          if (!quote) continue;

          const currentPrice = quote.price;
          const security = SUPPORTED_SECURITIES.find((s) => s.symbol === symbol);
          const name = security?.name ?? quote.shortName ?? symbol.replace('.NS', '');
          const sector = security?.sector ?? 'Other';

          if (!analyst || analyst.targetMeanPrice <= 0 || analyst.numberOfAnalystOpinions === 0) {
            results.push({
              symbol,
              name,
              sector,
              currentPrice,
              hasAnalystData: false,
              numberOfAnalystOpinions: 0,
            });
            continue;
          }

          const upsidePercent = ((analyst.targetMeanPrice - currentPrice) / currentPrice) * 100;

          results.push({
            symbol,
            name,
            sector,
            currentPrice,
            hasAnalystData: true,
            targetMeanPrice: analyst.targetMeanPrice,
            targetHighPrice: analyst.targetHighPrice,
            targetLowPrice: analyst.targetLowPrice,
            upsidePercent: Math.round(upsidePercent * 100) / 100,
            upsideToHigh: Math.round(((analyst.targetHighPrice - currentPrice) / currentPrice) * 10000) / 100,
            upsideToLow: Math.round(((analyst.targetLowPrice - currentPrice) / currentPrice) * 10000) / 100,
            numberOfAnalystOpinions: analyst.numberOfAnalystOpinions,
            recommendationKey: analyst.recommendationKey,
            recommendationMean: analyst.recommendationMean,
            trailingPE: analyst.trailingPE,
            forwardPE: analyst.forwardPE,
            pegRatio: analyst.pegRatio,
            revenueGrowth: analyst.revenueGrowth,
            earningsGrowth: analyst.earningsGrowth,
          });
        } catch {
          // Skip this symbol on error, continue with rest
        }
      }

      const withAnalyst = results.filter((r: any) => r.hasAnalystData);
      const withoutAnalyst = results.filter((r: any) => !r.hasAnalystData);

      withAnalyst.sort((a: any, b: any) => b.upsidePercent - a.upsidePercent);

      const response = {
        withAnalystData: withAnalyst,
        withoutAnalystData: withoutAnalyst,
        generatedAt: new Date().toISOString(),
      };

      // Cache based on how much analyst data we got
      // Full data → cache 1 hour. Partial → cache only 5 min so we retry soon
      const fullSuccess = withAnalyst.length >= symbols.length * 0.8;
      const cacheTTL = fullSuccess ? 3600 : 300;
      services.cache.set(cacheKey, response, cacheTTL);
      res.json(response);
    } catch (err) {
      res.status(503).json({
        error: 'TOP_PICKS_UNAVAILABLE',
        message: err instanceof Error ? err.message : 'Failed',
      });
    }
  });

  // GET /api/market-pulse — macro signals (oil, rupee, FII, indices)
  router.get('/market-pulse', async (_req: Request, res: Response) => {
    try {
      const data = await marketPulseService.getPulse();
      res.json(data);
    } catch {
      res.status(503).json({ error: 'MARKET_PULSE_UNAVAILABLE' });
    }
  });

  // GET /api/nifty-levels — pivot point support/resistance levels (no LLM, pure math)
  router.get('/nifty-levels', async (_req: Request, res: Response) => {
    try {
      const data = await marketPulseService.getPulse();
      if (data.niftyLevels) {
        res.json(data.niftyLevels);
      } else {
        res.status(503).json({ error: 'NIFTY_LEVELS_UNAVAILABLE' });
      }
    } catch {
      res.status(503).json({ error: 'NIFTY_LEVELS_UNAVAILABLE' });
    }
  });

  // GET /api/global-markets — major global indices
  router.get('/global-markets', async (_req: Request, res: Response) => {
    const cacheKey = 'global-markets';
    const cached = services.cache.get<any>(cacheKey);
    if (cached) { res.json(cached); return; }

    const GLOBAL_INDICES = [
      { symbol: '^GSPC', name: 'S&P 500', region: 'US', flag: '🇺🇸' },
      { symbol: '^IXIC', name: 'NASDAQ', region: 'US', flag: '🇺🇸' },
      { symbol: '^DJI', name: 'Dow Jones', region: 'US', flag: '🇺🇸' },
      { symbol: '^N225', name: 'Nikkei 225', region: 'Japan', flag: '🇯🇵' },
      { symbol: '^HSI', name: 'Hang Seng', region: 'Hong Kong', flag: '🇭🇰' },
      { symbol: '^FTSE', name: 'FTSE 100', region: 'UK', flag: '🇬🇧' },
    ];

    try {
      const indices = [];
      for (const idx of GLOBAL_INDICES) {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idx.symbol)}?range=5d&interval=1d`;
          const fetchRes = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(8000),
          });
          if (!fetchRes.ok) continue;
          const json = (await fetchRes.json()) as any;
          const result = json?.chart?.result?.[0];
          const meta = result?.meta;
          if (!meta) continue;

          const price = meta.regularMarketPrice ?? 0;
          const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
          const nonNull = closes.filter((c): c is number => c != null);
          const prevClose = nonNull.length >= 2 ? nonNull[nonNull.length - 2] : (meta.chartPreviousClose ?? price);

          const change = price - prevClose;
          const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
          const direction = Math.abs(changePercent) < 0.05 ? 'flat' : (change > 0 ? 'up' : 'down');

          indices.push({
            symbol: idx.symbol,
            name: idx.name,
            region: idx.region,
            flag: idx.flag,
            price: Math.round(price * 100) / 100,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            direction,
          });
        } catch { /* skip failed index */ }
      }

      const result = { generatedAt: new Date().toISOString(), indices };
      services.cache.set(cacheKey, result, 60); // 60 sec cache
      res.json(result);
    } catch {
      res.status(503).json({ error: 'GLOBAL_MARKETS_UNAVAILABLE' });
    }
  });

  // GET /api/index-futures — live index futures from TradingView (trade after hours)
  router.get('/index-futures', async (_req: Request, res: Response) => {
    const cacheKey = 'index-futures';
    const cached = services.cache.get<any>(cacheKey);
    if (cached) { res.json(cached); return; }

    const FUTURES = [
      { ticker: 'NSEIX:NIFTY1!', name: 'Nifty 50', flag: '🇮🇳' },
      { ticker: 'NSEIX:BANKNIFTY1!', name: 'Bank Nifty', flag: '🇮🇳' },
      { ticker: 'CME_MINI:ES1!', name: 'S&P 500', flag: '🇺🇸' },
      { ticker: 'CME_MINI:NQ1!', name: 'NASDAQ 100', flag: '🇺🇸' },
      { ticker: 'CBOT_MINI:YM1!', name: 'Dow Jones', flag: '🇺🇸' },
      { ticker: 'CME_MINI:RTY1!', name: 'Russell 2000', flag: '🇺🇸' },
      { ticker: 'EUREX:FDAX1!', name: 'DAX', flag: '🇩🇪' },
      { ticker: 'EURONEXT:FCE1!', name: 'CAC 40', flag: '🇫🇷' },
    ];

    try {
      const payload = JSON.stringify({
        columns: ['close', 'change', 'change_abs', 'high', 'low'],
        symbols: { tickers: FUTURES.map(f => f.ticker) },
      });

      const fetchRes = await fetch('https://scanner.tradingview.com/global/scan', {
        method: 'POST',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });

      if (!fetchRes.ok) { res.status(503).json({ error: 'FUTURES_UNAVAILABLE' }); return; }
      const json = (await fetchRes.json()) as any;

      const futures = json.data.map((item: any) => {
        const meta = FUTURES.find(f => f.ticker === item.s);
        const [price, changePct, changeAbs, high, low] = item.d;
        return {
          symbol: item.s,
          name: meta?.name || item.s,
          flag: meta?.flag || '',
          price: Math.round(price * 100) / 100,
          change: Math.round(changeAbs * 100) / 100,
          changePercent: Math.round(changePct * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          direction: Math.abs(changePct) < 0.05 ? 'flat' : (changePct > 0 ? 'up' : 'down'),
        };
      });

      const result = { generatedAt: new Date().toISOString(), futures };
      services.cache.set(cacheKey, result, 30); // 30 sec cache
      res.json(result);
    } catch {
      res.status(503).json({ error: 'FUTURES_UNAVAILABLE' });
    }
  });

  // GET /api/commodity-futures — live commodity futures from TradingView
  router.get('/commodity-futures', async (_req: Request, res: Response) => {
    const cacheKey = 'commodity-futures';
    const cached = services.cache.get<any>(cacheKey);
    if (cached) { res.json(cached); return; }

    const COMMODITIES = [
      { ticker: 'COMEX:GC1!', name: 'Gold', flag: '🥇' },
      { ticker: 'COMEX:SI1!', name: 'Silver', flag: '🥈' },
      { ticker: 'NYMEX:CL1!', name: 'Crude Oil WTI', flag: '🛢️' },
      { ticker: 'NYMEX:BZ1!', name: 'Brent Oil', flag: '🛢️' },
      { ticker: 'COMEX:HG1!', name: 'Copper', flag: '🔶' },
      { ticker: 'NYMEX:NG1!', name: 'Natural Gas', flag: '🔥' },
      { ticker: 'CBOT:ZS1!', name: 'US Soybeans', flag: '🌱' },
      { ticker: 'CBOT:ZW1!', name: 'US Wheat', flag: '🌾' },
      { ticker: 'NYMEX:RB1!', name: 'Gasoline RBOB', flag: '⛽' },
    ];

    try {
      const payload = JSON.stringify({
        columns: ['close', 'change', 'change_abs', 'high', 'low'],
        symbols: { tickers: COMMODITIES.map(c => c.ticker) },
      });

      const fetchRes = await fetch('https://scanner.tradingview.com/global/scan', {
        method: 'POST',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });

      if (!fetchRes.ok) { res.status(503).json({ error: 'COMMODITIES_UNAVAILABLE' }); return; }
      const json = (await fetchRes.json()) as any;

      const commodities = json.data.map((item: any) => {
        const meta = COMMODITIES.find(c => c.ticker === item.s);
        const [price, changePct, changeAbs, high, low] = item.d;
        return {
          symbol: item.s,
          name: meta?.name || item.s,
          flag: meta?.flag || '',
          price: Math.round(price * 10000) / 10000,
          change: Math.round(changeAbs * 10000) / 10000,
          changePercent: Math.round(changePct * 100) / 100,
          high: Math.round(high * 10000) / 10000,
          low: Math.round(low * 10000) / 10000,
          direction: Math.abs(changePct) < 0.05 ? 'flat' : (changePct > 0 ? 'up' : 'down'),
        };
      });

      const result = { generatedAt: new Date().toISOString(), commodities };
      services.cache.set(cacheKey, result, 30);
      res.json(result);
    } catch {
      res.status(503).json({ error: 'COMMODITIES_UNAVAILABLE' });
    }
  });

  // POST /api/cache-analyst — inject pre-warmed analyst data into Node.js cache
  // Called by the prewarm script running on your laptop
  router.post('/cache-analyst', (req: Request, res: Response) => {
    const body = req.body;

    if (!body || !Array.isArray(body.stocks)) {
      res.status(400).json({ error: 'Expected { stocks: [...] }' });
      return;
    }

    const TTL_PREWARM = 24 * 60 * 60; // 24 hours — longer TTL for pre-warmed data
    let cached = 0;
    let skipped = 0;

    for (const stock of body.stocks) {
      if (!stock.symbol || !stock.data || stock.data.error) {
        skipped++;
        continue;
      }
      services.cache.set(`analyst:${stock.symbol}`, stock.data, TTL_PREWARM);
      cached++;
    }

    // Also invalidate top-picks cache so it rebuilds with fresh analyst data
    services.cache.invalidate(`top-picks:${SUPPORTED_SECURITIES.map(s => s.symbol).sort().join(',')}`);

    res.json({
      message: 'Cache populated',
      cached,
      skipped,
      ttlHours: 24,
    });
  });

  // GET /api/ai-analysis/:symbol — AI-powered stock analysis using Gemini
  router.get('/ai-analysis/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol as string;
    if (!validateSymbol(symbol, res)) return;

    if (!aiAnalysisService.isAvailable()) {
      res.status(503).json({ error: 'AI_UNAVAILABLE', message: 'Gemini API key not configured' });
      return;
    }

    try {
      // Gather all existing data (the RETRIEVAL step of RAG)
      const [analystData, srData, marketPulse, quotes] = await Promise.all([
        analystDataService.getAnalystData(symbol),
        (async () => {
          try {
            const hist = await yfService.getHistorical(symbol, '1y');
            if (hist.length < 30) return null;
            const closes = hist.map(d => d.close).filter(p => p > 0);
            const highs = hist.map(d => d.high).filter(p => p > 0);
            const lows = hist.map(d => d.low).filter(p => p > 0);
            const { computeSupportResistance: computeSR } = await import('../services/supportResistanceService.js');
            return computeSR(symbol, closes, highs, lows);
          } catch { return null; }
        })(),
        (async () => { try { return await marketPulseService.getPulse(); } catch { return null; } })(),
        yfService.getQuotes([symbol]),
      ]);

      const currentPrice = quotes[0]?.price ?? 0;
      const stockName = quotes[0]?.shortName ?? symbol.replace('.NS', '');

      // Build input for AI (combining all retrieved data)
      const input = {
        symbol,
        stockName,
        currentPrice,
        // Analyst
        analystCount: analystData?.numberOfAnalystOpinions,
        consensusRating: analystData?.recommendationKey,
        targetMeanPrice: analystData?.targetMeanPrice,
        targetHighPrice: analystData?.targetHighPrice,
        targetLowPrice: analystData?.targetLowPrice,
        upsidePercent: analystData && currentPrice > 0
          ? ((analystData.targetMeanPrice - currentPrice) / currentPrice) * 100
          : undefined,
        trailingPE: analystData?.trailingPE,
        forwardPE: analystData?.forwardPE,
        pegRatio: analystData?.pegRatio,
        revenueGrowth: analystData?.revenueGrowth,
        earningsGrowth: analystData?.earningsGrowth,
        profitMargins: analystData?.profitMargins,
        // Technicals
        rsi14: srData?.rsi14,
        macdSignal: srData?.macdSignal,
        sma20: srData?.sma20,
        sma50: srData?.sma50,
        sma200: srData?.sma200,
        support1: srData?.support1,
        resistance1: srData?.resistance1,
        buyRangeLow: srData?.buyRangeLow,
        buyRangeHigh: srData?.buyRangeHigh,
        verdict: srData?.verdict,
        // Market
        niftyChange: marketPulse?.indicators?.nifty50?.changePercent,
        fiiSentiment: marketPulse?.fiiDii?.fiiSentiment,
        overallMarketSentiment: marketPulse?.overallSentiment,
      };

      // GENERATE analysis using LLM
      const analysis = await aiAnalysisService.generateAnalysis(input);
      if (!analysis) {
        res.status(503).json({ error: 'AI_GENERATION_FAILED', symbol });
        return;
      }

      res.json(analysis);
    } catch (err) {
      res.status(503).json({
        error: 'AI_ANALYSIS_FAILED',
        symbol,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // GET /api/ai-stats — AI observability dashboard
  router.get('/ai-stats', (_req: Request, res: Response) => {
    res.json(getAIStats());
  });

  // GET /api/ai-logs — Recent AI call logs (for debugging)
  router.get('/ai-logs', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json(getAILogs(limit));
  });

  // GET /api/agent/deep-analysis — Multi-agent deep analysis (SSE streaming)
  router.get('/agent/deep-analysis', async (req: Request, res: Response) => {
    const symbol = req.query.symbol as string;

    if (!symbol) {
      res.status(400).json({ error: 'Expected ?symbol=RELIANCE.NS' });
      return;
    }

    if (!multiAgentService.isAvailable()) {
      res.status(503).json({ error: 'Multi-agent unavailable — no Gemini keys' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      await multiAgentService.deepAnalysis(symbol, (chunk: string) => {
        res.write(`data: ${JSON.stringify({ text: chunk + '\n' })}\n\n`);
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ error: 'Deep analysis failed' })}\n\n`);
    }

    res.end();
  });

  // GET /api/agent/stream — Streaming AI agent (Server-Sent Events)
  // Returns text word-by-word as Gemini generates it
  router.get('/agent/stream', async (req: Request, res: Response) => {
    const question = req.query.question as string;
    const sessionId = req.query.sessionId as string;

    if (!question) {
      res.status(400).json({ error: 'Expected ?question=...' });
      return;
    }

    if (!agentService.isAvailable()) {
      res.status(503).json({ error: 'AI agent unavailable' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Render's buffering
    res.flushHeaders();

    try {
      const result = await agentService.askStream(
        question,
        sessionId || 'anonymous',
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        },
      );

      if (result) {
        res.write(`data: ${JSON.stringify({ done: true, toolsUsed: result.toolsUsed, rounds: result.rounds })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ error: 'All models overloaded' })}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
    }

    res.end();
  });

  // POST /api/agent — Tool-calling AI agent that answers stock questions
  // Supports conversation memory via optional sessionId
  router.post('/agent', async (req: Request, res: Response) => {
    const { question, sessionId } = req.body ?? {};
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Expected { question: "your question here" }' });
      return;
    }

    if (!agentService.isAvailable()) {
      res.status(503).json({ error: 'AI agent unavailable — GEMINI_API_KEY not configured' });
      return;
    }

    try {
      const result = await agentService.ask(question, sessionId);
      if (!result) {
        res.status(503).json({ error: 'All AI models are currently overloaded. Please try again in 30 seconds.' });
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(503).json({
        error: 'Agent error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  return router;
}
