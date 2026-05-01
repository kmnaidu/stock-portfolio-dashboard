# 📈 Stock Portfolio Analyzer

A real-time Indian stock market portfolio dashboard with live prices, institutional analyst data, technical analysis, and portfolio tracking. Built with Node.js, React, Python (yfinance), and TypeScript.

**🔗 Live Demo:** [https://stock-portfolio-analyzer-ten.vercel.app](https://stock-portfolio-analyzer-ten.vercel.app)

**📦 GitHub:** [https://github.com/kmnaidu/stock-portfolio-dashboard](https://github.com/kmnaidu/stock-portfolio-dashboard)

---

## ✨ Features

### 📊 Dashboard Overview
- **Market Pulse** — Daily macro snapshot: Nifty 50, Sensex, Brent Crude, USD/INR, FII/DII activity. Gives a bullish/bearish/neutral verdict for the market.
- **My Portfolio Holdings** — Add your actual stock holdings (quantity + avg buy price) to see real-time P&L per stock and total portfolio value.
- **Top Picks** — Stocks ranked by analyst-predicted upside, highlighting ones with 20%+ expected 1-year returns.
- **Stock Grid** — Live prices for all stocks in your watchlist with color-coded gains/losses.

### 🔍 Per-Stock Detail Page
- **🏛️ Institutional Analyst View** — Real data from 30+ analysts per stock: target prices (mean/high/low), Buy/Hold/Sell distribution, P/E, PEG, EPS, revenue growth, market cap.
- **Support & Resistance** — Classic floor pivots (S1/S2/S3, R1/R2/R3), buy range recommendation, verdict (Buy/Hold/Sell) based on RSI + MACD + SMA.
- **1-Year Growth Potential** — Combines real analyst targets with technical scores (historical growth, mean reversion, trend strength, risk-adjusted returns).
- **Interactive Price Chart** — Recharts-powered chart with 6 time ranges (1D, 1W, 1M, 3M, 6M, 1Y).
- **Bollinger Bands + Volume Analysis** — Current position (oversold/overbought), today's volume vs 20-day average, OBV trend.
- **Short-Term Predictions** — Linear regression-based 1-week, 1-month, 3-month price forecasts with confidence levels.
- **Technical Analysis Signals** — Algorithm-generated Buy/Sell signals from moving averages, momentum, volatility.

### 🎯 User Customization
- **Watchlist Manager** — Add any NSE/BSE stock (e.g., `TCS.NS`, `ZOMATO.NS`) or remove existing ones. Search from 70+ popular stocks.
- **Portfolio Holdings** — Enter quantity and avg buy price per stock to track your actual investments.
- **Dark Mode** — Toggle between light and dark themes (🌙/☀️).
- **Mobile Responsive** — Works on phone, tablet, desktop.
- **Persistent Storage** — Watchlist and holdings saved in browser's localStorage.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      USER BROWSER                          │
│  React SPA (Vercel) - https://stock-portfolio-             │
│  analyzer-ten.vercel.app                                   │
└─────────────────────────┬──────────────────────────────────┘
                          │ HTTPS REST API calls
                          ▼
┌────────────────────────────────────────────────────────────┐
│  Node.js + Express API (Render)                            │
│  https://stock-api-9ukf.onrender.com                       │
│  - In-memory cache with TTL                                │
│  - Technical analysis services                             │
│  - Market pulse aggregation                                │
└─────────────┬───────────────────────────┬──────────────────┘
              │                           │
              ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│  Yahoo Finance v8 Chart  │  │  Python Microservice (Render)│
│  (for live prices, OHLC) │  │  https://stock-python-       │
│                          │  │  whf6.onrender.com           │
│  Direct HTTP calls       │  │  - yfinance via curl_cffi    │
│  No auth required        │  │  - ScraperAPI proxy          │
└──────────────────────────┘  │  - Analyst data              │
                              └──────────────┬───────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │  ScraperAPI (5K free/month)  │
                              │  Residential proxy for       │
                              │  Yahoo Finance auth endpoints│
                              └──────────────┬───────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │  Yahoo Finance v10 API       │
                              │  (analyst data, fundamentals)│
                              └──────────────────────────────┘
```

---

## 🚀 Production Deployment

### Live URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | https://stock-portfolio-analyzer-ten.vercel.app | React dashboard UI |
| **Backend API** | https://stock-api-9ukf.onrender.com | Node.js + Express REST API |
| **Python Service** | https://stock-python-whf6.onrender.com | yfinance microservice for analyst data |

### Hosting Providers (All Free Tier)

**Vercel** — Frontend hosting
- Global CDN, automatic HTTPS
- Auto-deploys from GitHub on every push to `main`
- Free tier: 100 GB bandwidth/month
- Dashboard: https://vercel.com/dashboard

**Render** — Backend services hosting
- Node.js API (`stock-api`)
- Python microservice (`stock-python`)
- Auto-deploys via `render.yaml` blueprint
- Free tier: 750 hours/month per service
- Services sleep after 15 min of inactivity (30-60s cold start)
- Dashboard: https://dashboard.render.com

**ScraperAPI** — Residential proxy for Yahoo Finance auth
- Routes yfinance requests through residential IPs
- Bypasses Yahoo's datacenter IP blocks
- Free tier: 5,000 credits/month (each request costs ~10 credits)
- Dashboard: https://www.scraperapi.com/dashboard

### Environment Variables (Render)

On `stock-api` service:
- `PYTHON_SERVICE_URL` = `https://stock-python-whf6.onrender.com`
- `CORS_ORIGIN` = `*` (permissive for now; restrict to Vercel URL for production)
- `NODE_VERSION` = `20.11.0`

On `stock-python` service:
- `SCRAPERAPI_KEY` = (your ScraperAPI key)
- `PYTHON_VERSION` = `3.11.0`

On Vercel (frontend):
- `VITE_API_BASE_URL` = `https://stock-api-9ukf.onrender.com`

---

## 🛠️ Tech Stack

### Frontend
- **React 18** + **TypeScript** — UI framework
- **Vite** — Build tool and dev server
- **React Router** — Page navigation
- **Recharts** — Interactive price charts
- **CSS Variables** — Theming (light/dark mode)

### Backend (Node.js)
- **Express** + **TypeScript** — REST API server
- **tsx** — TypeScript runner (no build step for simpler deployment)
- **In-memory caching** — TTL-based cache for all external API responses

### Python Microservice
- **Flask** + **Gunicorn** — Web server
- **yfinance** — Yahoo Finance Python library
- **curl_cffi** — HTTP client with browser TLS fingerprinting (bypasses bot detection)
- **ScraperAPI** — Residential proxy service

### Data Sources
- **Yahoo Finance v8 Chart API** — Live prices, OHLC data, 52-week high/low (no auth needed)
- **Yahoo Finance via yfinance** — Analyst targets, recommendations, P/E, fundamentals (requires auth via proxy)
- **NSE India API** — FII/DII institutional flow data
- **Static NSE Holiday Calendar** — For market status (open/closed/pre/post-market)

### Testing
- **Vitest** — Unit test runner (90 tests covering services and logic)
- **Cypress** — Functional/E2E tests (40+ tests covering user flows)
- **fast-check** — Property-based testing utilities

### DevOps
- **Git + GitHub** — Source control
- **Render Blueprints** (`render.yaml`) — Infrastructure-as-code for backend
- **Vercel CI/CD** — Automatic frontend deployment on every push

---

## 📋 Supported Stocks (Default Watchlist)

The dashboard ships with 32 pre-configured Indian stocks across sectors:

**Banking:** HDFC Bank, SBI, ICICI Bank, City Union Bank
**IT:** TCS, Infosys, KPIT Technologies
**Auto:** Mahindra & Mahindra, TVS Motor, Tata Motors
**Engineering/Defence:** HAL, BEL, L&T
**Petroleum/Power:** Reliance, Adani Power, Tata Power
**Telecom:** Bharti Airtel
**Pharma:** Dr. Reddy's, Biocon
**FMCG:** ITC, Dabur
**Metals:** National Aluminium
**Transport/Service:** IndiGo, Eternal (Zomato), Delhivery
**Hospitality:** Indian Hotels (Taj)
**ETFs:** NiftyBees, GoldBees, SilverBees, JuniorBees, PharmaBees, ITBees

Users can add any additional NSE/BSE stock via the Watchlist Manager.

---

## 💻 Local Development

### Prerequisites
- **Node.js** 20+ ([download](https://nodejs.org))
- **Python** 3.9+ ([download](https://www.python.org/downloads))
- **Git** ([download](https://git-scm.com))

### Setup (one-time)

```bash
# Clone the repository
git clone https://github.com/kmnaidu/stock-portfolio-dashboard.git
cd stock-portfolio-dashboard

# Install Python dependencies
cd python-service
pip3 install -r requirements.txt
cd ..

# Install Node dependencies (client and server)
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Run locally (3 terminals)

**Terminal 1 — Python microservice:**
```bash
cd python-service
python3 app.py
```
Runs on `http://localhost:5001`. On localhost (your home IP), Yahoo Finance responds directly — no ScraperAPI needed.

**Terminal 2 — Node.js API:**
```bash
cd server
npm run dev
```
Runs on `http://localhost:3001`.

**Terminal 3 — React frontend:**
```bash
cd client
npm run dev
```
Runs on `http://localhost:5173`.

Open `http://localhost:5173` in Chrome. Dashboard loads with all analyst data working.

### Access from mobile on same WiFi

```bash
# Find your Mac's IP
ipconfig getifaddr en0
```

Then on your phone (same WiFi), open `http://YOUR_MAC_IP:5173`.

---

## 🧪 Testing

### Run unit tests (Vitest)

```bash
# Server tests (42 tests)
cd server && npm test

# Client tests (48 tests)
cd client && npm test
```

Expected output:
```
Test Files  7 passed (7)
     Tests  48 passed (48)
```

### Run Cypress functional tests

```bash
# Make sure the backend and frontend are running first
# Then in another terminal:
cd client
npm run cy:open    # Interactive mode
npm run cy:run     # Headless mode
```

Cypress opens a real Chrome browser and executes 40+ test scenarios covering:
- Dashboard page load and data display
- Stock detail page navigation
- Interactive chart with time range selection
- Sorting and filtering
- Responsive layout across breakpoints
- Direct URL access and error handling

---

## 📂 Project Structure

```
stock-portfolio-dashboard/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # UI components (StockGrid, MarketPulse, etc.)
│   │   │   ├── StockDetail/ # Per-stock detail panels
│   │   │   └── ...
│   │   ├── context/         # React Context for global state
│   │   │   ├── PortfolioContext.tsx
│   │   │   └── WatchlistContext.tsx
│   │   ├── hooks/           # Custom React hooks
│   │   │   └── useStockPoller.ts
│   │   ├── pages/           # Page components
│   │   └── App.tsx
│   ├── cypress/             # Functional tests
│   ├── package.json
│   └── vite.config.ts
│
├── server/                  # Node.js backend
│   ├── src/
│   │   ├── routes/          # Express route handlers
│   │   │   └── api.ts
│   │   ├── services/        # Business logic
│   │   │   ├── cacheService.ts
│   │   │   ├── yahooFinanceService.ts
│   │   │   ├── predictionEngine.ts
│   │   │   ├── marketStatusService.ts
│   │   │   ├── marketPulseService.ts
│   │   │   ├── analystDataService.ts
│   │   │   ├── supportResistanceService.ts
│   │   │   └── growthPotentialService.ts
│   │   └── index.ts
│   └── package.json
│
├── python-service/          # Python microservice
│   ├── app.py               # Flask app
│   ├── requirements.txt
│   └── README.md
│
├── shared/                  # Shared TypeScript types
│   └── types.ts
│
├── .kiro/specs/             # Spec documents (generated during design phase)
│   └── stock-portfolio-dashboard/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
│
├── render.yaml              # Render deployment blueprint
├── DEPLOYMENT.md            # Deployment guide
└── README.md                # This file
```

---

## 🎓 How It's Built — Spec-Driven Development

This project was built using AI-augmented engineering with a structured spec-first workflow:

1. **Requirements** → Formalized user needs into EARS-compliant acceptance criteria
2. **Design** → Created technical design with architecture diagrams, API contracts, correctness properties
3. **Tasks** → Broke design into 30+ implementation tasks across 10 phases
4. **Implementation** → Built iteratively task-by-task, with checkpoints between phases
5. **Testing** → 90+ unit tests and 40+ functional tests woven into development
6. **Deployment** → Production deployment with CI/CD via Git push

Specs are in `.kiro/specs/stock-portfolio-dashboard/` — requirements, design, and tasks markdown files documenting the full process.

---

## 🔒 Known Limitations & Trade-offs

### Free tier constraints
- **Render services sleep** after 15 min inactivity → ~30-60s cold start on first visit
- **Solution:** Use [UptimeRobot](https://uptimerobot.com) (free) to ping services every 5 min

### Analyst data availability
- **Yahoo Finance blocks cloud provider IPs** (Render, Railway, etc.)
- **Workaround:** ScraperAPI residential proxy for production
- **Reality:** ScraperAPI free tier (5K credits) is marginal — expect occasional "Analyst Unavailable" messages in production
- **Local development:** No issues — your home IP isn't blocked, all data works instantly

### Cache scope
- Analyst data cached **server-side for 24 hours** (shared across all users)
- Stock prices cached **10 seconds** (refreshed each poll)
- Watchlist and portfolio holdings stored **per-user in localStorage** (browser-specific)

### Market hours
- Live prices update every 15 seconds during NSE hours (9:15 AM - 3:30 PM IST, Mon-Fri)
- After-hours: prices update every 60 seconds (last close displayed)
- Holidays: static NSE 2025-2026 holiday calendar

---

## 🔮 Future Enhancements

Planned features (ordered by priority):

1. **Price Alerts** — Browser notifications when a stock crosses a target price
2. **News Feed** — Recent news and corporate actions per stock
3. **Sector Comparison** — Is this stock outperforming its sector?
4. **Stock Screener** — Filter stocks by P/E, growth, dividend yield
5. **Earnings Calendar** — Upcoming quarterly results for your watchlist
6. **Portfolio Export** — Download P&L summary as PDF for tax filing
7. **Dhan/Tickertape API integration** — Reliable analyst data without ScraperAPI limits

---

## 🙏 Acknowledgments

- **Yahoo Finance** — Free stock market data API
- **NSE India** — FII/DII institutional flow data
- **ScraperAPI** — Residential proxy for bypassing IP restrictions
- **Kiro AI IDE + Claude** — AI-augmented development platform used to build this

---

## 📝 License

Open source for personal use. Not financial advice.

**Disclaimer:** This dashboard is for educational and portfolio tracking purposes only. Investment decisions should be based on your own research and consultation with qualified financial advisors. Past performance does not guarantee future results. Market data may be delayed or inaccurate.

---

## 📧 Contact

Built by **Krishna Naidu**
- GitHub: [@kmnaidu](https://github.com/kmnaidu)
- LinkedIn: [Connect](#) (add your profile link here)

If you use this dashboard, have feedback, or want to contribute, feel free to open an issue on GitHub.
