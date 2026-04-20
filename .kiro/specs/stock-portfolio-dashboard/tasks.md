# Implementation Plan: Stock Portfolio Dashboard

## Overview

This plan builds a real-time Indian stock market portfolio dashboard in incremental phases. Each phase is designed so that the code compiles and runs at every step — no orphaned or hanging code. We start with the shared foundation (types, config, project scaffolding), then build the backend services bottom-up (cache → Yahoo Finance → predictions → market status → API routes), followed by the frontend layer (context/state → components → pages → polling/connectivity). Testing tasks are woven in close to the code they validate.

The tech stack is Node.js + Express + TypeScript on the backend, React + React Router + Recharts + TypeScript on the frontend, Vite for builds, and fast-check + Vitest for testing.

## Tasks

- [x] 1. Scaffold project structure and shared configuration
  - Initialize a monorepo-style project with two directories: `server/` (Express backend) and `client/` (React frontend via Vite)
  - Set up `tsconfig.json` for both server and client with strict mode enabled
  - Install core dependencies: `express`, `yahoo-finance2`, `cors` for server; `react`, `react-dom`, `react-router-dom`, `recharts` for client; `vitest`, `fast-check`, `@testing-library/react`, `jsdom` as dev dependencies
  - Create `shared/types.ts` with all data model interfaces from the design: `QuoteData`, `HistoricalDataPoint`, `PredictionData`, `RecommendationData`, `PortfolioSummary`, `MarketStatus`, and the `SUPPORTED_SECURITIES` constant array
  - Why: Everything else depends on these shared types and the project skeleton. Getting this right first means every subsequent task can import types and run without errors.
  - _Requirements: 1.3, 2.1, 3.1, 4.2, 5.3, 6.1_

