# 🤖 AI Agent — Tool-Calling Stock Assistant

## Overview

The Stock Assistant is an AI agent that answers natural language questions about Indian stocks by autonomously deciding which data tools to call, gathering information, and generating intelligent responses.

**Pattern:** ReAct (Reasoning + Acting) — the agent thinks, acts (calls tools), observes results, and repeats until it has enough information to answer.

**LLM:** Google Gemini (2.5 Flash → 2.0 Flash → Flash Latest fallback chain)

---

## How It Works

```
User: "Should I buy ICICI Bank?"
         │
         ▼
┌─ AGENT LOOP (max 5 rounds) ───────────────────────────────┐
│                                                            │
│  Round 1: Agent sends question + tool menu to Gemini       │
│           Gemini decides: "I need analyst data"            │
│           → Returns: tool_call(get_analyst_data, ICICIBANK.NS) │
│           → Agent executes tool, gets data                 │
│                                                            │
│  Round 2: Agent sends tool result back to Gemini           │
│           Gemini decides: "I also need technicals"         │
│           → Returns: tool_call(get_technicals, ICICIBANK.NS)   │
│           → Agent executes tool, gets data                 │
│                                                            │
│  Round 3: Agent sends tool result back to Gemini           │
│           Gemini decides: "I have enough info"             │
│           → Returns: final text answer                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
         │
         ▼
User sees: "Wait for dip to ₹1,240. Strong fundamentals 
            but short-term weakness..."
```

---

## Available Tools

The agent has access to 4 tools (your existing services):

| Tool | What It Does | When Agent Uses It |
|------|-------------|-------------------|
| `get_stock_price(symbol)` | Current price, daily change, volume | Price queries, basic info |
| `get_analyst_data(symbol)` | Analyst targets, P/E, PEG, growth, consensus | Valuation, buy/sell opinion |
| `get_technicals(symbol)` | RSI, MACD, support/resistance, SMAs, verdict | Entry/exit timing, levels |
| `get_market_pulse()` | Nifty, Sensex, FII/DII, overall sentiment | Market safety, macro view |

**Key insight:** The agent decides WHICH tools to call based on the question. Simple questions use 1 tool. Complex questions use 3-4.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend: AgentChat.tsx (floating chat panel)              │
│  - Floating 🤖 button (bottom-right)                       │
│  - Chat messages with markdown rendering                   │
│  - Suggestion buttons for common questions                 │
│  - Shows tools used + rounds per response                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ POST /api/agent { question }
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: agentService.ts                                  │
│  - Defines tool declarations (menu for Gemini)             │
│  - Implements tool executors (call existing services)      │
│  - Runs the ReAct loop (think → act → observe → repeat)   │
│  - Model fallback chain (2.5 → 2.0 → latest)              │
│  - Retry with 3s delay on 503 overload                     │
│  - Filters non-English "thinking" text from response       │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌──────────────┐  ┌──────────────┐
   │ Yahoo      │  │ Analyst Data │  │ Market Pulse │
   │ Finance v8 │  │ Service      │  │ Service      │
   │ (prices)   │  │ (Python/yf)  │  │ (macro)      │
   └────────────┘  └──────────────┘  └──────────────┘
