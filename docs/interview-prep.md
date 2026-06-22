# Interview Preparation — AI Stock Portfolio Analyzer

## How to Use This Document
For each component, you get:
- **What it is** (1-line explanation)
- **Why we built it** (the problem)
- **How it works** (technical details)
- **Interview answer** (ready to speak)
- **Follow-up questions** you might get asked

---

## 1. RAG (Retrieval-Augmented Generation)

**What:** Feed real data to the LLM instead of relying on its training data.

**Why:** LLMs hallucinate stock prices. Ask "What's Reliance at?" and it gives outdated or fabricated numbers.

**How it works in our project:**
1. User asks a question
2. BEFORE calling Gemini, we retrieve:
   - Live price (Yahoo Finance API)
   - Analyst consensus (from Redis cache)
   - Technical indicators (computed from 1Y historical data)
   - News (Google RSS)
3. All this data goes into the prompt as context
4. Gemini only does reasoning/synthesis — never invents numbers

**Interview answer:**
> "I implemented RAG to eliminate hallucination in stock analysis. Before every LLM call, I retrieve live prices from Yahoo Finance, analyst data from my Redis cache, computed technical indicators like RSI and MACD, and recent news from Google RSS. The LLM receives this as context and only performs reasoning — all numbers come from verified sources. This is the same pattern used by ChatGPT for web browsing and enterprise search systems."

**Follow-up Q&A:**
- *Q: How is this different from fine-tuning?*
  A: Fine-tuning bakes knowledge into model weights (expensive, goes stale). RAG retrieves fresh data at query time — always current, no retraining needed.
- *Q: What if retrieval fails?*
  A: Graceful degradation. If Yahoo is down, the agent still answers from its knowledge but disclaims "unable to verify current price."
- *Q: How do you handle context window limits?*
  A: I only retrieve what's needed per query. Analyst data is ~200 tokens, technicals ~150 tokens. Total context stays under 2K tokens per call.

---

## 2. ReAct Agent (Tool-Calling)

**What:** An AI agent that reasons about what data it needs, calls tools to get it, observes results, and repeats until it can answer.

**Why:** Different questions need different data. "Is ICICI Bank a buy?" needs analyst data + technicals. "Is the market safe?" needs VIX + crude + FII flows. A static pipeline can't handle both.

**How it works:**
```
User: "Should I buy ICICI Bank?"
  → Gemini REASONS: "I need fundamentals" → calls get_analyst_data(ICICIBANK.NS)
  → Agent ACTS: fetches P/E=18, target=₹1450, consensus=Buy
  → Gemini OBSERVES: "I also need entry points" → calls get_technicals(ICICIBANK.NS)
  → Agent ACTS: fetches RSI=45, support=₹1190
  → Gemini RESPONDS: "Buy at ₹1225, support at ₹1190, target ₹1450"
```

**4 tools available:** `get_analyst_data`, `get_technicals`, `get_market_pulse`, `get_stock_price`
**Safety limit:** Max 5 rounds of tool calls per question (prevents infinite loops)

**Interview answer:**
> "I built a ReAct agent using Gemini's function calling. The agent has 4 tools — analyst data, technicals, market pulse, and stock price. When a user asks a question, Gemini decides which tools to call based on what data it needs. It can call multiple tools across up to 5 rounds. For example, asking 'Should I buy ICICI Bank?' triggers get_analyst_data and get_technicals, while 'Is the market safe?' triggers get_market_pulse. This is more flexible than a static pipeline because the agent adapts to the question."

**Follow-up Q&A:**
- *Q: Why not call all tools every time?*
  A: Waste of API calls and time. Simple price queries don't need technicals. The agent is selective.
- *Q: What if Gemini calls a tool that doesn't exist?*
  A: The tool declarations use JSON Schema — Gemini can only call tools we've defined. Invalid calls return an error that Gemini handles gracefully.
- *Q: How do you prevent infinite loops?*
  A: MAX_ROUNDS = 5. After 5 tool-call rounds, we force-take whatever text response Gemini has generated.

---

## 3. Multi-Agent Architecture (5 Specialists)

**What:** 5 focused AI agents each handling one aspect of stock analysis, with a synthesis agent combining their outputs.

