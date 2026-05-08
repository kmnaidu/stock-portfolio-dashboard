# Stock Portfolio Analyzer — Complete Project Summary & Learnings

---

## What We Built

A real-time Indian stock market dashboard that helps investors make buy/hold/sell decisions using institutional analyst data, technical analysis, and AI-powered insights.

**Live URL:** https://stock-portfolio-analyzer-ten.vercel.app
**GitHub:** https://github.com/kmnaidu/stock-portfolio-dashboard

---

## Features Implemented

### Dashboard
| Feature | What It Shows |
|---------|--------------|
| **Market Pulse** | Nifty 50, Sensex, Brent Crude, USD/INR, Gold, Silver — with bullish/bearish verdict |
| **Global Markets** | S&P 500, NASDAQ, Dow Jones, Nikkei 225, Hang Seng, FTSE 100 |
| **FII/DII Flows** | Foreign & Domestic institutional buying/selling activity |
| **Holdings P&L** | Your actual portfolio with real-time profit/loss |
| **Top Picks** | Stocks ranked by analyst upside (20%+ highlighted, rest collapsible) |
| **Stock Grid** | Live prices for 28 stocks (top 10 shown, expandable) |
| **Watchlist Manager** | Add/remove any NSE/BSE stock |
| **Dark Mode** | Light/dark theme toggle |

### Per-Stock Detail Page
| Feature | What It Shows |
|---------|--------------|
| **Institutional Analyst Panel** | 30-40 analysts' consensus, target prices, P/E, growth metrics |
| **AI Analysis (Gemini)** | Natural language buy/hold/sell recommendation using RAG |
| **Support & Resistance** | Pivot points, buy range, RSI, MACD, SMA 20/50/200 |
| **Growth Potential** | 1-year upside combining analyst + technical scores |
| **Price Chart** | Interactive chart with 6 time ranges (1D to 1Y) |
| **Predictions** | Linear regression forecasts (1W, 1M, 3M) |
| **Contradiction Warning** | Alerts when analyst rating conflicts with target price |

---

## Architecture

```
User Browser (Chrome)
    │
    ├── Frontend (React) ──── Vercel (CDN, auto-deploy)
    │
    ├── Node.js API ──────── Render (REST API, caching, technical analysis)
    │       │
    │       ├── Yahoo Finance v8 (live prices, charts — direct, no auth)
    │       ├── Google Gemini API (AI analysis)
    │       └── Python Service
    │               │
    │               └── Render (yfinance + curl_cffi + ScraperAPI → Yahoo v10)
    │
    └── Prewarm Script (your laptop → fills production cache daily)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript, Vite, Recharts | UI, charts, routing |
| **Backend** | Node.js, Express, TypeScript | REST API, caching, technical analysis |
| **Python Service** | Flask, yfinance, curl_cffi, Gunicorn | Analyst data from Yahoo |
| **AI** | Google Gemini 2.5 Flash | Natural language stock analysis (RAG) |
| **Data Sources** | Yahoo Finance, NSE India | Prices, analyst targets, FII/DII |
| **Proxy** | ScraperAPI | Residential IPs for Yahoo (production) |
| **Hosting** | Vercel (frontend), Render (2 backends) | Free tier, auto-deploy |
| **Monitoring** | UptimeRobot, Vercel Analytics | Keep services awake, track visitors |
| **Testing** | Vitest (90 unit tests), Cypress (40+ E2E) | Quality assurance |
| **CI/CD** | GitHub → Vercel/Render auto-deploy | Push to main = deploy |

---

## How to Deploy (From Scratch)

### 1. Prerequisites
- Node.js 20+, Python 3.9+, Git
- GitHub account, Vercel account, Render account
- Google AI Studio API key (free)
- ScraperAPI key (free tier)

### 2. Local Development
```bash
# Terminal 1: Python
cd python-service && python3 app.py

# Terminal 2: Node.js
cd server && GEMINI_API_KEY=your_key npm run dev

# Terminal 3: Frontend
cd client && npm run dev
```
Open `http://localhost:5173`

