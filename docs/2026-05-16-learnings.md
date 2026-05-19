# Daily Learnings — May 16, 2026 (Friday)

## Features Built Today

### 1. Multi-Agent System (Deep Analysis)
- Built 5 specialist agents: Analyst, Technical, Risk, News, Synthesis
- Orchestrator routes questions (rule-based, no LLM cost)
- All 4 specialist agents run in PARALLEL (Promise.all) for speed
- Synthesis Agent combines all outputs into final recommendation
- Includes next-week forecast with support/resistance levels
- "🔬 Deep Analysis" button in AI Agent chat (toggles to "💬 Normal Chat")
- Deep analysis mode persists — user can analyze multiple stocks without re-clicking

**Key Learning:** Multi-agent = divide and conquer. Each agent has a focused prompt (100 words max) and dedicated data source. Better quality than one agent trying to do everything.

**Files:** `server/src/services/multiAgentService.ts`, `server/src/routes/api.ts`, `server/src/index.ts`, `client/src/components/AgentChat.tsx`

### 2. News Agent (Google News RSS)
- Fetches recent headlines from Google News RSS (free, no API key)
- Gemini summarizes impact with emojis: 🟢 Positive / 🔴 Negative / 🟡 Mixed
- Clean user-friendly format instead of raw [HIGH][NEGATIVE] tags

**Key Learning:** Google News RSS is a free, reliable news source for AI context. No API key, no rate limits, always fresh.

### 3. Symbol Validation & Smart Mapping
- Frontend maps common names to NSE symbols (HDFC → HDFCBANK.NS, INFOSYS → INFY.NS)
- Handles typos (HDDFC → HDFCBANK.NS)
- Strips extra words ("INFOSYS WITH NEWS" → INFY.NS)
- Backend validates symbol against Yahoo before running agents
- Invalid symbols get helpful error with suggestions (no wasted Gemini calls)
- ETFs get proper message ("analyst recommendations not applicable")

### 4. Streaming Fallback
- If SSE streaming returns empty, falls back to POST endpoint
- Shows proper error message when all Gemini keys exhausted
- No more empty gray bubbles in chat

### 5. Auto-Prewarm on Startup (Attempted)
- Added retry logic (5 attempts × 45s) for Python service cold start
- Changed PYTHON_SERVICE_URL to public URL (wakes sleeping service)
- Result: Yahoo blocks Render datacenter IPs — auto-prewarm unreliable
- Conclusion: Manual laptop prewarm remains the reliable path

### 6. UptimeRobot Configuration
- Changed from 5-min to 20-min interval (saves instance hours)
- Only Node.js service monitored (Python paused)
- Keeps cache alive between visits

## Architecture Concepts Learned

### Multi-Agent Pattern
```
User Question → Orchestrator (free, rule-based)
  → Specialist Agents (parallel, focused prompts)
  → Synthesis Agent (combines all)
  → Final Answer (streamed)
```

### Key Design Decisions
- **Explicit button (Option B)** — user chooses when to go deep
- **Toggle UX** — "Deep Analysis" ↔ "Normal Chat" button
- **Parallel execution** — all specialists run simultaneously
- **Graceful degradation** — if one agent fails, others still work
- **Symbol validation first** — don't waste Gemini calls on invalid symbols

### Cost Per Deep Analysis
- 5 Gemini calls (4 specialists + 1 synthesis)
- With 4 keys (1,000 RPD): ~200 deep analyses per day
- Simple questions still use single agent (1 call)

## Issues Encountered & Solutions

| Issue | Root Cause | Solution |
|---|---|---|
| "Analysis unavailable" for all agents | Gemini quota exhausted | Multi-key rotation + proper error message |
| HDDFC not mapping to HDFC Bank | Name map checked after .NS added | Map raw name before adding suffix |
| Empty gray bubble in chat | Streaming returns empty on quota error | Don't add message until first chunk arrives |
| Deep analysis stuck (can't go back) | No way to exit deep mode | Toggle button: Deep Analysis ↔ Normal Chat |
| ETF shows "analyst unavailable" | ETFs don't have analyst coverage | Detect ETFs, show proper explanation |
| Auto-prewarm fails on Render | Yahoo blocks datacenter IPs | Accept limitation, use laptop prewarm |
| Cache lost after Render sleep | In-memory cache wiped on restart | UptimeRobot 20-min keeps service awake |

## Production Status
- Multi-agent on feature branch (pending merge after quota test)
- UptimeRobot configured at 20-min interval
- 4 Gemini keys active (quota exhausted today from testing)

## Interview-Ready Statements

> "I built a multi-agent system with 5 specialist agents — Analyst, Technical, Risk, News, and Synthesis. Each has a focused prompt and dedicated data source. They run in parallel for speed, and the Synthesis agent combines outputs into an actionable recommendation with next-week forecast."

> "I implemented graceful degradation — if one agent fails, the system continues with available data. Invalid symbols are caught before any LLM calls, saving quota."

> "The News Agent uses Google News RSS for real-time market context — free, no API key, integrated into the analysis pipeline."

## Tomorrow's Plan
- Test multi-agent with fresh Gemini quota
- Fix any remaining issues
- Merge to main and deploy to production
- Start AI Evaluation & Observability (track response quality, cost per query)

## Git Branch
- `feature/multi-agent` — ready for testing and merge
