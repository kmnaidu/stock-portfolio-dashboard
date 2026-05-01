# 📋 Project Summary — Stock Portfolio Analyzer

**A comprehensive document covering what was built, deployed, and how it all works.**

---

## 🎯 Project Overview

**Goal:** Build a real-time Indian stock market dashboard for tracking investments, with live prices, institutional analyst recommendations, technical analysis, and portfolio P&L tracking.

**Approach:** Spec-driven development using AI-augmented engineering (Kiro AI IDE + Claude). From idea to production deployment in a single focused engineering session.

**Outcome:** Fully functional, deployed, production-grade web application accessible worldwide.

---

## 🌐 Production URLs & Services

### 🔗 Live Application

- **Frontend (User-facing):** https://stock-portfolio-analyzer-ten.vercel.app
- **Backend API:** https://stock-api-9ukf.onrender.com
- **Python Microservice:** https://stock-python-whf6.onrender.com
- **GitHub Repository:** https://github.com/kmnaidu/stock-portfolio-dashboard

### 🏢 Hosting Providers

| Service | Provider | Tier | Cost | Purpose |
|---------|----------|------|------|---------|
| Frontend (React) | **Vercel** | Free Hobby | ₹0 | Static site CDN with auto-deploy |
| Backend API (Node.js) | **Render** | Free | ₹0 | Express REST API server |
| Python Microservice | **Render** | Free | ₹0 | yfinance wrapper for analyst data |
| Residential Proxy | **ScraperAPI** | Free | ₹0 | Bypasses Yahoo's cloud IP blocks |
| DNS/Domain | Vercel default | Free | ₹0 | `*.vercel.app` subdomain |
| Source Control | **GitHub** | Free | ₹0 | Code repository, CI/CD trigger |

**Total monthly cost: ₹0** (entirely free tier)

### 🔐 Production Environment Variables

**On Render `stock-api` service:**
```
PYTHON_SERVICE_URL = https://stock-python-whf6.onrender.com
CORS_ORIGIN = *
NODE_VERSION = 20.11.0
```

**On Render `stock-python` service:**
```
SCRAPERAPI_KEY = <your ScraperAPI key>
PYTHON_VERSION = 3.11.0
```

**On Vercel (frontend):**
```
VITE_API_BASE_URL = https://stock-api-9ukf.onrender.com
```

---

## 🛠️ Technologies Used

### Frontend (User Interface)

- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool and dev server
- **React Router** — Page navigation (dashboard, stock detail)
- **Recharts** — Interactive price charts (1D, 1W, 1M, 3M, 6M, 1Y)
- **Context API** — Global state management (Portfolio, Watchlist)
- **CSS Variables** — Light/dark theme support

### Backend (API Server)

- **Node.js 20** — Runtime
- **Express** — HTTP server framework
- **TypeScript** — Type safety
- **tsx** — TypeScript runner (runs .ts directly in production, no build step)
- **cors** — CORS middleware for frontend-backend communication

### Python Microservice

- **Python 3.11** — Runtime
- **Flask** — Web framework
- **Gunicorn** — Production WSGI server
- **yfinance** — Yahoo Finance Python library for analyst data
- **curl_cffi** — HTTP client with Chrome TLS fingerprinting (bypasses Yahoo bot detection)

### Data Sources

- **Yahoo Finance v8 Chart API** — Live prices, historical OHLC (direct, no auth)
- **yfinance via ScraperAPI** — Analyst targets, P/E, fundamentals, recommendations
- **NSE India API** — FII/DII institutional flow data
- **Static holiday calendar** — NSE 2025-2026 trading days

### Testing

- **Vitest** — Unit test runner
- **fast-check** — Property-based testing
- **Cypress** — End-to-end functional testing
- **@testing-library/react** — React component testing

### DevOps & Deployment

- **Git** — Source control
- **GitHub** — Repository hosting, auto-trigger deployments
- **render.yaml** — Infrastructure-as-code (Render Blueprint)
- **Vercel CI/CD** — Automatic frontend deployment on git push

---

## 🏗️ System Architecture

### How data flows through the system

