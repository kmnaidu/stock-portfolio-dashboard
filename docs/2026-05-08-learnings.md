# Daily Learning Log — May 8, 2026

## Features Built Today

1. **AI Agent Chatbot** — Tool-calling agent with floating chat UI, ReAct pattern, model fallback chain
2. **Global Markets** — S&P 500, NASDAQ, Dow, Nikkei, Hang Seng, FTSE + Gold/Silver in Market Pulse
3. **52-Week High/Low** — Added to stock grid with stacked columns
4. **Market Pulse fix** — Correct previous close (was using 5-day-old data), 30-second refresh
5. **Stock Grid redesign** — Stacked columns, improved styling, alternating rows
6. **Requested-stocks tracker** — Server tracks what users visit, prewarm script auto-picks them up
7. **Dynamic prewarm script** — Reads from `prewarm-stocks.txt`, merges user requests, grows over time
8. **CORS fix** — Restricted to Vercel URL only
9. **Vercel Analytics** — Visitor tracking enabled
10. **LEARNINGS.md + AGENT.md** — Documentation
11. **LinkedIn post published** — Shared the project publicly

---

## Key Learnings

### AI Agents (ReAct Pattern)
- An AI agent is an LLM that can **take actions** (call tools), not just generate text
- Pattern: Think → Act → Observe → Think → Act → Observe → Answer
- The agent **decides** which tools to call based on the question
- Simple questions use 1 tool; complex questions use 3-4 tools
- This is how ChatGPT plugins, Claude tools, and enterprise AI assistants work

### Tool Calling
- You define tools as a "menu" (function declarations with descriptions)
- LLM reads the menu and picks which tools it needs
- Your code executes the tool and sends results back to the LLM
- The loop continues until LLM has enough info to answer

### RAG (Retrieval-Augmented Generation)
- Retrieve your data → Augment with context → Generate with LLM
- Your data gives **facts** (RSI 45, P/E 16.8, target ₹1,669)
- LLM adds **reasoning** (patterns, interpretation, actionable advice)
- Together: grounded intelligence, not hallucination

### What LLM Adds Beyond Your Data
- Pattern recognition ("neutral FII + slight down = consolidation historically")
- Market knowledge ("support around 24,000 is a psychological level")
- Sector rotation ("IT/Pharma for stability in neutral markets")
- Risk framing ("avoid aggressive longs until Nifty breaks 24,500")
- Actionable language ("Wait for dip to ₹1,240")

### Model Fallback & Reliability
- Free tier models get overloaded (503) or hit quota (429)
- Solution: try multiple models in sequence (2.5-flash → 2.0-flash → 2.0-flash-lite)
- Add retry with delay (3 seconds between attempts)
- Cache responses to reduce API calls

### Free Tier Economics
- Gemini: 250-1,000 calls/day (enough for ~60-250 agent questions)
- At scale: ₹0.008 per call → ₹2.40/month per user → charge ₹199/month = 98.8% margin
- Companies make AI profitable through caching, rate limiting, and subscription pricing

### AI Protocol Stack (2026)
- **MCP** — Model Context Protocol: standard for AI ↔ tools connection
- **ACP** — Agent Communication Protocol: agents in different frameworks talk
- **A2A** — Agent-to-Agent: cross-org collaboration + payments
- **Frontier Models** — The actual LLMs (Gemini, GPT, Claude)

### Dynamic Cache Strategy
- Server tracks which stocks users request (`/api/requested-stocks`)
- Prewarm script auto-merges new stocks into persistent file
- File only grows, never shrinks — accumulates over time
- Run daily to keep all tracked stocks cached

---

## Technical Decisions Made

| Decision | Why |
|----------|-----|
| Agent on stock detail page (not dashboard) | Needs rich context per stock |
| Floating chat button (not inline) | Available on every page without cluttering |
| Model fallback chain | Handles Google's frequent overloads |
| English-only filter | Gemini 2.5 leaks Chinese "thinking" text |
| Stacked grid columns | Compact like broker apps (High/Low in one column) |
| Requested-stocks tracker | Auto-discovers what users need without asking |
| prewarm-stocks.txt | Persistent, grows over time, survives deploys |

---

## Files Created/Modified Today

### New Files
- `server/src/services/agentService.ts` — AI Agent with tool calling
- `client/src/components/AgentChat.tsx` — Floating chat UI
- `client/src/components/GlobalMarkets.tsx` — Global indices component
- `scripts/prewarm-stocks.txt` — Persistent stock list for prewarm
- `AGENT.md` — Agent documentation
- `LEARNINGS.md` — Project learnings document
- `docs/2026-05-08-learnings.md` — This file

### Modified Files
- `server/src/routes/api.ts` — Added agent endpoint, global-markets, requested-stocks tracker
- `server/src/index.ts` — Wired agent service
- `server/src/services/marketPulseService.ts` — Fixed previous close, added Gold/Silver, 30s cache
- `server/src/services/aiAnalysisService.ts` — Model fallback
- `client/src/App.tsx` — Added AgentChat globally
- `client/src/App.css` — Agent chat styles, global markets, grid improvements
- `client/src/components/MarketPulse.tsx` — Gold/Silver, global markets inline, correct previous close
- `client/src/components/StockGrid.tsx` — 52W columns, stacked headers
- `client/src/components/StockRow.tsx` — 52W data, stacked cells
- `client/src/main.tsx` — Vercel Analytics
- `shared/types.ts` — fiftyTwoWeekHigh/Low fields
- `scripts/prewarm-cache.sh` — Dynamic stock list, auto-merge from server

---

## Production Status

- ✅ All features deployed and live
- ✅ AI Agent chatbot working (quota resets daily)
- ✅ Global markets showing 6 indices + Gold + Silver
- ✅ 52W High/Low in stock grid
- ✅ Requested-stocks tracker active
- ✅ LinkedIn post published
- ⚠️ Gemini daily quota exhausted (resets tomorrow)

---

## Next Steps (When Ready)

1. Multi-agent system (Level 2) — specialist agents that collaborate
2. Agent response caching — save Gemini calls
3. PWA support — installable on phone
4. LangGraph migration — proper agent framework

---

**Built by Krishna Naidu using Kiro AI IDE + Claude + Google Gemini**
