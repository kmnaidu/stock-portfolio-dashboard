# How I Built an AI Stock Portfolio Analyzer Using RAG, Multi-Agents, LangGraph, Vector DB, and Redis

*A deep-dive into building a production AI system for Indian stock market analysis — from real-time dashboards to autonomous WhatsApp briefings, covering every AI concept I implemented and the problems I solved along the way.*

---

## The Problem

I invest in 9 Indian stocks (ICICI Bank, Reliance, HAL, HDFC Bank, SBI, Infosys, M&M, Eternal, Bharti Airtel). Every morning I was spending 30-45 minutes checking prices across multiple apps, reading news, checking analyst targets, and trying to answer one question: **Should I buy more, hold, or exit?**

I wanted a system that could:
- Show me everything in one dashboard
- Answer my stock questions in natural language
- Send me a daily WhatsApp briefing without me opening any app
- Help me make investment decisions backed by real data, not guesswork
- Alert me when stocks hit my target prices

Not a toy demo — something I actually use every single trading day.

---

## What I Built

A full-stack AI-powered stock analysis platform with 14 major features:

| # | Feature | AI Concept |
|---|---------|-----------|
| 1 | Real-time Dashboard (30+ stocks) | Data Engineering |
| 2 | AI Chat Agent (ReAct pattern) | Tool-Calling Agent |
| 3 | 5-Agent Deep Analysis | Multi-Agent Orchestration |
| 4 | LangGraph Investment Decision | Conditional Graph Routing |
| 5 | RAG-Powered Analysis | Retrieval-Augmented Generation |
| 6 | Semantic Stock Search | Vector Embeddings + Similarity |
| 7 | Daily WhatsApp Briefing | Autonomous Agent + Scheduling |
| 8 | Stock Price Alerts | Event-Driven Notifications |
| 9 | Conversation Memory | Session Management + Context Window |
| 10 | SSE Streaming Responses | Real-Time AI Output |
| 11 | AI Observability | LLM Monitoring + Metrics |
| 12 | MCP Server (5 tools) | Model Context Protocol |
| 13 | Hybrid Caching (Redis) | Persistent + In-Memory Cache |
| 14 | Multi-Key LLM Resilience | Rate Limit Engineering |

**Live Production:**
- Frontend: Vercel (React + TypeScript)
- Backend: Render (Node.js + Express)
- Cache: Upstash Redis
- Vector DB: Upstash Vector
- LLM: Google Gemini (4 API keys)

---

## The Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend (Vercel)                                    │
│  Dashboard | Stock Detail | Agent Chat (SSE streaming)      │
│  Quick Actions: Futures, Commodities, Nifty Levels          │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  Node.js + Express Backend (Render)                         │
│                                                             │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │ ReAct Agent  │  │ 5 Multi-Agent │  │ LangGraph      │   │
│  │ (tool calls) │  │ (sequential)  │  │ (conditional)  │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │ AI Analysis  │  │ Observability │  │ Investment     │   │
│  │ (per stock)  │  │ (every call)  │  │ Decision       │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  External Services                                          │
│  Upstash Redis | Upstash Vector | Gemini API (4 keys)       │
│  Yahoo Finance | TradingView | Google News RSS              │
│  Twilio WhatsApp | launchd scheduler                        │
└─────────────────────────────────────────────────────────────┘
```

---

## AI Concepts Deep Dive

### 1. RAG (Retrieval-Augmented Generation)

**Problem:** LLMs hallucinate stock prices. If you ask "What's Reliance at?", it gives outdated or made-up numbers.

**Solution:** Before every LLM call, I retrieve real data from multiple sources:
- **Live price** → Yahoo Finance API
- **Analyst consensus** → Redis cache (pre-warmed from Python yfinance service)
- **Technical indicators** → Computed from 1-year historical data (RSI, MACD, support/resistance)
- **Market conditions** → TradingView Scanner API (futures, commodities)
- **News headlines** → Google News RSS feed

The LLM receives this data as context and only does what it's good at: **reasoning and synthesis**. Every number in the output comes from a verified data source.

```
User: "Should I buy Reliance?"
                │
    ┌───────────▼──────────────┐
    │  RETRIEVAL (no LLM)      │
    │  Price: ₹1314 (Yahoo)    │
    │  Target: ₹1696 (Redis)   │
    │  RSI: 42 (computed)      │
    │  News: 8 headlines (RSS) │
    └───────────┬──────────────┘
                │
    ┌───────────▼──────────────┐
    │  GENERATION (Gemini)     │
    │  "Based on RSI 42 and    │
    │   analyst target of ₹1696│
    │   (29% upside), BUY..."  │
    └──────────────────────────┘