```
┌─────────────────────────────────────────────────────────────┐
│                    User Action                              │
│  (Opens dashboard, clicks a stock, adds holdings, etc.)     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        React Frontend (Vercel)                              │
│        - Renders UI                                          │
│        - Polls backend every 15s for live prices            │
│        - Reads/writes watchlist in browser localStorage     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTPS REST calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        Node.js API (Render)                                 │
│        Endpoints:                                           │
│        - /api/quotes (live prices)                          │
│        - /api/historical/:symbol (charts)                   │
│        - /api/analyst/:symbol (analyst data)                │
│        - /api/top-picks (ranked stocks)                     │
│        - /api/market-pulse (macro indicators)               │
│        - /api/support-resistance/:symbol                    │
│        - /api/predictions/:symbol                           │
│        - /api/growth-potential/:symbol                      │
│                                                             │
│        In-memory cache with TTL per data type               │
└───────────┬──────────────────────────────┬──────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────┐  ┌────────────────────────────────────┐
│ Yahoo Finance v8    │  │ Python Microservice (Render)       │
│ (direct, no auth)   │  │ - yfinance library                 │
│ - Live prices       │  │ - Fetches analyst data             │
│ - Historical OHLC   │  │ - 24-hour cache                    │
│ - 52-week high/low  │  └─────────────┬──────────────────────┘
└─────────────────────┘                │
                                       ▼
                          ┌─────────────────────────────────┐
                          │ ScraperAPI                      │
                          │ Routes through residential IPs  │
                          │ Bypasses Yahoo's cloud blocks   │
                          └─────────────┬───────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────────────┐
                          │ Yahoo Finance v10 Quote Summary │
                          │ - Target prices                 │
                          │ - Analyst recommendations       │
                          │ - Fundamentals (P/E, EPS, etc.) │
                          └─────────────────────────────────┘
```

---

## ⚡ What Each Service Does

### 🖥️ Frontend (React on Vercel)

- Displays the dashboard UI
- Sends API requests to backend every 15 seconds for live prices
- Stores user's watchlist and portfolio in browser localStorage
- Handles theme switching (light/dark mode)
- Implements responsive layout (mobile/tablet/desktop)
- **URL:** https://stock-portfolio-analyzer-ten.vercel.app

### 🔧 Backend (Node.js on Render)

- Exposes REST API endpoints for the frontend
- Fetches live prices directly from Yahoo Finance v8 (no auth required)
- Calls Python microservice for analyst data (via internal HTTPS)
- Performs technical analysis (support/resistance, predictions, growth potential)
- Aggregates market pulse data (oil, rupee, FII/DII)
- Caches all responses in memory with different TTLs
- **URL:** https://stock-api-9ukf.onrender.com

### 🐍 Python Microservice (Flask on Render)

- Wraps yfinance library to fetch Yahoo's deep data (analyst targets, fundamentals)
- Uses curl_cffi to mimic Chrome TLS fingerprint
- Routes requests through ScraperAPI when deployed (residential IPs)
- Caches responses for 24 hours to minimize API calls
- **URL:** https://stock-python-whf6.onrender.com

### 🌐 ScraperAPI (External)

- Routes HTTP requests through residential IPs worldwide
- Bypasses Yahoo's datacenter IP blocks
- 5,000 free credits/month (each Yahoo call uses ~10 credits)

---

## 📦 Features Implemented

### 1. Market Pulse Dashboard
- **Nifty 50 & Sensex** live prices with daily change
- **Brent Crude Oil** price (inverse indicator for India)
- **USD/INR** exchange rate (inverse indicator)
- **FII/FPI net flows** — Foreign institutional buying/selling
- **DII net flows** — Domestic institutional buying/selling
- **Overall verdict:** Bullish / Bearish / Neutral with weighted score

### 2. Portfolio Holdings
- Add quantity and average buy price per stock
- Real-time P&L calculation (total invested, current value, profit/loss, return %)
- Sortable holdings list
- Persisted in browser localStorage

### 3. Top Picks with Analyst Consensus
- Ranks stocks by analyst-predicted 1-year upside
- Highlights stocks with 20%+ expected returns
- Shows analyst count, target range, consensus rating
- Separates stocks with analyst coverage vs ETFs

