import express from 'express';
import cors from 'cors';
import { createCacheService } from './services/cacheService.js';
import { createYahooFinanceService } from './services/yahooFinanceService.js';
import { createMarketStatusService } from './services/marketStatusService.js';
import { createPredictionEngine } from './services/predictionEngine.js';
import { createApiRouter } from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Create service instances
const cache = createCacheService();
const yfService = createYahooFinanceService(cache);
const marketStatusService = createMarketStatusService();
const predictionEngine = createPredictionEngine(cache);

// Wire up API routes
const apiRouter = createApiRouter({
  yfService,
  marketStatusService,
  predictionEngine,
  cache,
});
app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