```

### 2. ReAct Agent (Tool-Calling)

**Problem:** A simple chatbot can't decide which data it needs. Different questions need different data sources.

**Solution:** I built a ReAct (Reason-Act-Observe) agent using Gemini's function calling:

1. User asks "Is it safe to invest now?"
2. Gemini **reasons**: "I need market conditions" → calls `get_market_pulse` tool
3. Agent **acts**: fetches Nifty, VIX, crude, FII data
4. Gemini **observes** the result → decides it needs more: calls `get_stock_price`
5. Loop continues until Gemini has enough data to answer

**4 tools available:** `get_analyst_data`, `get_technicals`, `get_market_pulse`, `get_stock_price`

The agent autonomously decides which tools to call and in what order — up to 5 rounds of tool calls per question.

### 3. Multi-Agent Architecture (5 Specialists)

**Problem:** A single LLM prompt trying to analyze fundamentals + technicals + news + risk produces mediocre output.

**Solution:** 5 specialist agents, each with a focused prompt and limited scope:

| Agent | Focus | Input | Output |
|-------|-------|-------|--------|
| Analyst | P/E, target, growth | Redis cache data | "Strong Buy, PEG 0.82" |
| Technical | RSI, MACD, S/R | Historical prices | "Bullish, support at ₹1290" |
| Risk | VIX, crude, FII | Market pulse data | "MEDIUM risk" |
| News | Headlines, catalysts | Google RSS | "Positive sentiment" |
| Synthesis | Combine all | 4 agent outputs | "BUY at ₹1310, SL ₹1275" |

**Key insight:** Each agent produces max 120 words. Short, focused outputs combine better than one giant generation. Total: 5 Gemini calls with 2-second delays between them to avoid rate limiting.

### 4. LangGraph (Conditional Graph Routing)

**Problem:** My multi-agent system was linear — if news shows a fundamental business problem (like fraud or bankruptcy), there's no point running the value/risk analysis. It wastes LLM calls and gives confusing mixed signals.

**Solution:** LangGraph's StateGraph with conditional edges:

```
START → fetchData → fetchFundamentals → analyzeValue → analyzeNews
                                                           │
                                         ┌─────────────────┼──────────────┐
                                         │ TEMPORARY        │ STRUCTURAL   │
                                         ▼                  ▼              
                                    assessRisk          quickAvoid → END
                                         │                  
                                         ▼                  
                                    makeDecision → END
```

The News Agent ends every response with a verdict: TEMPORARY or STRUCTURAL. If structural, the graph **short-circuits** to a quick "AVOID" recommendation — saving 2 LLM calls and giving a decisive answer in half the time.

**State flows through the graph** — each node reads from and writes to a shared state object. The final decision node has access to all previous analyses.

### 5. Vector Embeddings + Semantic Search

**Problem:** "Find me stocks similar to Reliance" can't be solved with keyword search. Reliance is in oil + telecom + retail — no simple category match.

**Solution:** 
1. Created text descriptions for 31 stocks capturing their essence (sector, size, growth, business model)
2. Used Gemini Embedding API (`gemini-embedding-001`, 768 dimensions) to convert each description into a vector
3. Stored vectors in Upstash Vector DB
4. "Similar to Reliance" = find the 5 nearest vectors in embedding space

```
"Reliance Industries. Large-cap conglomerate. Oil refining, 
 Jio telecom, retail. Energy sector. Diversified business."
                    │
                    ▼ (Gemini Embedding API)
                    │
        [0.023, -0.156, 0.892, ..., 0.045]  (768 numbers)
                    │
                    ▼ (Cosine similarity search)
                    │
        Similar: Tata Motors (78%), ITC (72%), L&T (68%)