- [ ] 2. Implement backend services (bottom-up, each service is independently testable)
  - [x] 2.1 Implement the Cache Service
    - Create `server/src/services/cacheService.ts` implementing the `CacheService` interface from the design
    - Use a `Map<string, { value: T, expiresAt: number }>` for storage. `get` returns `null` when TTL has expired. `set` stores value with `Date.now() + ttlSeconds * 1000`. `invalidate` and `invalidateAll` clear entries.
    - Why: The cache is the innermost dependency — Yahoo Finance service, predictions, and API routes all rely on it. Building it first lets us test caching behavior in isolation before anything calls Yahoo Finance.
    - _Requirements: 7.1_

  - [ ]* 2.2 Write unit tests for Cache Service
    - Test TTL expiration (set a value with short TTL, wait, verify `get` returns null)
    - Test cache hit (set and immediately get)
    - Test `invalidate` removes a single key, `invalidateAll` clears everything
    - _Requirements: 7.1_

  - [x] 2.3 Implement the Market Status Service
    - Create `server/src/services/marketStatusService.ts` implementing `MarketStatusService`
    - Implement `getStatus()` that computes the current IST time (`new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })`), checks against a static NSE holiday list (array of ISO date strings for the current year), and returns the correct status: `pre-market` (9:00–9:15), `open` (9:15–15:30), `post-market` (15:30–16:00), `closed` (all other times, weekends, holidays)
    - Implement `isMarketOpen()` as a convenience wrapper
    - Why: Market status drives polling behavior on the frontend and cache TTL decisions on the backend. It's a pure function of time with no external dependencies, making it easy to test.
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.4 Write property test for Market Status Service
    - **Property 10: Market status determination**
    - Generate random IST timestamps across all hours/days. Verify: weekdays 9:00–9:15 → `pre-market`, 9:15–15:30 → `open`, 15:30–16:00 → `post-market`, else → `closed`. Weekends/holidays → always `closed`.
    - **Validates: Requirements 6.1**

  - [x] 2.5 Implement the Yahoo Finance Service
    - Create `server/src/services/yahooFinanceService.ts` implementing `YFService`
    - `getQuotes(symbols)`: calls `yahooFinance.quote(symbols)`, maps response to `QuoteData[]`. Handles missing fields gracefully (default to 0).
    - `getHistorical(symbol, range)`: calls `yahooFinance.chart(symbol, queryOptions)` with appropriate `period1`/`period2`/`interval` based on the range parameter. Maps to `HistoricalDataPoint[]`.
    - `getRecommendations(symbol)`: calls `yahooFinance.quoteSummary(symbol, { modules: ['recommendationTrend', 'financialData'] })`. Extracts analyst recommendations and computes consensus rating.
    - `getQuoteSummary(symbol)`: calls `yahooFinance.quoteSummary(symbol, { modules: ['defaultKeyStatistics', 'financialData'] })`. Extracts 52-week high/low, market cap, P/E, dividend yield.
    - Integrate with `CacheService` — check cache before calling Yahoo Finance, store results with appropriate TTLs from the design (quotes: 10s, historical: 1hr, recommendations: 6hr).
    - Why: This is the data backbone. All API routes delegate to this service. Wrapping yahoo-finance2 in our own interface lets us mock it easily in tests and swap providers later.
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 4.1, 5.3_

  - [x] 2.6 Implement the Prediction Engine
    - Create `server/src/services/predictionEngine.ts` implementing `PredictionEngine`
    - Implement simple linear regression: given an array of closing prices, compute slope and intercept using least-squares formula. Extrapolate to 7 days (1w), 30 days (1mo), and 90 days (3mo).
    - Compute R² (coefficient of determination) from the regression. Scale to 0–100 for confidence. Apply a floor of 10% for R² < 0.1.
    - Return a `PredictionSet` with exactly 3 predictions, each including `horizon`, `predictedPrice`, `confidence`, and `direction` (up/down/neutral based on predicted vs current price).
    - Cache predictions with a TTL that expires at the next market close.
    - Why: Predictions are a key differentiator of this dashboard. The linear regression approach is simple enough to implement and test, while still providing meaningful output. Isolating it as a service means we can upgrade the model later without touching API routes.
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

  - [ ]* 2.7 Write property test for Prediction Engine
    - **Property 5: Prediction engine output invariants**
    - Generate random arrays of at least 30 positive closing prices. Verify: exactly 3 predictions returned with horizons `1w`, `1mo`, `3mo`; each confidence is between 0 and 100 inclusive.
    - **Validates: Requirements 3.1, 3.2**

  - [x] 2.8 Implement the Consensus Rating computation
    - Create `server/src/services/consensusService.ts` (or add to yahooFinanceService)
    - Map ratings to numeric scores: Strong Buy=5, Buy=4, Hold=3, Sell=2, Strong Sell=1
    - Compute arithmetic mean of all scores, round to nearest integer, map back to rating string
    - Return `consensusRating` and `consensusScore` (the raw mean)
    - Why: This is a standalone computation that the recommendations endpoint needs. Extracting it makes it independently testable with property-based tests.
    - _Requirements: 4.3_

  - [ ]* 2.9 Write property test for Consensus Rating computation
    - **Property 7: Consensus rating computation**
    - Generate random non-empty arrays of ratings from {Strong Buy, Buy, Hold, Sell, Strong Sell}. Verify: consensus score equals arithmetic mean of numeric scores; consensus rating matches the rounded mean mapped back to a rating string.
    - **Validates: Requirements 4.3**

  - [x] 2.10 Implement REST API routes
    - Create `server/src/routes/api.ts` with Express Router
    - Implement all 7 endpoints from the design: `/api/quotes`, `/api/quotes/:symbol`, `/api/historical/:symbol`, `/api/predictions/:symbol`, `/api/recommendations/:symbol`, `/api/market-status`, `/api/summary/:symbol`
    - Add input validation: reject symbols not in `SUPPORTED_SECURITIES` with HTTP 400
    - Add error handling middleware: catch Yahoo Finance failures, return appropriate HTTP status codes (503 for data unavailable, 400 for invalid input) per the design's error handling table
    - Add a `/api/health` endpoint returning `{ status: 'ok' }`
    - Create `server/src/index.ts` as the Express app entry point — wire up CORS, JSON parsing, routes, and start listening on a configurable port
    - Why: The API routes are the glue between all backend services and the frontend. With all services built, we can now expose them as HTTP endpoints. Input validation and error handling ensure the frontend always gets predictable responses.
    - _Requirements: 1.1, 1.5, 1.6, 3.6, 4.6, 5.1, 5.3_