```

---

## Example Questions & Tool Usage

| Question | Tools Called | Rounds |
|----------|-------------|--------|
| "What's Reliance price?" | get_stock_price | 2 |
| "Should I buy ICICI Bank?" | get_stock_price, get_analyst_data, get_technicals | 4 |
| "Is the market safe today?" | get_market_pulse | 2 |
| "What's HAL support level?" | get_technicals | 2 |
| "Compare HDFC and SBI" | get_analyst_data ×2, get_stock_price ×2 | 4-5 |
| "Market prediction next week" | get_market_pulse + LLM knowledge | 2 |
| "What is P/E ratio?" | None (LLM knowledge only) | 1 |

---

## Key Design Decisions

### 1. Tool-Calling vs Hardcoded Flow
**Before (AI Analysis button):** Code always fetches analyst + technicals + market pulse, regardless of question.
**Now (Agent):** Gemini decides what to fetch based on the question. Efficient — simple questions use 1 tool.

### 2. Model Fallback Chain
```
gemini-2.5-flash → gemini-2.0-flash → gemini-flash-latest
```
Each model is tried twice with 3-second delay between retries. Handles Google's frequent 503 overload errors.

### 3. English-Only Filter
Gemini 2.5 Flash sometimes leaks internal "thinking" in Chinese. A regex filter strips non-Latin characters from the response before showing to user.

### 4. Safety Limits
- Max 5 rounds per question (prevents infinite loops)
- 60-second timeout per API call
- Graceful error messages ("models overloaded, try again")

### 5. System Prompt Design
The agent is instructed to:
- Use tools for live data, own knowledge for general questions
- Always respond in English
- Be concise (max 250 words)
- End with clear action (Buy/Hold/Wait/Avoid)
- Add "Not financial advice" disclaimer

---

## Files

| File | Purpose |
|------|---------|
| `server/src/services/agentService.ts` | Agent logic: tools, executors, ReAct loop |
| `server/src/routes/api.ts` | `POST /api/agent` endpoint |
| `server/src/index.ts` | Wires agent service with dependencies |
| `client/src/components/AgentChat.tsx` | Floating chat UI component |
| `client/src/App.tsx` | Mounts AgentChat globally |
| `client/src/App.css` | Chat panel + FAB button styles |

---

## How to Extend (Add New Tools)

To add a new tool (e.g., `get_news` for stock news):

### 1. Add tool declaration
```typescript
// In agentService.ts, add to toolDeclarations array:
{
  name: 'get_news',
  description: 'Get recent news headlines for a stock',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      symbol: { type: SchemaType.STRING, description: 'Stock symbol' },
    },
    required: ['symbol'],
  },
}
```

### 2. Add tool executor
```typescript
// In createToolExecutors, add:
async get_news({ symbol }) {
  // Call your news service/API
  const news = await newsService.getNews(symbol);
  return JSON.stringify(news);
}
```

### 3. Update ToolExecutors interface
```typescript
interface ToolExecutors {
  // ... existing tools
  get_news: (args: { symbol: string }) => Promise<string>;
}
```

That's it. The agent will automatically start using the new tool when questions are relevant to news.

---

## Cost & Limits

| Metric | Value |
|--------|-------|
| Gemini free tier | 1,500 requests/day |
| Avg rounds per question | 2-4 |
| Avg questions per day (free) | ~375-750 |
| Cost if exceeded | ₹0.008 per request |
| Max rounds per question | 5 (safety limit) |

---

## Future Enhancements (Level 2: Multi-Agent)

The current agent is a single agent with multiple tools. The next level is **multiple specialized agents** that collaborate:

```
Orchestrator Agent
├── Analyst Agent (fundamentals specialist)
├── Technical Agent (chart patterns specialist)
├── Risk Agent (market conditions specialist)
└── Synthesis Agent (combines all opinions)
```

Each agent has its own system prompt optimized for its specialty. The orchestrator decides which agents to consult based on the question complexity.

---

## Concepts Learned

| Concept | What It Means |
|---------|---------------|
| **ReAct Pattern** | Think → Act → Observe → Repeat until answer |
| **Tool Calling** | LLM requests to execute external functions |
| **Function Declarations** | Schema that tells LLM what tools exist |
| **Agent Loop** | Code that manages the think-act-observe cycle |
| **Model Fallback** | Try multiple models for reliability |
| **System Prompt** | Instructions that shape agent behavior |
| **Grounding** | Using real data (tools) instead of hallucinating |

---

**Built by Krishna Naidu — Tool-Calling AI Agent using Google Gemini + ReAct Pattern**