```

No keyword matching. Pure semantic similarity. Seeded once, queryable instantly.

### 6. Conversation Memory (Session Management)

**Problem:** "What about HDFC Bank?" after asking about ICICI Bank — the AI had no context of the previous question.

**Solution:** Server-side session memory using a sliding window:
- Each session stores last 10 message pairs (user + assistant)
- Sessions expire after 30 minutes of inactivity
- Gemini's `startChat({history})` receives full conversation context
- Memory stored in a Map (server RAM) — lightweight, no DB needed

The agent now understands follow-up questions, comparisons, and references to previous answers.

### 7. SSE Streaming (Real-Time AI Display)

**Problem:** AI responses take 3-8 seconds. Users stare at a loading spinner.

**Solution:** Server-Sent Events (SSE) for word-by-word streaming:
- Backend: `GET /api/agent/stream` sends `text/event-stream` 
- Frontend: `fetch` + `ReadableStream` reader
- Words arrive in 30ms chunks → progressive display
- Feels like the AI is "typing" in real time

For multi-agent and LangGraph, each node's progress streams independently — you see "📈 Fetching price..." → "📰 Analyzing news..." → final decision, all in real time.

### 8. AI Observability (LLM Monitoring)

**Problem:** With 4 API keys, 3 models, and multiple agent types, I had no visibility into which calls succeed, which fail, and why.

**Solution:** Every LLM call is logged with:
- Model used, API key index
- Response time (ms)
- Success/failure + error message
- Estimated tokens
- Agent type (chat, deep-analysis, decision-agent)

Exposed via `GET /api/ai-stats` and `GET /api/ai-logs`. Console shows `[AI ✓]` or `[AI ✗]` for every call. I can see exactly which key is hitting rate limits and which model is most reliable.

### 9. Autonomous Daily Briefing (WhatsApp)

**Problem:** I want stock insights without opening any app.

**Solution:** A fully autonomous agent that runs on my Mac:

1. **launchd** (macOS scheduler) triggers at 9:10 AM and 2:00 PM, Mon-Fri
2. Script fetches prices for all 9 stocks (Yahoo Finance)
3. Fetches news for each stock + market headlines (Google RSS)
4. Gets market indicators (Nifty, VIX, GIFT Nifty, Crude, USD/INR)
5. Sends ALL data to Gemini in ONE call with strict formatting rules
6. Delivers the briefing to my WhatsApp via **Twilio API**

**Why launchd over cron?** macOS cron is unreliable — PATH issues, TCC permissions, skips jobs if Mac was briefly asleep. launchd handles sleep/wake, has no PATH problems, and is Apple's native scheduler.

**Sample WhatsApp briefing:**
```
📊 Morning Briefing | 3 Jun 09:10 am

📰 NEWS
• Market awaits RBI policy announcement
• VIX surged 7%, increased volatility

📊 MY STOCKS
• ICICI Bank ₹1245.8 (1.57%) → Hold
• Reliance ₹1316.3 (0.13%) → Watch (near buy)
• Infosys ₹1222.1 (-3.83%) → Watch