### 4. Stock Grid
- Live prices for all watchlist stocks
- Color-coded gains (green) / losses (red)
- Sortable by name, price, change %, volume
- Click any row to see detailed analysis
- "+ Holdings" button to track your investment

### 5. Stock Detail Page (Per-Stock Analysis)
Each stock's detail page includes:

- **🏛️ Institutional Analyst View** (real data)
  - Consensus: Strong Buy / Buy / Hold / Sell / Strong Sell
  - Number of analysts (typically 20-40)
  - Target price (mean/high/low/median)
  - Upside percentage from current price
  - Rating distribution (Strong Buy/Buy/Hold/Sell/Strong Sell counts)
  - Valuation: P/E (TTM), Forward P/E, P/B, PEG ratio, EPS, Book Value
  - Growth: Revenue growth, earnings growth, profit margins, ROE
  - Market data: Market cap, Beta, dividend yield
  - Industry classification

- **Support & Resistance Panel**
  - Classic floor pivots (S1/S2/S3 support, R1/R2/R3 resistance)
  - Pivot point
  - Buy range recommendation (entry zone)
  - Overall verdict (Buy/Hold/Sell)
  - Technical indicators: RSI (14), MACD signal, SMA 20/50/200

- **1-Year Growth Potential**
  - Combines analyst target with technical scores
  - Rating: High Potential / Moderate / Low / Risky
  - Confidence score (0-100%)
  - Score breakdown: historical growth, mean reversion, trend strength, risk-adjusted returns
  - Bollinger Bands (upper/middle/lower with position)
  - Volume analysis (today vs 20-day average, trends, OBV)

- **Interactive Price Chart**
  - Recharts-powered area chart
  - 6 time ranges: 1D, 1W, 1M, 3M, 6M, 1Y
  - Hover tooltip with exact price and date

- **Short-Term Predictions**
  - 1-week, 1-month, 3-month price forecasts
  - Linear regression on historical prices
  - Confidence level based on R²

- **Technical Analysis Signals**
  - 4 signal-based ratings:
    - Moving Average Analysis (vs 20/50 SMA)
    - Momentum Analysis (30-day change)
    - Short-Term Trend (7-day change)
    - Volatility Assessment

- **Key Metrics**
  - 52-week high and low prices

### 6. Watchlist Management
- Add any NSE/BSE stock (auto-appends `.NS` if needed)
- Search from 70+ popular Indian stocks
- Remove stocks from watchlist
- Reset to default 32 stocks
- All changes sync immediately with dashboard

### 7. User Experience
- **Dark mode** toggle (persists in localStorage)
- **Mobile responsive** layout
- **Auto-refresh** every 15 seconds during market hours
- **Last updated** timestamp with IST time zone
- **Connection lost** banner if backend unreachable
- **Market status badge** (open/closed/pre-market/post-market)

---

## 🧪 Testing Implementation

### Unit Tests (90 tests total)

**Server tests (42 tests):**
- `cacheService.test.ts` — Cache TTL, get/set, invalidation (8 tests)
- `consensusService.test.ts` — Rating calculation logic (11 tests)
- `marketStatusService.test.ts` — Market open/closed detection (14 tests)
- `predictionEngine.test.ts` — Linear regression math (9 tests)

**Client tests (48 tests):**
- `PortfolioSummary.test.ts` — Portfolio computation (7 tests)
- `StockGrid.test.ts` — Sorting and filtering (12 tests)
- `StockRow.test.ts` — Price direction calculation (8 tests)
- `RecommendationList.test.ts` — Date sorting (6 tests)
- `MetricsPanel.test.ts` — Market cap formatting (5 tests)
- `PortfolioContext.test.tsx` — Context provider (2 tests)
- `useStockPoller.test.tsx` — Polling hook behavior (8 tests)

**Run tests:**
```bash
cd server && npm test    # Expected: Tests 42 passed
cd client && npm test    # Expected: Tests 48 passed
```

### Functional Tests (40+ tests with Cypress)