- [x] 3. Checkpoint — Backend complete
  - Ensure all backend tests pass, ask the user if questions arise.
  - Verify the server starts without errors and all API endpoints return valid responses.

- [ ] 4. Implement frontend foundation (state management, polling, connectivity)
  - [x] 4.1 Set up React app shell with routing
    - Create the Vite React+TypeScript project in `client/`
    - Set up React Router with two routes: `/` (Dashboard page) and `/stock/:symbol` (Stock Detail page)
    - Create a persistent `Header` component with placeholder slots for market status and IST clock
    - Create placeholder page components (`DashboardPage`, `StockDetailPage`) that render route-specific headings
    - Why: The app shell and routing are the skeleton that every other frontend component plugs into. Getting navigation working first means we can incrementally add real content to each page.
    - _Requirements: 2.4, 5.1_

  - [x] 4.2 Implement PortfolioContext and the useStockPoller hook
    - Create `client/src/context/PortfolioContext.tsx` providing `PortfolioContextValue` (quotes map, market status, connectivity state, lastUpdated, refreshAll)
    - Create `client/src/hooks/useStockPoller.ts` that polls `/api/quotes` every 15 seconds during market hours. On each successful response, update the quotes map in context. Track `isConnected` and `lastUpdated`.
    - Implement connectivity detection: listen to `window.online`/`window.offline` events; if 3 consecutive poll failures occur, set `isConnected = false`. On reconnection, force an immediate full refresh.
    - Why: Centralized state and polling are the heartbeat of the dashboard. Every component reads from this context, so building it before any UI components means we can test data flow end-to-end with the backend.
    - _Requirements: 1.1, 1.2, 2.2, 7.1, 7.2, 7.3, 7.4_

  - [x] 4.3 Implement the Header component with market status and connectivity banner
    - Fetch `/api/market-status` on mount and at 30-second intervals
    - Display market status badge (color-coded: green for open, red for closed, yellow for pre/post-market)
    - Display current IST time, updating every second via `setInterval`
    - Display "Connection Lost" banner when `isConnected` is false, with stale data indicator
    - Why: The header is always visible and gives the user immediate context about market state and data freshness. It's also the first real component that consumes the PortfolioContext.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.2, 7.3_

- [ ] 5. Implement Dashboard page (portfolio overview)
  - [x] 5.1 Implement the PortfolioSummary card
    - Create `client/src/components/PortfolioSummary.tsx`
    - Compute total portfolio value (sum of all prices), total daily change (sum of all change values), total daily change percent, and securities count from the quotes map in context
    - Display all four metrics with green/red coloring for gain/loss
    - Why: This is the first thing the user sees — a quick health check of their entire portfolio. It exercises the portfolio computation logic that we'll also validate with property tests.
    - _Requirements: 2.1, 2.2_

  - [ ]* 5.2 Write property test for Portfolio Summary computation
    - **Property 3: Portfolio summary computation**
    - Generate random arrays of QuoteData with positive prices and arbitrary change values. Verify: `totalValue` = sum of prices, `totalDailyChange` = sum of changes, `totalDailyChangePercent` = `(totalDailyChange / (totalValue - totalDailyChange)) * 100`, `securitiesCount` = array length.
    - **Validates: Requirements 2.1**

  - [x] 5.3 Implement the StockGrid (sortable table) and StockRow components
    - Create `client/src/components/StockGrid.tsx` — a table displaying all 7 securities with columns: name, current price, change, change %, day high, day low, volume
    - Implement sorting: clicking a column header toggles ascending/descending sort. Support sorting by name, price, dailyChangePercent, and volume.
    - Create `client/src/components/StockRow.tsx` — renders a single security row. Implements price change animation: compare new price to previous price, apply a 600ms CSS transition (green flash for up, red flash for down).
    - Each row is clickable, navigating to `/stock/:symbol` via React Router
    - Display "Last Updated" timestamp per security
    - Display "Data Unavailable" indicator if a security's data failed to load
    - Why: The stock grid is the core interactive element of the dashboard. Sorting and price animations make it feel alive and responsive. Linking rows to the detail view completes the primary navigation flow.
    - _Requirements: 1.3, 1.4, 1.6, 2.3, 2.4, 7.1_

  - [ ]* 5.4 Write property test for price direction indicator
    - **Property 2: Price direction indicator correctness**
    - Generate random pairs of (previousClose, currentPrice) as positive numbers. Verify: green/up style when currentPrice > previousClose, red/down style when currentPrice < previousClose, neutral when equal.
    - **Validates: Requirements 1.4**

  - [ ]* 5.5 Write property test for sorting correctness
    - **Property 4: Securities list sorting correctness**
    - Generate random arrays of QuoteData and random sort configurations (field + direction). Verify: every consecutive pair in the sorted output respects the ordering.
    - **Validates: Requirements 2.3**

  - [ ]* 5.6 Write property test for quote data rendering completeness
    - **Property 1: Quote data rendering completeness**
    - Generate random QuoteData objects. Render a StockRow component. Verify the rendered output contains all 6 data points: price, change, change %, day high, day low, volume.
    - **Validates: Requirements 1.3**