### 3. Production Deployment
```bash
# Push to GitHub
git push origin main

# Vercel: auto-deploys frontend from client/ folder
# Render: auto-deploys via render.yaml blueprint (2 services)
```

### 4. Environment Variables (Render Dashboard)
```
stock-api service:
  PYTHON_SERVICE_URL = https://stock-python-whf6.onrender.com
  CORS_ORIGIN = https://stock-portfolio-analyzer-ten.vercel.app
  GEMINI_API_KEY = your_gemini_key

stock-python service:
  SCRAPERAPI_KEY = your_scraperapi_key
```

### 5. Daily Maintenance
```bash
# Run once daily to fill analyst data cache (24h TTL)
# Requires local Python service running
cd python-service && python3 app.py   # Terminal 1
./scripts/prewarm-cache.sh             # Terminal 2
```

### 6. After Every Deploy
```bash
# Cache resets on deploy (in-memory). Re-run prewarm:
./scripts/prewarm-cache.sh
```

---

## How to Use the Product

### For Personal Investment Decisions
1. Check **Market Pulse** — is the market bullish or bearish today?
2. Check **Top Picks** — which stocks have 20%+ analyst upside?
3. Click a stock → read **Analyst Panel** (what 40 experts think)
4. Click **🤖 AI Analysis** → get a clear buy/hold/sell recommendation
5. Check **Support & Resistance** → find the right entry price
6. Track your holdings → see real-time P&L

### For Sharing with Friends
- Share the Vercel URL — works on any device
- Each user gets their own watchlist/holdings (localStorage)
- Run prewarm script before sharing so data is fresh

### Mobile Access
- Open the Vercel URL in Chrome on phone
- Or access local dev via `http://YOUR_MAC_IP:5173` (same WiFi)

---

## Key Learnings

### Technical Concepts
| Concept | What You Learned |
|---------|-----------------|
| **Microservices** | 3 independent services communicating over HTTP |
| **Caching** | Multi-layer TTL cache (Python 24h → Node.js 6h/24h) |
| **RAG (AI)** | Retrieve data → augment with context → generate with LLM |
| **TLS Fingerprinting** | curl_cffi mimics Chrome to bypass bot detection |
| **Residential Proxy** | ScraperAPI routes through home IPs to bypass datacenter blocks |
| **Infrastructure as Code** | render.yaml defines entire backend deployment |
| **CI/CD** | Git push → auto-deploy to production |
| **CORS** | Cross-origin security between Vercel frontend and Render backend |
| **Free Tier Architecture** | Designing around cold starts, rate limits, sleep cycles |
| **Spec-Driven Development** | Requirements → Design → Tasks → Code |

### AI & LLM Concepts
| Concept | What You Learned |
|---------|-----------------|
| **LLM** | Large Language Model — the "brain" (Gemini, GPT, Claude) |
| **RAG** | Retrieval-Augmented Generation — ground AI in your data, not hallucinations |
| **Prompt Engineering** | System role + rules + context = quality output |
| **Model Fallback** | Try multiple models in sequence for reliability |
| **Token Economics** | ~₹0.008 per analysis call, 1,500 free/day |
| **MCP** | Model Context Protocol — standard for AI ↔ tools connection |
| **ACP** | Agent Communication Protocol — agents in different frameworks talk |
| **A2A** | Agent-to-Agent — cross-org agent collaboration + payments |
| **Frontier Models** | Latest LLMs (Gemini 2.5, GPT-5, Claude 4) |

### DevOps & Deployment
| Concept | What You Learned |
|---------|-----------------|
| **Vercel** | Static site CDN — serves built React files globally, no server process |
| **Render** | Server hosting — runs Node.js/Python processes, sleeps after 15 min |
| **UptimeRobot** | Keeps free-tier services awake with 5-min health pings |
| **Environment Variables** | Secrets management — never hardcode keys in code |
| **Git Branching** | Feature branch → test locally → merge to main → auto-deploy |
| **render.yaml** | Blueprint file that defines infrastructure as code |

