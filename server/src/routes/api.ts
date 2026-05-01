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
  cache: CacheService;
}): Router {
  const { yfService, marketStatusService, predictionEngine, analystDataService, marketPulseService } = services;
  const router = Router();

  // GET /api/health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
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

      // Fetch analyst data in parallel batches
      const batchSize = 5;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (symbol) => {
            const analyst = await analystDataService.getAnalystData(symbol);
            const quote = quoteMap.get(symbol);
            if (!quote) return null;

            const currentPrice = quote.price;

            // Try to find friendly name from SUPPORTED_SECURITIES, fallback to quote shortName
            const security = SUPPORTED_SECURITIES.find((s) => s.symbol === symbol);
            const name = security?.name ?? quote.shortName ?? symbol.replace('.NS', '');
            const sector = security?.sector ?? 'Other';

            if (!analyst || analyst.targetMeanPrice <= 0 || analyst.numberOfAnalystOpinions === 0) {
              return {
                symbol,
                name,
                sector,
                currentPrice,
                hasAnalystData: false,
                numberOfAnalystOpinions: 0,
              };
            }

            const upsidePercent = ((analyst.targetMeanPrice - currentPrice) / currentPrice) * 100;

            return {
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
            };
          })
        );
        results.push(...batchResults.filter(r => r !== null));
      }

      const withAnalyst = results.filter((r: any) => r.hasAnalystData);
      const withoutAnalyst = results.filter((r: any) => !r.hasAnalystData);

      withAnalyst.sort((a: any, b: any) => b.upsidePercent - a.upsidePercent);

      const response = {
        withAnalystData: withAnalyst,
        withoutAnalystData: withoutAnalyst,
        generatedAt: new Date().toISOString(),
      };

      services.cache.set(cacheKey, response, 3600);
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

  return router;
}