💡 WHAT TO DO
BUY: None today
SELL: Hold all
WATCH: Infosys (significant dip), Reliance (near buy)
```

### 10. Stock Price Alerts

**Problem:** I set target buy/sell prices but can't watch prices all day.

**Solution:** A script that checks prices against my targets and sends WhatsApp alerts:
- Monitors 5+ stocks with buy target and sell target
- Can run once (`--test`), or continuously (`--watch`, every 5 minutes)
- Sends "📉 BUY ALERT" or "📈 SELL ALERT" with price and target

### 11. MCP Server (Model Context Protocol)

**Problem:** I use AI coding tools (Kiro, Cursor) daily. I wanted them to access live stock data without copy-pasting.

**Solution:** Built a standalone MCP server with 5 tools:
- `get_stock_price` — current price, day range, 52W range
- `get_nifty_levels` — pivot point support/resistance
- `get_index_futures` — 8 global index futures (live)
- `get_commodity_futures` — 9 commodities (gold, crude, etc.)
- `get_market_pulse` — full Indian market snapshot with sentiment

Any AI assistant that supports MCP can now query live market data. Published on GitHub, reusable across projects.

### 12. Hybrid Caching Strategy

**Problem:** Render free tier restarts randomly. In-memory cache gets wiped. Users see empty data after restarts.

**Solution:** Two-tier hybrid cache:

| Data Type | TTL | Storage | Why |
|-----------|-----|---------|-----|
| Market pulse, quotes | 30-60s | In-memory (Map) | Changes every minute, no point in Redis |
| Analyst data, AI analysis | 7 days | Upstash Redis | Changes weekly, must survive restarts |

**Pre-warming:** A shell script runs from my laptop weekly, fetches all analyst data from Python yfinance service, and pushes it to both the Node.js server cache and Redis. Even if the server restarts, Redis has the data.

### 13. Multi-Key LLM Resilience

**Problem:** Gemini free tier = 10 RPM per key. My multi-agent makes 5 calls in sequence. One rate-limit error kills the entire analysis.

**Solution:** Layered resilience:

```
Call failed? → Try next model (3 models)
Still failed? → Try next key (4 keys)  
Still failed? → Wait 1.5s, try next key
All exhausted? → Return "Analysis unavailable" (graceful degradation)
```

- 4 API keys × 3 models = **up to 12 attempts** per LLM call
- 2-second delays between sequential agent calls
- Round-robin key rotation (spreads load evenly)
- Result: 95%+ success rate on completely free tier

---

## By the Numbers

Here are the concrete metrics from 50+ days of running this system in production:

### Scale
| Metric | Value |
|--------|-------|
| Stocks tracked in real-time | 32 |
| Stocks in Vector DB (embeddings) | 31 |
| Personal watchlist (daily monitoring) | 9 |
| Source files (TypeScript/TSX) | 76 |
| Lines of code | 12,400+ |
| Git commits | 61 |
| Days in production | 50+ |

### Performance & Caching
| Metric | Before (no cache) | After (Redis + memory) |
|--------|-------------------|----------------------|
| Analyst data fetch | 3-5 seconds | ~50ms (Redis hit) |
| Market pulse | 2-3 seconds | ~5ms (memory hit) |
| API calls to Yahoo/Python per day | ~384 (32 stocks × 12 fetches) | ~32 (cache serves 91% of requests) |
| Weekly API calls saved by cache | ~2,400+ | — |
| Cache hit rate (analyst data) | — | ~95% (7-day TTL) |

### AI/LLM Usage
| Metric | Value |
|--------|-------|
| LLM calls per Deep Analysis | 5 (one per specialist agent) |
| LLM calls per Decision Agent | 4 (value + news + risk + decision) |
| Fallback attempts per LLM call | Up to 12 (4 keys × 3 models) |
| LLM success rate (with fallback) | ~95% |
| Average LLM response time | 3-8 seconds |
| Streaming chunk interval | 30ms (word-by-word display) |
| Daily AI-generated briefings | 2 (9:10 AM + 2:00 PM) |

### Costs
| Resource | Monthly Cost |
|----------|-------------|
| Vercel (frontend hosting) | $0 |
| Render (backend hosting) | $0 (750 free hours) |
| Upstash Redis (persistent cache) | $0 (10K commands/day free) |
| Upstash Vector DB (embeddings) | $0 (free tier) |
| Gemini API (4 keys) | $0 (free tier) |
| Twilio WhatsApp (sandbox) | $0 |
| Yahoo Finance API | $0 (public endpoints) |
| TradingView Scanner | $0 (public API) |
| **Total monthly cost** | **$0** |

### Time Saved
| Task | Before (manual) | After (automated) |
|------|-----------------|-------------------|
| Morning stock check | 30-45 min | 30 sec (read WhatsApp) |
| "Should I buy X?" analysis | 15-20 min research | 60 sec (Decision Agent) |
| Finding similar stocks | Manual Google search | 2 sec (Vector DB) |
| Checking global futures | Open 3 apps | 1 click (Futures button) |
| Weekly total time saved | ~4-5 hours | — |

---

## Production Challenges Solved

| Challenge | Solution |
|-----------|----------|
| Render restarts randomly | Redis persistent cache + pre-warming |
| Yahoo blocks Render IPs | Laptop pre-warm script → Redis |
| Gemini rate limits (10 RPM) | 4 keys + 3 models + delays |
| macOS cron unreliable | Switched to launchd |
| Twilio sandbox expires 24h | Manual reactivation daily |
| LLM responses take 5-10s | SSE streaming (word-by-word) |
| No visibility into failures | AI Observability (log every call) |
| Server sleeps after 15 min | UptimeRobot pings every 20 min |

---

## How It Helps My Daily Investing

### Morning (9:10 AM)
WhatsApp briefing arrives. I see all 9 stocks at a glance — which ones moved, what news broke, what to watch. Takes 30 seconds to read.

### During Market Hours
If something catches my eye, I open the dashboard. Click 🎯 LangGraph for a full investment decision — entry price, stop loss, target, confidence level. Takes 60 seconds.

### Deep Analysis
For stocks I'm seriously considering, I use 🔬 Deep Analysis — 5 specialist agents give me fundamentals, technicals, risk, news, and a synthesized recommendation.

### Discovery
"Find stocks similar to HAL" → Vector search returns defense and government-order-driven companies. New investment ideas without manual research.

### End of Day
2 PM briefing summarizes the day. Any alerts fired? Any targets hit?

---

## Future Goals

1. **Batch Decision Mode** — run LangGraph for all 9 stocks in one command, compare and rank
2. **Portfolio P&L Tracking** — actual buy prices + unrealized gains
3. **Peer Comparison Node** — add a LangGraph node that compares to sector peers
4. **Historical Pattern Detection** — use past earnings reactions to predict upcoming ones
5. **Paid Gemini Tier** — when scaling beyond personal use, remove all rate-limit workarounds
6. **Mobile App** — React Native wrapper for the dashboard
7. **Integration with Broker API** — execute trades directly from recommendations

---

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + TypeScript + Vite | Dashboard, Agent Chat |
| Backend | Node.js + Express + TypeScript | API, AI orchestration |
| AI/LLM | Google Gemini (4 keys, 3 models) | All AI generation |
| Agent Framework | LangGraph (@langchain/langgraph) | Conditional routing |
| Cache | Upstash Redis + In-Memory Map | Hybrid persistent cache |
| Vector DB | Upstash Vector + Gemini Embeddings | Semantic stock search |
| Data | Yahoo Finance, TradingView, Google RSS | Live market data |
| Notifications | Twilio WhatsApp API | Daily briefings + alerts |
| Scheduler | macOS launchd | Autonomous agent triggers |
| Hosting | Vercel + Render (free tier) | Production deployment |
| MCP | Custom MCP Server (5 tools) | AI IDE integration |
| Observability | Custom logging + /ai-stats endpoint | LLM monitoring |

---

## Key Takeaways

1. **RAG beats prompt engineering** — feeding verified data to the LLM produces dramatically better results than hoping it "knows" current stock prices.

2. **Multi-agent > single mega-prompt** — focused 120-word outputs from specialists combine better than one sprawling 1000-word generation.

3. **Conditional routing saves cost** — LangGraph's ability to skip nodes based on state saves both time and money.

4. **Free tier is viable for production** — with proper caching, key rotation, and resilience patterns, you can run a real AI application at zero monthly cost.

5. **Observability is not optional** — when you have 4 keys × 3 models × 5 agents, you need to know exactly what's working and what's failing.

6. **Build for yourself first** — I use this every trading day. That motivation drives better engineering than any hypothetical product.

7. **Autonomous agents need reliability** — the journey from cron → PATH issues → launchd taught me that scheduling is harder than the AI part.

---

*The best AI applications solve real problems with real data. Every architectural decision in this system — RAG, multi-agent, LangGraph, Redis, vector search — emerged from a genuine need, not from chasing buzzwords. Start with your problem, and the right tools will reveal themselves.*

---

**GitHub**: [github.com/kmnaidu/stock-portfolio-dashboard](https://github.com/kmnaidu/stock-portfolio-dashboard)  
**Live App**: [stock-portfolio-analyzer-ten.vercel.app](https://stock-portfolio-analyzer-ten.vercel.app)

**Tags**: #AI #LangGraph #RAG #MultiAgent #VectorDB #Redis #StockMarket #TypeScript #GenAI #LLM #Gemini #MCP #BuildInPublic #AIEngineering
