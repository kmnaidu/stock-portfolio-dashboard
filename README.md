# 📈 Stock Portfolio Dashboard

A real-time Indian stock market portfolio dashboard built with Node.js, React, and TypeScript. Tracks live prices, price predictions, technical analysis, and key metrics for 7 Indian securities.

## Supported Securities
- Reliance Industries (RELIANCE.NS)
- HDFC Bank (HDFCBANK.NS)
- State Bank of India (SBIN.NS)
- Hindustan Aeronautics (HAL.NS)
- Bharti Airtel (BHARTIARTL.NS)
- Nippon India Nifty BeES ETF (NIFTYBEES.NS)
- Nippon India Gold BeES ETF (GOLDBEES.NS)

## Features
- **Live Prices** — 15-second auto-refresh during market hours, 60-second when closed
- **Portfolio Summary** — Total value, daily P&L, securities count
- **Interactive Charts** — 6 time ranges (1D, 1W, 1M, 3M, 6M, 1Y) with tooltips
- **Price Predictions** — 1-week, 1-month, 3-month forecasts using linear regression
- **Technical Analysis** — Moving average, momentum, short-term trend, volatility signals
- **Key Metrics** — 52-week high/low from Yahoo Finance
- **Market Status** — Live NSE open/closed indicator with IST clock
- **Responsive** — Works on mobile, tablet, and desktop (Chrome)
- **Connectivity Handling** — Detects connection loss, shows stale data indicator

## Tech Stack
- **Backend:** Node.js, Express, TypeScript, Yahoo Finance API (v8 chart)
- **Frontend:** React, TypeScript, Recharts, React Router, Vite
- **Testing:** Vitest (90 unit tests), Cypress (40+ functional tests)

## Quick Start

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Start backend (Terminal 1)
cd server && npm run dev

# Start frontend (Terminal 2)
cd client && npm run dev
```

Open http://localhost:5173 in Chrome.

## Running Tests

```bash
# Unit tests
cd server && npm test    # 42 tests
cd client && npm test    # 48 tests

# Functional tests (requires both servers running)
cd client && npm run cy:open    # Interactive mode
cd client && npm run cy:run     # Headless mode
```

## Project Structure
```
├── shared/              # Shared TypeScript types
│   └── types.ts
├── server/              # Express backend
│   └── src/
│       ├── services/    # Cache, Yahoo Finance, Predictions, Market Status
│       ├── routes/      # REST API endpoints
│       └── index.ts     # Server entry point
├── client/              # React frontend
│   └── src/
│       ├── components/  # UI components (StockGrid, StockRow, etc.)
│       ├── context/     # PortfolioContext (shared state)
│       ├── hooks/       # useStockPoller (polling logic)
│       └── pages/       # Dashboard and Stock Detail pages
└── cypress/             # Functional tests
```

## Built With
Built in a single session using [Kiro AI IDE](https://kiro.dev) powered by Claude — from idea → requirements → design → implementation → testing.