**Why:** A single mega-prompt trying to do everything produces mediocre, unfocused output. Specialists with 120-word limits produce sharper insights.

**How it works:**
```
Orchestrator (rule-based, no LLM)
    ├── Analyst Agent → fundamentals (P/E, target, growth)
    ├── Technical Agent → RSI, MACD, support/resistance
    ├── Risk Agent → VIX, crude, FII, USD/INR
    ├── News Agent → Google RSS headlines
    └── Synthesis Agent → combines all into recommendation
```

- Sequential execution (not parallel) — 2-second delays between agents
- Each agent gets only its relevant data (not everything)
- Each agent's prompt limits output to 120 words
- Total: 5 Gemini calls per deep analysis

**Interview answer:**
> "For deep analysis, I use 5 specialist agents instead of one large prompt. Each agent focuses on one domain — fundamentals, technicals, risk, news, and synthesis. They run sequentially with 2-second delays to respect rate limits. The key insight is that focused 120-word outputs from specialists combine better than one sprawling 1000-word generation. The synthesis agent receives all 4 outputs and produces an actionable recommendation. This mimics how investment banks work — different analysts cover different angles, and a senior advisor synthesizes."

**Follow-up Q&A:**
- *Q: Why sequential and not parallel?*
  A: Gemini free tier has 10 RPM limit. Parallel calls hit rate limits immediately. Sequential with delays is reliable.
- *Q: How do you handle one agent failing?*
  A: Each agent tries 3 keys × 3 models (9 attempts). If still fails, returns "Analysis unavailable" — synthesis agent works with whatever data it has.
- *Q: Why not use LangChain's agent executor?*
  A: For the main server, I kept it lightweight with direct Gemini SDK calls — no framework overhead. LangGraph is used separately for the decision agent where conditional routing adds real value.

---

## 4. LangGraph (Conditional Graph Routing)

**What:** A state machine where AI nodes can route to different paths based on analysis results.

**Why:** Linear pipelines waste compute. If news reveals a fundamental business problem (fraud, bankruptcy), there's no point running value analysis or risk assessment — just say "AVOID."

**How it works:**
```
START → fetchData → fetchFundamentals → analyzeValue → analyzeNews
                                                           │
                                    ┌──────────────────────┼────────────────┐
                                    │ verdict: TEMPORARY    │ verdict: STRUCTURAL
                                    ▼                      ▼
                               assessRisk              quickAvoid → END
                                    │
                                    ▼
                               makeDecision → END
```

- **State:** shared object flowing through all nodes (price, fundamentals, analyses)
- **Conditional edge:** after analyzeNews, checks `isStructuralProblem` flag
- **If structural:** skips risk + decision → saves 2 LLM calls, faster response
- **If temporary:** continues full analysis → complete recommendation

**Interview answer:**
> "I used LangGraph's StateGraph to implement conditional routing in my investment decision agent. After the news analysis node, a conditional edge checks if the detected problem is structural or temporary. Structural issues — like fraud or regulatory bans — short-circuit to a quick AVOID recommendation, saving 2 LLM calls and 8+ seconds. Temporary dips continue through risk assessment and full decision analysis. This is the key advantage over linear pipelines — the graph adapts its execution path based on intermediate results."

**Follow-up Q&A:**
- *Q: What makes LangGraph different from just using if/else?*
  A: LangGraph provides typed state management, graph visualization, persistence, and the ability to add human-in-the-loop breakpoints. For production, it's more maintainable than nested if/else.
- *Q: How do you decide STRUCTURAL vs TEMPORARY?*
  A: The news LLM agent ends its response with "Verdict: STRUCTURAL" or "Verdict: TEMPORARY". I check the last 80 characters of the response for this keyword. Simple but effective.
- *Q: Can you add more conditional branches?*
  A: Yes — I could add branches for "data unavailable" (skip to limited analysis) or "extreme VIX" (add extra caution to recommendations).

---

## 5. Vector DB + Semantic Search (Embeddings)

**What:** Convert stock descriptions into 768-dimensional vectors and find similar stocks by mathematical distance.

**Why:** "Find stocks similar to Reliance" can't be solved with keywords. Reliance operates in oil + telecom + retail — no single keyword captures it. Semantic similarity does.