**Dashboard tests (`dashboard.cy.ts`):**
- Page load verification
- Portfolio summary display
- Stock grid with all 7 securities
- Sorting (click column headers)
- Refresh button
- Navigation to detail pages

**Stock detail tests (`stock-detail.cy.ts`):**
- Price header with live data
- Interactive chart with 6 time ranges
- Predictions panel with 3 forecasts
- Recommendations with consensus badge
- Key metrics panel

**Responsive tests (`responsive.cy.ts`):**
- Mobile (320px) — card layout
- Tablet (768px) — hidden columns
- Desktop (1280px) — full table

**Navigation tests (`navigation.cy.ts`):**
- Direct URL access
- Invalid symbol handling
- Back navigation
- Cross-page link behavior

**Run tests:**
```bash
cd client
npm run cy:open    # Interactive mode with Chrome
npm run cy:run     # Headless mode
```

---

## 🚢 Deployment Journey

### Step 1: Backend deployed to Render
1. Connected GitHub repo to Render via Blueprint (`render.yaml`)
2. Created two services: `stock-python` (Python) and `stock-api` (Node.js)
3. Configured environment variables (PYTHON_SERVICE_URL, SCRAPERAPI_KEY, etc.)
4. Services auto-deploy on every `git push` to main branch

### Step 2: Frontend deployed to Vercel
1. Connected GitHub repo to Vercel
2. Set root directory to `client`
3. Framework auto-detected as Vite
4. Added `VITE_API_BASE_URL` environment variable
5. Auto-deploys on every `git push` to main

