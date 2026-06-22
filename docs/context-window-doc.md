# Context Window Limits — Deep Explanation

## What is a Context Window?

The context window is the **total amount of text** (measured in tokens) that an LLM can "see" in a single request. It includes EVERYTHING:

```
┌─────────────────────────────────────────────────┐
│              CONTEXT WINDOW                       │
│                                                   │
│  System Prompt         (~200 tokens)             │
│  + Conversation History (~2000 tokens)           │
│  + Retrieved Data/RAG  (~500 tokens)             │
│  + User's Question     (~50 tokens)              │
│  + Model's Response    (~500 tokens)             │
│                                                   │
│  TOTAL must fit within model's limit             │
└─────────────────────────────────────────────────┘
```

Think of it as the model's "working memory" — it can only hold so much at once.

## Token Basics

A token ≈ 4 characters ≈ 0.75 words (in English)

```
"Should I buy ICICI Bank?" = ~7 tokens
A paragraph of 100 words   = ~130 tokens
A full page of text        = ~500-700 tokens
A 10-page document         = ~5000-7000 tokens
```

## Model Context Window Sizes (2024-2026)

| Model | Context Window | In Pages (~) |
|-------|---------------|-------------|
| GPT-3.5 | 4K tokens | ~6 pages |
| GPT-4 | 8K-32K tokens | 12-48 pages |
| GPT-4 Turbo | 128K tokens | ~190 pages |
| Gemini 2.0 Flash | 1M tokens | ~1500 pages |
| Gemini 2.5 Flash | 1M tokens | ~1500 pages |
| Claude 3.5 | 200K tokens | ~300 pages |
| Llama 3 | 8K-128K tokens | 12-190 pages |

## Why Does It Matter?

### Problem 1: Exceeding the limit = Error
```
Input: 150K tokens into a 128K model
Result: API error "maximum context length exceeded"
```

### Problem 2: More context = More cost
```
GPT-4 pricing: $10 per 1M input tokens
  - 2K tokens per call × 1000 calls/day = $20/day
  - 50K tokens per call × 1000 calls/day = $500/day
  
Bigger context = exponentially more expensive at scale
```

### Problem 3: "Lost in the middle" problem
```
Even with large context windows, models perform WORSE 
on information placed in the MIDDLE of long contexts.

Beginning of context → well attended ✓
Middle of context → often ignored ✗
End of context → well attended ✓
```

## How We Handle It in Our Project

### Strategy 1: Selective Retrieval (what we do)
```
User asks: "Should I buy ICICI Bank?"

We DON'T dump all 32 stocks' data into context.
We retrieve ONLY ICICI Bank data:
  - Analyst data: ~200 tokens
  - Technicals: ~150 tokens  
  - Market pulse: ~100 tokens
  - System prompt: ~200 tokens
  - User question: ~10 tokens
  
Total: ~660 tokens (well under any limit)
```

### Strategy 2: Sliding Window Memory
```
Conversation grows over time:
  Message 1: 100 tokens
  Message 2: 100 tokens
  ...
  Message 20: 100 tokens → Total: 2000 tokens

Our solution: Keep only last 10 pairs (sliding window)
  - Old messages get dropped
  - Context stays bounded
  - User still gets conversation continuity
```

### Strategy 3: Focused Agent Prompts
```
Each multi-agent gets ONLY its data:
  - Analyst Agent → only fundamental data (not technicals)
  - Technical Agent → only price history (not news)
  - News Agent → only headlines (not fundamentals)

Each call: ~400-600 tokens total
Not: 2000+ tokens of everything jammed together
```

## How Enterprise Projects Handle Context Limits

### 1. Chunking + Retrieval (RAG at Scale)

**Problem:** Company has 10,000 documents (millions of tokens). Can't fit in context.

**Solution:**
```
10,000 documents
    │
    ▼ (split into chunks of 500 tokens each)
    │
200,000 chunks stored in Vector DB
    │
    ▼ (user asks a question)
    │
Vector search → retrieve TOP 5 most relevant chunks
    │
    ▼ (only 2,500 tokens go to LLM)
    │
LLM generates answer from just those 5 chunks
```

**Companies using this:** Every enterprise chatbot (Microsoft Copilot, Salesforce Einstein, etc.)

### 2. Map-Reduce Pattern

**Problem:** Analyze a 500-page legal contract. Doesn't fit in context.