**How it works:**
```
1. Stock profile: "Reliance Industries. Large-cap conglomerate. Oil refining, 
   Jio telecom, retail. Energy sector. Market cap 18 lakh crore."
        │
        ▼ Gemini Embedding API (gemini-embedding-001)
        │
   [0.023, -0.156, 0.892, ..., 0.045]  ← 768 numbers
        │
        ▼ Stored in Upstash Vector DB
        │
   Query: "Similar to RELIANCE.NS"
        │
        ▼ Cosine similarity search (top 5 nearest vectors)
        │
   Results: Tata Motors (78%), ITC (72%), L&T (68%)
```

- 31 stock profiles embedded and stored
- No LLM needed at query time — pure vector math
- Response time: ~200ms (vs 3-5s for LLM)

**Interview answer:**
> "I implemented semantic stock search using Gemini's embedding model and Upstash Vector DB. Each of 31 stocks has a text profile describing its sector, size, business model, and growth characteristics. These are converted to 768-dimensional vectors using gemini-embedding-001. When a user asks 'find stocks similar to Reliance,' I embed the query stock's profile, perform a cosine similarity search in the vector DB, and return the 5 nearest matches. No LLM is involved at query time — it's pure vector math, so response is under 200ms. This is the same technology behind RAG document retrieval at scale."

**Follow-up Q&A:**
- *Q: Why 768 dimensions?*
  A: Gemini's embedding model supports configurable output dimensionality. 768 is a good balance — enough to capture semantic nuance without excessive storage/compute. I set `outputDimensionality: 768` explicitly.
- *Q: How is this different from keyword search?*
  A: Keyword search for "energy" wouldn't find ITC (tobacco/FMCG). But semantically, both Reliance and ITC are large-cap, high-dividend, diversified conglomerates — the embeddings capture this.
- *Q: How do you handle new stocks?*
  A: Run the seed endpoint (`POST /api/vector/seed`) — it embeds all profiles and upserts to the vector DB. Takes ~30 seconds for 31 stocks.

---

## 6. Hybrid Caching (Redis + In-Memory)

**What:** Two-tier cache — in-memory for fast-changing data, Redis for persistent data that must survive server restarts.

**Why:** Render free tier restarts randomly. In-memory cache disappears. Users see empty data. But putting everything in Redis wastes API calls for data that changes every 30 seconds.

**How it works:**
```
Request comes in for analyst data:
  1. Check in-memory Map → found? Return immediately (5ms)
  2. Check Redis → found? Cache in memory too, return (50ms)
  3. Neither? Fetch from source, store in both, return (3-5s)

Short-lived data (30s TTL): Memory only
  - Market pulse, live quotes
  - Why: Changes every minute, Redis round-trip wasted

Long-lived data (1-day TTL): Memory + Redis
  - Analyst targets, AI analysis
  - Why: Changes daily, must survive restarts
```

**Threshold:** If TTL > 1 hour → also store in Redis. Otherwise → memory only.

**Interview answer:**
> "I implemented a hybrid caching strategy — in-memory Map for sub-minute data like market pulse and quotes (30-60s TTL), and Upstash Redis for persistent data like analyst targets (1-day TTL). The threshold is simple: if TTL exceeds 1 hour, it goes to Redis. This solves two problems simultaneously: Redis survives server restarts on the free tier, while in-memory cache keeps the hot path at 5ms. The same `cache.get()`/`cache.set()` interface is used everywhere — the hybrid logic is transparent to the rest of the codebase."

**Follow-up Q&A:**
- *Q: Why not just use Redis for everything?*
  A: Upstash free tier has 10K commands/day. Market pulse refreshes every 30s — that's 2,880 reads/day for just one endpoint. Memory is free and faster.
- *Q: What happens if Redis is down?*
  A: Graceful degradation. The `getAsync` method catches Redis errors and returns null — the system falls back to fetching fresh data from the source.
- *Q: How do you handle cache invalidation?*
  A: TTL-based expiration. When prewarm data is pushed, I also explicitly invalidate the top-picks cache key so it rebuilds with fresh data.

---