- [x] 6. Checkpoint — Dashboard page complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify the dashboard loads, displays all 7 securities, sorting works, and price animations trigger on data updates.

- [ ] 7. Implement Stock Detail page
  - [x] 7.1 Implement the PriceHeader component
    - Create `client/src/components/StockDetail/PriceHeader.tsx`
    - Display the security's live price, absolute change, percentage change, and market state
    - Apply green/red styling based on price direction
    - Show "Market Closed — Last closing price" label when market is closed
    - Why: The price header anchors the detail view with the most critical real-time information. It reuses the same price direction logic from StockRow, keeping behavior consistent.
    - _Requirements: 1.3, 1.4, 1.5, 5.1_

  - [x] 7.2 Implement the Interactive Price Chart
    - Create `client/src/components/StockDetail/PriceChart.tsx` using Recharts
    - Fetch historical data from `/api/historical/:symbol` with the selected range
    - Render a line/area chart with time on X-axis and price on Y-axis
    - Add time range selector buttons: 1D, 1W, 1M, 3M, 6M, 1Y — each fetches the appropriate data range
    - Implement tooltip on hover showing exact price and date for the data point
    - Why: The chart is the centerpiece of the detail view. Recharts handles the heavy lifting of SVG rendering, but we need to wire up range selection and tooltip formatting. Interactive time ranges let users zoom in on recent activity or zoom out for long-term trends.
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 7.3 Implement the Prediction Panel
    - Create `client/src/components/StockDetail/PredictionPanel.tsx`
    - Fetch predictions from `/api/predictions/:symbol`
    - Display 3 prediction cards (1 week, 1 month, 3 months) each showing: predicted price, price change from current, confidence percentage (as a progress bar or badge), and direction arrow
    - Display the disclaimer text: "Predictions are model-generated estimates and not financial advice."
    - Handle "Prediction Unavailable" state gracefully
    - Why: Predictions are a key value-add. Showing confidence levels helps users calibrate trust. The disclaimer is a legal requirement from the requirements doc.
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

  - [x] 7.4 Implement the Recommendation List
    - Create `client/src/components/StockDetail/RecommendationList.tsx`
    - Fetch recommendations from `/api/recommendations/:symbol`
    - Display consensus rating prominently at the top (color-coded badge)
    - List individual recommendations sorted by date descending, each showing: firm name, rating, target price, and date
    - Handle "No Analyst Recommendations Available" state
    - Why: Analyst recommendations give users expert context alongside their own analysis. Sorting by date ensures the most recent opinions are visible first.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [ ]* 7.5 Write property test for recommendation rendering completeness
    - **Property 6: Recommendation rendering completeness**
    - Generate random RecommendationData objects. Render the RecommendationList. Verify each recommendation entry displays firm name, rating, target price, and date.
    - **Validates: Requirements 4.2**

  - [ ]* 7.6 Write property test for recommendations sorted by date
    - **Property 8: Recommendations sorted by date descending**
    - Generate random arrays of recommendation objects with arbitrary dates. Sort them. Verify every consecutive pair has the first date ≥ the second date.
    - **Validates: Requirements 4.4**

  - [x] 7.7 Implement the Key Metrics Panel
    - Create `client/src/components/StockDetail/MetricsPanel.tsx`
    - Fetch summary data from `/api/summary/:symbol`
    - Display 5 key metrics in a grid: 52-week high, 52-week low, market capitalization (formatted with ₹ and Cr/Lakh Cr suffixes), P/E ratio, and dividend yield (as percentage)
    - Why: These metrics give fundamental context that complements the price chart and predictions. Formatting large Indian currency values readably (e.g., ₹2.4 Lakh Cr) is important for the target audience.
    - _Requirements: 5.3_

  - [ ]* 7.8 Write property test for financial metrics rendering
    - **Property 9: Financial metrics rendering completeness**
    - Generate random SummaryData objects with arbitrary numeric values. Render the MetricsPanel. Verify the output contains all 5 metrics: 52-week high, 52-week low, market cap, P/E ratio, dividend yield.
    - **Validates: Requirements 5.3**

  - [x] 7.9 Wire up the Stock Detail page
    - Create `client/src/pages/StockDetailPage.tsx` composing all detail components: PriceHeader, PriceChart, PredictionPanel, RecommendationList, MetricsPanel
    - Extract the `:symbol` param from the URL, validate it against SUPPORTED_SECURITIES
    - Fetch all data on mount and subscribe to real-time quote updates from PortfolioContext for the live price header
    - Add a back navigation link to return to the dashboard
    - Why: This is the integration step — all the individual detail components are wired into a single cohesive page. Validating the symbol param prevents rendering errors for invalid URLs.
    - _Requirements: 2.4, 5.1_