**Solution:**
```
500-page contract
    │
    ▼ (split into 50 sections of 10 pages each)
    │
MAP phase: Send each section to LLM separately
    "Summarize key risks in this section"
    → 50 separate LLM calls, each ~2K tokens
    → 50 summaries (each ~200 tokens)
    │
    ▼
REDUCE phase: Send all 50 summaries to LLM
    "Combine these into a final risk assessment"
    → 1 LLM call with ~10K tokens
    → Final comprehensive answer
```

**Companies using this:** Legal tech (Harvey AI), financial analysis tools

### 3. Hierarchical Summarization

**Problem:** Chat history grows indefinitely. After 100 messages, context explodes.

**Solution:**
```
Messages 1-20  → Summarize into 1 paragraph (200 tokens)
Messages 21-40 → Summarize into 1 paragraph (200 tokens)
Messages 41-50 → Keep full (recent context matters)

Send to LLM:
  [Summary of old messages] + [Recent 10 messages in full]
  = ~600 tokens instead of 5000+
```

**Companies using this:** ChatGPT (auto-summarizes old conversation), customer support bots

### 4. Context Window Routing

**Problem:** Some queries need 1K tokens of context, others need 100K.

**Solution:**
```
User question → Classifier decides complexity:
  - Simple factual → Small model, minimal context (cheap, fast)
  - Complex analysis → Large model, full context (expensive, thorough)
  
"What's ICICI Bank's price?" → Gemini Flash, 500 tokens
"Compare all 30 Nifty stocks" → Gemini Pro, 50K tokens
```

**Companies using this:** OpenAI's routing in ChatGPT (picks GPT-4 vs GPT-3.5 based on query)

### 5. Agentic Retrieval (What we do)

**Problem:** Don't know upfront what data the user needs.

**Solution:**
```
User: "Compare ICICI and HDFC for long-term"

Agent decides at runtime:
  Round 1: get_analyst_data(ICICIBANK.NS) → +200 tokens
  Round 2: get_analyst_data(HDFCBANK.NS) → +200 tokens
  Round 3: get_technicals(ICICIBANK.NS) → +150 tokens
  Round 4: get_technicals(HDFCBANK.NS) → +150 tokens
  
Total retrieved: ~700 tokens (only what's needed)
NOT: dump all 32 stocks × all metrics = 20,000 tokens
```

## Context Window Best Practices (Enterprise)

| Practice | Why |
|----------|-----|
| Chunk documents to 500-1000 tokens | Balances relevance vs context size |
| Retrieve top 3-5 chunks, not 20 | More chunks = more noise, less focus |
| Put important info at START and END | "Lost in the middle" problem |
| Summarize old conversation, keep recent full | Bounded memory with continuity |
| Use metadata filtering before vector search | Reduces irrelevant results |
| Track token usage per call | Catch context bloat before it causes errors |
| Set max_tokens for output | Prevent unexpectedly long responses |

## How Our Project Compares to Enterprise

| Aspect | Our Project | Enterprise (e.g., Morgan Stanley) |
|--------|------------|----------------------------------|
| Documents | 32 stock profiles | 100,000+ research reports |
| Retrieval | Tool-based (agent decides) | Vector DB + metadata filters |
| Context per call | 500-2000 tokens | 10,000-100,000 tokens |
| Memory | 10-pair sliding window | Hierarchical summarization |
| Cost concern | Free tier limits | $10,000+/month LLM bills |
| Model choice | Gemini Flash (speed) | GPT-4/Claude (quality) |

## Interview Answer

> "Context window is the model's total working memory — everything from system prompt to conversation history to retrieved data must fit. In our project, I keep each call under 2K tokens through selective retrieval — the ReAct agent only fetches data relevant to the specific question. For conversation memory, I use a sliding window of 10 message pairs with 30-minute expiry, preventing unbounded growth.
>
> At enterprise scale, the challenge is much larger — imagine 100K documents. The standard approach is chunking documents into 500-token pieces, embedding them in a vector DB, and retrieving only the top 3-5 relevant chunks per query. For very long documents, you use map-reduce — summarize sections independently, then combine summaries. The key insight is: you never dump everything into context. You always retrieve selectively, because even with 1M token windows, models perform worse with irrelevant context and costs scale linearly with input size."

## Key Takeaway

> Large context window ≠ put everything in.
> 
> Even with Gemini's 1M token window, the principles remain:
> 1. Retrieve only what's relevant
> 2. Put important info at the edges (start/end)
> 3. Summarize old context, keep recent in full
> 4. Track costs — every token costs money at scale