## 7. Conversation Memory (Session Management)

**What:** The AI agent remembers previous messages in the same chat session, enabling follow-up questions.

**Why:** Without memory, "What about HDFC Bank?" after asking about ICICI Bank has no context. Each question is isolated.

**How it works:**
```
Session store: Map<sessionId, { messages: [], lastAccess: timestamp }>

- Each message pair (user + assistant) appended to session
- Sliding window: keep last 10 pairs (20 messages)
- Expiry: 30 minutes of inactivity → session deleted
- Cleanup: setInterval every 5 minutes removes expired sessions
- Gemini receives full history via startChat({history})
```

**Interview answer:**
> "I implemented server-side conversation memory using a Map-based session store. Each session keeps the last 10 message pairs with a 30-minute expiry. When the agent processes a new question, it passes the full conversation history to Gemini via startChat(), giving the model context for follow-ups. A cleanup interval runs every 5 minutes to evict expired sessions. I chose server-side over client-side storage because the history is in Gemini's message format — not just plain text — and it keeps the client thin."

**Follow-up Q&A:**
- *Q: Why a sliding window of 10 pairs?*
  A: Gemini's context window is limited. 10 pairs (~4K tokens of history) keeps us well within limits while providing enough context for follow-ups.
- *Q: Why not persist sessions in Redis?*
  A: Sessions are ephemeral — a user closes the tab and starts fresh. 30-minute TTL means persistence adds complexity without value. If needed later, it's a one-line change.
- *Q: How do you generate session IDs?*
  A: `crypto.randomUUID()` on the client. Generated once per chat panel open, sent with every request.

---

## 8. SSE Streaming (Server-Sent Events)

**What:** Real-time word-by-word display of AI responses, instead of waiting for the full response.

**Why:** LLM responses take 3-8 seconds. Showing a loading spinner for 8 seconds feels broken. Streaming text feels responsive.

**How it works:**
```
Frontend                          Backend
   │                                │
   │── GET /api/agent/stream ──────→│
   │   (text/event-stream)          │
   │                                │── Gemini generates text
   │←── data: {"text":"Based "}     │
   │←── data: {"text":"on the "}    │
   │←── data: {"text":"RSI..."}     │
   │←── data: {"done":true}         │
   │                                │
   │   (connection closes)          │
```