- [x] 8. Checkpoint — Stock Detail page complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify navigation from dashboard to detail view works, all sections render, and chart interactions (range selection, tooltips) function correctly.

- [ ] 9. Implement responsive layout and final polish
  - [x] 9.1 Add responsive CSS for all breakpoints
    - Implement responsive styles for 320px (mobile), 768px (tablet), and 1024px+ (desktop)
    - On mobile (<768px): collapse the StockGrid into a card-based layout with vertical scrolling. Stack detail page sections vertically. Adjust chart dimensions for narrow screens.
    - On tablet (768px–1023px): use a 2-column grid for metrics and predictions. Keep table layout for StockGrid but reduce column count.
    - On desktop (1024px+): full table layout, side-by-side panels on detail page where appropriate.
    - Why: The requirements specify three breakpoints and a card-based mobile layout. Since we're Chrome-only, we can use modern CSS features like container queries and `gap` without worrying about compatibility.
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 9.2 Add manual refresh button and "Last Updated" display
    - Add a refresh button in the Header that calls `refreshAll()` from PortfolioContext
    - Ensure the refresh fetches all data and updates the display within 5 seconds
    - Display a global "Last Updated" timestamp in the header
    - Why: Manual refresh gives users control when they want immediate data, complementing the automatic 15-second polling. The timestamp builds trust in data freshness.
    - _Requirements: 7.1, 7.4_

  - [x] 9.3 Handle outside-market-hours display
    - When market is closed, show last closing price for each security with a "Market Closed" label
    - Reduce polling frequency to 60 seconds when market is closed (no need for 15-second updates)
    - Why: The dashboard should still be useful outside market hours, showing the most recent data with clear context that it's not live.
    - _Requirements: 1.5, 6.1_

- [x] 10. Final checkpoint — All features complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify end-to-end: dashboard loads with all 7 securities, sorting works, navigation to detail view works, charts render with range selection, predictions and recommendations display, responsive layout adapts at all breakpoints, connectivity loss/recovery is handled gracefully.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation — the app should be runnable after each checkpoint
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The backend is built bottom-up (cache → services → routes) so each layer can be tested independently
- The frontend is built inside-out (context/state → components → pages) so data flow is established before UI