### Step 3: Solved Yahoo Finance rate limiting
1. Discovered Yahoo blocks datacenter IPs (Render's IPs)
2. Signed up for ScraperAPI (free tier: 5K credits/month)
3. Updated Python service to route through ScraperAPI
4. Added `curl_cffi` for browser TLS fingerprinting
5. Configured 24-hour cache to minimize API usage

### Step 4: CORS configuration
- Set `CORS_ORIGIN = *` on backend to allow Vercel frontend
- Note: For production, restrict to specific Vercel URL

### Step 5: Testing and verification
- Verified frontend loads on laptop and mobile
- Confirmed live prices update every 15 seconds
- Analyst data works (with occasional rate limits on free tier)

---

## 📊 Development Workflow

### Using Spec-Driven Development

**Phase 1: Requirements (`/.kiro/specs/stock-portfolio-dashboard/requirements.md`)**
- 8 EARS-compliant user stories
- Acceptance criteria for each feature
- Explicit scope and non-goals

**Phase 2: Design (`.kiro/specs/stock-portfolio-dashboard/design.md`)**
- Architecture diagrams
- API endpoint contracts
- Data models (TypeScript interfaces)
- 10 formal correctness properties
- Caching strategy
- Error handling matrix

**Phase 3: Tasks (`.kiro/specs/stock-portfolio-dashboard/tasks.md`)**
- 30+ implementation tasks across 10 phases
- Clear dependencies between tasks
- Checkpoints for incremental validation

**Phase 4: Implementation**
- Built task-by-task, one at a time
- App was runnable after each phase
- Tests written alongside code

**Phase 5: Testing**
- 90 unit tests + 40 functional tests
- Property-based tests for correctness
- Continuous verification during development

**Phase 6: Deployment**
- Infrastructure-as-code via `render.yaml`
- Automatic CI/CD via Git push
- Environment-specific configuration

---

## ⚠️ Known Limitations

### Free tier constraints

1. **Render services sleep after 15 minutes of inactivity**
   - First user after sleep waits 30-60 seconds for services to wake
   - Solution: [UptimeRobot](https://uptimerobot.com) free tier pings every 5 min
   - Trade-off: Uses ~720 of 750 free hours/month (leaving 30h buffer)

2. **ScraperAPI free tier: 5,000 credits/month**
   - Each analyst call uses ~10 credits
   - Effective limit: ~500 stock analyst fetches/month
   - With 24-hour cache: sufficient for personal use
   - Sometimes returns "Rate Limited" errors

3. **Yahoo Finance rate limits**
   - Free API has usage limits (even via ScraperAPI)
   - Individual stock pages work reliably
   - Top Picks (31 stocks at once) may hit limits intermittently

### Trade-offs accepted

- **Analyst data is "best effort" in production** — works most of the time, occasional unavailability
- **Cache is shared across users** — your browsing populates cache for other users too
- **Watchlist is browser-local** — each user has their own list; not shared across devices

---

## 🎯 How to Use the Dashboard

### For viewing your portfolio:

1. Open https://stock-portfolio-analyzer-ten.vercel.app
2. Click **⭐ Watchlist** in the header to customize which stocks to track
3. Click **+ Holdings** next to any stock to record your quantity and buy price
4. View real-time P&L in the "My Portfolio Holdings" card

### For making investment decisions:

1. Check **Market Pulse** at the top — is the overall market bullish/bearish?
2. Look at **Top Picks** — which stocks have 20%+ analyst upside?
3. Click a specific stock to see:
   - Real analyst consensus (what 30+ experts think)
   - Support/resistance levels (when to buy)
   - Technical indicators (RSI, MACD, SMAs)
   - 1-year growth potential (combining both)
4. Use the **Buy Range** recommendation to time your entry
5. Cross-reference with your own research and risk tolerance

### For mobile access:

Open the Vercel URL in Chrome on your phone. The responsive layout adapts automatically. You can:
- Bookmark the URL on your phone's home screen
- Share the link with friends — they'll get their own watchlist/holdings

---

## 💰 Cost Breakdown (Monthly)

| Service | Free Tier | Paid Upgrade Path | Notes |
|---------|-----------|-------------------|-------|
| Vercel | ₹0 | ~₹1,600/mo (Pro) | 100 GB bandwidth free |
| Render (x2 services) | ₹0 | ₹580/mo × 2 (Starter) | 750 hours/mo free each |
| ScraperAPI | ₹0 | ₹4,000/mo (Hobby) | 5K credits/mo free |
| GitHub | ₹0 | — | Free for public repos |
| UptimeRobot | ₹0 | — | 50 free monitors |
| **Total** | **₹0** | **~₹6,180/mo** | For 24/7 always-on production |

You're running it all free right now. Upgrade only if usage grows beyond personal/friend-sharing.

---

## 🔮 Future Enhancement Ideas

### High priority
1. **Price alerts** — Browser notifications on price crossings
2. **News feed** — Recent news per stock (via RSS or free news API)
3. **Better data source** — Integrate Dhan/Tickertape API for reliable Indian stock data

### Medium priority
4. **Portfolio PDF export** — Monthly P&L statements for tax filing
5. **Sector comparison** — Outperformer/laggard analysis
6. **Stock screener** — Filter by P/E, growth, dividend, etc.

### Low priority
7. **Watchlist sharing** — Share your watchlist with friends via URL
8. **Earnings calendar** — Upcoming quarterly results
9. **Multi-portfolio support** — Track multiple portfolios (e.g., Long-term vs Trading)

---

## 📞 Support & Contributions

If you want to:
- **Report a bug** — Open an issue on GitHub
- **Request a feature** — Open an issue on GitHub
- **Contribute code** — Submit a pull request
- **Ask a question** — Reach out via GitHub or LinkedIn

---

## 📝 Final Notes

**What makes this project impressive:**

1. **Full-stack application** — Not a tutorial, but a real working product
2. **Deployed end-to-end** — Not just local demo, accessible worldwide
3. **130+ automated tests** — Unit + functional tests prove quality
4. **Real-world data** — Actual Indian stock market, not mock data
5. **Portfolio tracking** — Actually useful for making money decisions
6. **Spec-driven process** — Documented requirements, design, and implementation
7. **Free tier deployment** — Shows practical deployment skills

**Skills demonstrated:**
- TypeScript, React, Node.js, Python
- REST API design
- State management (Context API)
- Testing (Vitest, Cypress, property-based)
- DevOps (Render, Vercel, GitHub)
- Infrastructure-as-code (render.yaml)
- Proxy configuration and cloud deployment
- Spec-driven development with AI tools

---

**Built with ❤️ by Krishna Naidu using Kiro AI IDE + Claude**