- Backend: Express response with `Content-Type: text/event-stream`
- Chunks sent every 30ms (simulated streaming from Gemini's full response)
- Frontend: `fetch()` + `response.body.getReader()` + `TextDecoder`
- Progressive state updates: each chunk appends to the message

**Interview answer:**
> "I implemented SSE streaming for all AI responses. The backend sends Server-Sent Events with text chunks every 30ms, and the frontend progressively renders them using a ReadableStream reader. For the multi-agent and LangGraph features, each node's progress streams independently — users see 'Fetching price...' then 'Analyzing news...' in real time. This dramatically improves perceived performance — users engage with the response as it builds rather than waiting for completion."

**Follow-up Q&A:**
- *Q: Why SSE over WebSockets?*
  A: SSE is simpler (unidirectional, auto-reconnect, works through proxies). I don't need bidirectional communication — user sends one question, server streams one answer.
- *Q: What if the connection drops mid-stream?*
  A: Frontend has a fallback — if streaming fails, it retries with the POST endpoint which returns the full response at once.
- *Q: Is this true token-by-token streaming from Gemini?*
  A: For the agent chat, Gemini returns the full response after tool calls complete, then I simulate streaming by chunking the text at word boundaries. For a production system with Gemini's native streaming API, you'd use `generateContentStream()`.

---

## 9. AI Observability

**What:** Logging and monitoring every LLM call — model, key, timing, success/failure, token estimates.

**Why:** With 4 keys × 3 models × multiple agent types, you need visibility into what's working and what's failing. Without observability, debugging rate limits is guesswork.

**How it works:**
```
Every LLM call → logAICall({
  type: 'agent' | 'multi-agent' | 'decision-agent',
  model: 'gemini-2.5-flash',
  apiKeyIndex: 2,
  responseTimeMs: 3450,
  success: true,
  tokensEstimate: 850,
})

Console: [AI ✓] agent | gemini-2.5-flash | key#2 | 3.4s | 850 tokens
         [AI ✗] multi-agent | gemini-2.0-flash | key#1 | 429 rate limited

Endpoints:
  GET /api/ai-stats → aggregate metrics (success rate, avg time, by model)
  GET /api/ai-logs  → recent call history
```

**Interview answer:**
> "I built an observability layer that logs every LLM call with model name, API key index, response time, success/failure status, and estimated token usage. This feeds two endpoints — /api/ai-stats for aggregate metrics like success rate per model, and /api/ai-logs for recent call history. Console output shows [AI ✓] or [AI ✗] with key details. This was essential for diagnosing rate-limit patterns — I discovered that key #3 was consistently failing at peak hours, which led me to implement the multi-model fallback strategy."

---

## 10. Multi-Key LLM Resilience

**What:** Automatic rotation through multiple API keys and model versions when calls fail.

**Why:** Gemini free tier = 10 RPM per key. A 5-agent analysis exhausts one key instantly.

**How it works:**
```
callGemini(prompt):
  for each key (4 keys):
    for each model (gemini-2.5-flash, 2.0-flash, 2.0-flash-lite):
      try call → success? return
      catch 429/503 → continue to next model
    wait 1.5s → try next key
  all failed → return "Analysis unavailable" (graceful degradation)
```

- 4 keys × 3 models = 12 attempts before giving up
- Round-robin rotation spreads load across keys
- 2-second delays between sequential agent calls
- Result: 95%+ success rate on free tier

**Interview answer:**
> "To handle Gemini's rate limits on the free tier, I implemented a layered resilience strategy: 4 API keys rotating round-robin, each trying 3 model versions (2.5-flash, 2.0-flash, 2.0-flash-lite) as fallbacks. With 2-second delays between sequential calls, this gives me an effective 40 RPM across all keys. Each individual LLM call has up to 12 fallback attempts before returning a graceful degradation message. This pattern achieves 95%+ success rate without paying for a single API call."

---

## 11. MCP Server (Model Context Protocol)

**What:** A standalone server that exposes stock market tools via the MCP standard, usable by any AI coding assistant.

**Why:** I use AI coding tools (Kiro, Cursor, Claude) daily. I wanted them to access live stock data without copy-pasting from browsers.

**How it works:**
```
AI IDE (Kiro/Cursor) ←→ MCP Protocol ←→ My MCP Server
                                              │
                                              ├── get_stock_price → Yahoo Finance
                                              ├── get_nifty_levels → TradingView
                                              ├── get_index_futures → TradingView
                                              ├── get_commodity_futures → TradingView
                                              └── get_market_pulse → Yahoo + TradingView
```

- Runs locally via `npx` (no deployment needed)
- Uses TradingView Scanner API (free, no auth) for futures/commodities
- Yahoo Finance for stock prices and VIX
- Configured in `.kiro/settings/mcp.json`

**Interview answer:**
> "I built an MCP server that exposes 5 stock market tools — price, Nifty levels, index futures, commodity futures, and market pulse. Any AI assistant that supports MCP can query live Indian market data. I use it daily in Kiro to ask 'What's Nifty at?' or 'Show me commodity prices' without leaving my IDE. The server uses TradingView's public Scanner API for futures data and Yahoo Finance for stock prices. It's published on GitHub and reusable across projects."

---

## 12. Autonomous WhatsApp Briefing

**What:** A script that runs twice daily, generates AI-powered stock briefings, and delivers them to WhatsApp.

**Why:** I want investment insights without opening any app. Wake up, read WhatsApp, know what to do.

**How it works:**
```
launchd (9:10 AM) → daily-briefing.ts
  1. Fetch prices for 9 stocks (Yahoo Finance)
  2. Fetch news per stock + market (Google RSS)
  3. Fetch indicators (Nifty, VIX, GIFT Nifty, Crude, USD/INR)
  4. ONE Gemini call with all data + strict format rules
  5. Send via Twilio WhatsApp API
  → Message arrives on phone in 30 seconds
```

- **Scheduler:** macOS launchd (not cron — handles sleep/wake, no PATH issues)
- **Notification:** Twilio WhatsApp sandbox (free, requires 24-hour reactivation)
- **LLM cost:** 1 Gemini call per briefing (uses multi-key fallback)
- **Format:** WhatsApp-native formatting (*bold*, _italic_, • bullets)

**Interview answer:**
> "I built an autonomous daily briefing agent that runs at 9:10 AM and 2 PM on weekdays via macOS launchd. It fetches live prices for my 9 stocks, news from Google RSS, and market indicators, then sends everything to Gemini in one call with strict WhatsApp formatting rules. The output is delivered to my phone via Twilio's WhatsApp API. I initially used cron but switched to launchd after discovering cron's PATH issues and TCC permission blocks on modern macOS. The agent uses multi-key fallback — if one Gemini key is exhausted, it tries all 4 keys across 3 models."

---

## 13. Pre-Warming Strategy

**What:** Push analyst data into Redis cache before users request it, so responses are instant.

**Why:** Yahoo Finance blocks requests from Render's datacenter IPs. Fresh fetches fail. But from a local laptop, they work fine.

**How it works:**
```
Laptop (weekly):
  ./scripts/prewarm-cache.sh
    → Fetches analyst data for 32 stocks from Python yfinance service
    → POSTs to production: POST /api/cache-analyst {stocks: [...]}
    → Server stores in Redis (1-day TTL) + memory

User requests analyst data:
  → Server checks memory → found? Return (5ms)
  → Server checks Redis → found? Return (50ms)
  → Neither? Try Yahoo directly (usually blocked) → return error
```

**Interview answer:**
> "I implemented a pre-warming strategy where a local script fetches analyst data for all 32 stocks and pushes it to the production server's Redis cache. This solves a deployment constraint — Yahoo Finance blocks requests from cloud datacenter IPs, but allows residential IPs. By pre-warming from my laptop, the production server always has fresh cached data to serve. Users get sub-50ms responses. The endpoint also tracks which stocks users are requesting, so I can expand the prewarm list dynamically."

---

## 14. Production Architecture & Free-Tier Engineering

**What:** Running a full AI application at $0/month using free tiers of 8 services.

**Why:** Personal project — no budget, but production quality required because I use it daily.

**Services and limits:**
| Service | Free Tier Limit | Our Usage |
|---------|----------------|-----------|
| Vercel | 100GB bandwidth | ~1GB |
| Render | 750 hours/month | ~510 hours (Node.js only) |
| Upstash Redis | 10K commands/day | ~200 |
| Upstash Vector | 10K queries/day | ~50 |
| Gemini API | ~1500 RPD per key | ~200 (4 keys = 6000 effective) |
| Twilio WhatsApp | Sandbox (free) | 2 messages/day |
| Yahoo Finance | No formal limit | ~100 requests/day |
| TradingView | No formal limit | ~50 requests/day |

**Interview answer:**
> "I engineered the entire system to run on free tiers — Vercel for frontend, Render for backend, Upstash for Redis and Vector DB, Gemini for AI, and Twilio sandbox for WhatsApp. The key challenges were Render's random restarts (solved with Redis persistence), rate limits (solved with multi-key rotation), and Yahoo blocking datacenter IPs (solved with laptop pre-warming). UptimeRobot pings the Node.js service every 20 minutes to prevent Render's 15-minute sleep timeout. Total monthly cost: $0."

---

## Common Interview Questions (Cross-Cutting)

### "Walk me through the architecture"
> "It's a React frontend on Vercel, Node.js backend on Render, with Upstash Redis for persistent caching and Vector DB for semantic search. The AI layer uses Google Gemini with 4 API keys rotating across 3 model versions. There are three agent patterns: a ReAct tool-calling agent for chat, a 5-agent specialist system for deep analysis, and a LangGraph conditional graph for investment decisions. Data comes from Yahoo Finance, TradingView, and Google RSS. Daily WhatsApp briefings run autonomously via macOS launchd."

### "What was the hardest problem you solved?"
> "Rate limit resilience. Gemini free tier gives you 10 requests per minute. My deep analysis makes 5 sequential LLM calls. Early on, calls 3-4-5 would fail every time. I solved it with 4 API keys rotating round-robin, 3 model fallbacks per key, and 2-second delays between calls. Each call now has up to 12 fallback attempts. This took the success rate from ~50% to 95%+ without spending anything on API costs."

### "Why did you choose Gemini over GPT-4/Claude?"
> "Free tier. This is a personal project — I needed reliable AI without monthly costs. Gemini's free tier gives enough RPM across 4 keys to run multi-agent systems. The quality for structured analysis tasks — summarizing data, making comparisons, giving recommendations — is excellent. For a paid production system, I'd evaluate all three based on latency and output quality for financial text."

### "How would you scale this to 1000 users?"
> "Three changes: (1) Move from Gemini free tier to a paid tier or OpenAI with proper rate limits. (2) Replace the laptop prewarm with a cloud-scheduled function (AWS Lambda + EventBridge). (3) Add a queue (SQS/BullMQ) for multi-agent requests so they don't block the main thread. Redis and Vector DB already handle scale — Upstash auto-scales on paid plans."

### "What would you do differently if starting over?"
> "I'd use Gemini's native streaming API from day one instead of simulating it. I'd also set up proper error boundaries in the React components earlier — currently a failed API call can leave the UI in an awkward state. And I'd implement the LangGraph agent first instead of the linear multi-agent, since it's more flexible."

### "How do you test this?"
> "Unit tests for computation-heavy services (support/resistance calculation, cache service). Cypress E2E tests for the dashboard, navigation, and stock detail views. For AI outputs, I validate structure (does it contain a verdict? does it mention specific prices?) rather than exact text matching since LLM outputs are non-deterministic."

### "How does this demonstrate AI Engineering skills?"
> "It covers the core competencies: RAG pipeline design, multi-agent orchestration, LLM resilience engineering, vector embeddings, streaming UX, observability, and autonomous agent scheduling. I also built an MCP server — which is the emerging standard for AI tool integration. Every pattern here maps directly to enterprise use cases: RAG for document Q&A, multi-agent for complex workflows, LangGraph for approval pipelines, Vector DB for knowledge bases."

---

## Quick Reference: One-Liners for Each Concept

| Concept | One-liner for interviews |
|---------|------------------------|
| RAG | "Feed verified data to LLM at query time instead of relying on training knowledge" |
| ReAct Agent | "LLM decides which tools to call, observes results, repeats until it can answer" |
| Multi-Agent | "Specialist agents with focused prompts produce better output than one mega-prompt" |
| LangGraph | "State graph with conditional edges — skip expensive nodes when early analysis says AVOID" |
| Vector DB | "Convert text to numbers, find similar items by mathematical distance — no keywords" |
| Hybrid Cache | "Memory for hot data, Redis for persistent data — best of both worlds" |
| Session Memory | "Sliding window of 10 message pairs enables follow-up questions" |
| SSE Streaming | "Push text chunks to client in real-time instead of waiting for full response" |
| Observability | "Log every LLM call — model, key, timing, success — know exactly what's failing" |
| Multi-Key Resilience | "4 keys × 3 models = 12 attempts before graceful degradation" |
| MCP Server | "Standard protocol letting any AI IDE call my stock market tools" |
| Autonomous Agent | "launchd triggers script → fetches data → calls LLM → sends WhatsApp — zero human input" |
| Pre-Warming | "Push data from laptop to cloud cache before users need it" |
| Free-Tier Engineering | "8 services, $0/month — solved with caching, rotation, and graceful degradation" |

---

## Your Talking Points (Personalized)

**For AI Engineering Lead role (₹50-90 LPA):**

1. "I built and operate an AI system with 14 production features covering RAG, multi-agent, LangGraph, vector search, and autonomous scheduling — all at zero cost through resilience engineering."

2. "At my day job, I lead a team of 10 engineers and have built MCP integrations for Jira, TestRail, and GitHub. This personal project demonstrates hands-on AI engineering depth alongside team leadership."

3. "Every architectural decision — hybrid caching, multi-key rotation, conditional routing — emerged from solving real production constraints. I can explain the tradeoffs because I lived them."

4. "The system processes 32 stocks in real-time, runs 5-agent analysis, and delivers autonomous WhatsApp briefings — proving I can design, implement, and operate end-to-end AI systems."
