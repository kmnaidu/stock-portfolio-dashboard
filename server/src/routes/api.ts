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

const VALID_SYMBOLS: Set<string> = new Set(SUPPORTED_SECURITIES.map((s) => s.symbol));
const VALID_RANGES = new Set<string>(['1d', '1w', '1mo', '3mo', '6mo', '1y']);

function validateSymbol(symbol: string, res: Response): boolean {
  if (!VALID_SYMBOLS.has(symbol)) {
    res.status(400).json({
      error: 'INVALID_SYMBOL',
      message: `Symbol '${symbol}' is not supported. Valid symbols: ${[...VALID_SYMBOLS].join(', ')}`,
    });
    return false;
  }
  return true;
}

export function createApiRouter(services: {
  yfService: YFService;
  marketStatusService: MarketStatusService;
  predictionEngine: PredictionEngine;
  cache: CacheService;
}): Router {
  const { yfService, marketStatusService, predictionEngine } = services;
  const router = Router();

  // GET /api/health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // GET /api/quotes — real-time quotes for all 7 securities
  router.get('/quotes', async (_req: Request, res: Response) => {
    try {
      const symbols = SUPPORTED_SECURITIES.map((s) => s.symbol);
      const quotes = await yfService.getQuotes(symbols);
      res.json(quotes);
    } catch {
      res.status(503).json({ error: 'DATA_UNAVAILABLE', message: 'Failed to fetch quotes' });
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

  return router;
}
