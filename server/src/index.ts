import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createCacheService } from './services/cacheService.js';
import { createYahooFinanceService } from './services/yahooFinanceService.js';
import { createMarketStatusService } from './services/marketStatusService.js';
import { createPredictionEngine } from './services/predictionEngine.js';
import { createAnalystDataService } from './services/analystDataService.js';
import { createMarketPulseService } from './services/marketPulseService.js';
import { createAIAnalysisService } from './services/aiAnalysisService.js';
import { createAgentService } from './services/agentService.js';
import { createApiRouter } from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: allow local dev + configured production origin
const corsOrigin = process.env.CORS_ORIGIN || '*';
const allowedOrigins = corsOrigin === '*'
  ? true
  : [
      ...corsOrigin.split(',').map(o => o.trim()),
      'http://localhost:5173',   // Vite dev server
      'http://localhost:3000',   // Alternate dev port
    ];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Create service instances
const cache = createCacheService();
const yfService = createYahooFinanceService(cache);
const marketStatusService = createMarketStatusService();
const predictionEngine = createPredictionEngine(cache);
const analystDataService = createAnalystDataService(cache);
const marketPulseService = createMarketPulseService(cache);
const aiAnalysisService = createAIAnalysisService(cache);
const agentService = createAgentService(cache, analystDataService, yfService, marketPulseService);

// Check Python service availability on startup
analystDataService.isAvailable().then((available) => {
  if (available) {
    console.log('✓ Python yfinance microservice detected');
    // Auto-prewarm: fetch analyst data for top stocks on startup
    autoPrewarm();
  } else {
    console.log('⚠ Python yfinance microservice not available. Real analyst data disabled.');
    console.log('  To enable: cd python-service && pip3 install -r requirements.txt && python3 app.py');
  }
});

// Auto-prewarm analyst data on server startup (runs in background)
async function autoPrewarm() {
  const TOP_STOCKS = [
    'RELIANCE.NS', 'HDFCBANK.NS', 'TCS.NS', 'SBIN.NS', 'ICICIBANK.NS',
    'HAL.NS', 'BHARTIARTL.NS', 'TATAMOTORS.NS', 'TVSMOTOR.NS', 'DABUR.NS',
    'INFY.NS', 'ITC.NS', 'LT.NS', 'INDHOTEL.NS', 'TATAPOWER.NS',
  ];

  console.log(`[Prewarm] Starting auto-prewarm for ${TOP_STOCKS.length} stocks...`);
  let success = 0;
  let failed = 0;

  for (const symbol of TOP_STOCKS) {
    try {
      const data = await analystDataService.getAnalystData(symbol);
      if (data) {
        success++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    // Small delay between requests to avoid overwhelming the Python service
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[Prewarm] Complete: ${success} success, ${failed} failed`);
}

// Wire up API routes
const apiRouter = createApiRouter({
  yfService,
  marketStatusService,
  predictionEngine,
  analystDataService,
  marketPulseService,
  aiAnalysisService,
  agentService,
  cache,
});
app.use('/api', apiRouter);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
