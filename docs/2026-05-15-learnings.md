# Daily Learnings — May 15, 2026 (Thursday)

## Features Built Today

### 1. MCP Server (Model Context Protocol) — Producer Side
- Built a complete MCP server with 5 tools for Indian stock market data
- Tools: `get_stock_price`, `get_nifty_levels`, `get_index_futures`, `get_commodity_futures`, `get_market_pulse`
- Tested from terminal (JSON-RPC), from Kiro (live integration), and across projects
- Published to GitHub, usable via absolute path in any project's `mcp.json`

**Key Learning:** MCP server = local process that declares tools via JSON-RPC over stdin/stdout. AI IDE starts it as a child process, discovers tools, and calls them when relevant to user's question. No HTTP, no ports, no CORS — just pipes.

**Files:** `mcp-server/` folder (separate from main app)

### 2. Conversation Memory — Session-Based Context
- Agent now remembers previous questions within a session
- Uses Gemini's `startChat({ history })` to pass conversation context
- Session stored in server memory (Map<sessionId, messages[]>)
- Sliding window: keeps last 10 Q&A pairs (prevents context overflow)
- Sessions expire after 30 minutes of inactivity
- Frontend generates UUID per session, sends with every request

**Key Learning:** ChatGPT-like memory = re-sending entire conversation history with each new question. The LLM doesn't actually "remember" — it re-reads everything each time.

**Files:** `server/src/services/agentService.ts`, `server/src/routes/api.ts`, `client/src/components/AgentChat.tsx`

### 3. Multi-Key Gemini Rotation
- 4 API keys rotating round-robin (1,000 RPD total)
- Automatic failover: if one key hits 429, tries next key
- Applied to both agentService and aiAnalysisService
- Eliminates "All models overloaded" error for normal usage

**Key Learning:** Free tier quota is per API key. Multiple keys from different Google accounts = multiplied quota. Round-robin distributes load evenly.

**Files:** `server/src/services/agentService.ts`, `server/src/services/aiAnalysisService.ts`, `server/.env`

### 4. Index Futures + Commodity Futures in AI Agent
- Moved from dashboard to AI Agent chat (keeps dashboard clean)
- Quick-action buttons: "📐 Nifty Levels", "📈 Futures", "🛢️ Commodities"
- No LLM cost — direct API calls to TradingView
- Buttons always visible at top of chat, each click shows fresh data

**Key Learning:** Not everything needs an LLM. Pre-calculated data (pivot levels) and direct API calls (futures) are instant, free, and more reliable.

**Files:** `client/src/components/AgentChat.tsx`, `server/src/routes/api.ts`, `client/src/App.css`

### 5. GIFT Nifty Gap Fix
- Changed from GIFT Nifty's own prev close to Nifty's latest price
- Now shows the actual opening gap prediction (GIFT Nifty - Nifty close)
- Accurate for morning pre-market assessment

### 6. Previous Close Bug Fix
- Fixed logic for when market is open (today's bar = null) vs closed (today's bar has value)
- Correctly identifies yesterday's close in both scenarios

## Architecture Concepts Discussed

### Multi-Agent System (Next Week's Build)
- Orchestrator → routes to specialist agents (Analyst, Technical, Risk)
- Synthesis Agent → combines all outputs into unified recommendation
- Shared state between agents (LangGraph pattern)
- Each agent has focused prompt + dedicated tools
- Parallel execution for speed, graceful degradation on failure

### MCP Protocol Deep Dive
- Transport: stdio (local) vs SSE (remote)
- Capabilities: Tools (we used), Resources, Prompts
- Distribution: npm publish → users install locally → runs on THEIR machine
- Security: process-level isolation, no network exposure
- Same pattern as Jira/GitHub MCPs — local bridge to cloud APIs

## Production Status
- All features deployed to production
- 4 Gemini API keys configured on Render
- Conversation memory working in production
- Quick-action buttons live

## Key Takeaways for Interviews

1. **MCP Producer:** "I built an MCP server from scratch — 5 tools, tested across projects, published to GitHub"
2. **Conversation Memory:** "Implemented session-based context with sliding window history management"
3. **Quota Management:** "Solved API rate limits with multi-key rotation and automatic failover"
4. **Architecture Thinking:** "Moved data-only features out of LLM path — zero cost, instant response"

## Tomorrow's Plan
- Streaming Responses (SSE) — word-by-word output like ChatGPT
- Then: Multi-Agent system with LangGraph

## Git Branches
- `feature/mcp-server` — merged to main ✅
- `feature/conversation-memory` — merged to main ✅
- Next: `feature/streaming-sse`