### Financial Concepts
| Concept | What It Means |
|---------|--------------|
| **RSI** | Relative Strength Index (0-100). <30 = oversold (buy), >70 = overbought (sell) |
| **MACD** | Momentum indicator. Bullish crossover = momentum shifting up |
| **SMA 20/50/200** | Simple Moving Averages. Price above = uptrend, below = downtrend |
| **Support/Resistance** | Price levels where stock tends to bounce (support) or reverse (resistance) |
| **P/E Ratio** | Price / Earnings. Lower = cheaper relative to profits |
| **PEG Ratio** | P/E / Growth. <1 = undervalued for its growth rate |
| **FII/DII** | Foreign/Domestic Institutional Investors. FII selling = bearish for market |
| **Analyst Target** | 12-month price prediction from institutional analysts |
| **Mean vs Median** | Mean = average (affected by outliers). Median = middle value (robust) |

---

## Cost Breakdown

| Service | Monthly Cost |
|---------|-------------|
| Vercel (frontend) | ₹0 |
| Render × 2 (backends) | ₹0 |
| ScraperAPI (proxy) | ₹0 |
| Google Gemini (AI) | ₹0 (free tier: 1,500 req/day) |
| UptimeRobot (monitoring) | ₹0 |
| Vercel Analytics | ₹0 |
| GitHub | ₹0 |
| **Total** | **₹0/month** |

---

## Project Stats

| Metric | Value |
|--------|-------|
| Total files | 50+ |
| Lines of code | ~7,000+ |
| Unit tests | 90 (Vitest) |
| E2E tests | 40+ (Cypress) |
| API endpoints | 13 |
| Stocks supported | 28 default + unlimited custom |
| Global indices | 6 |
| Commodities | 3 (Crude, Gold, Silver) |
| Development approach | Spec-driven with AI pair programming |
| Monthly cost | ₹0 |

---

## Important Notes

### Security
- Rotate API keys periodically (ScraperAPI, Gemini)
- CORS restricted to Vercel URL only (not `*`)
- Never commit API keys to code — use environment variables

### Known Limitations
- Yahoo Finance delays index data by ~15 minutes (free tier restriction)
- Individual stock prices are near real-time (~2-5 sec delay)
- ScraperAPI free tier is unreliable (~50% success) — prewarm script is the solution
- In-memory cache resets on every deploy — run prewarm after each push
- Analyst data is 12-month forward targets, may be stale if analysts haven't updated

### Cache Strategy
```
Prewarm script (your laptop) → Production Node.js cache (24h TTL)
Normal flow (ScraperAPI) → Python cache (24h) → Node.js cache (6h)
Live prices (Yahoo v8) → Node.js cache (10 sec)
Market Pulse → Node.js cache (30 sec)
Global Markets → Node.js cache (60 sec)
AI Analysis → Node.js cache (6h)
```

---

## Future Enhancements (When Ready)

| Feature | Effort | Value |
|---------|--------|-------|
| Multi-agent AI (LangGraph) | 1 week | Higher quality analysis |
| Intraday signals (Upstox API) | 2 weeks | Real-time trading signals |
| PWA (installable app) | 2 hours | Phone home screen icon |
| Google Play Store (TWA) | 1 day + $25 | App store presence |
| Price alerts (notifications) | 3 days | Actionable alerts |
| Redis cache (persistent) | 1 day | Survives deploys |
| User auth (login) | 1-2 weeks | Multi-device, personalization |
| Broker referral links | 1 hour | Passive income |

---

## Commands Quick Reference

```bash
# Start all services locally
cd python-service && python3 app.py          # Terminal 1
cd server && GEMINI_API_KEY=key npm run dev   # Terminal 2
cd client && npm run dev                      # Terminal 3

# Run tests
cd server && npm test                         # 42 unit tests
cd client && npm test                         # 48 unit tests
cd client && npm run cy:open                  # Cypress E2E

# Pre-warm production cache
./scripts/prewarm-cache.sh

# Deploy to production
git add . && git commit -m "message"
git checkout main && git merge branch --no-edit
git push origin main

# Check mobile on same WiFi
ipconfig getifaddr en0                        # Get your Mac IP
# Open http://YOUR_IP:5173 on phone
```

---

**Built by Krishna Naidu using Kiro AI IDE + Claude + Google Gemini**
