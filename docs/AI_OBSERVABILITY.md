# AI Observability — Documentation

## What Is AI Observability?

AI Observability is the practice of tracking, measuring, and monitoring every LLM (Large Language Model) interaction in your system. It answers:

- Is the AI working correctly?
- How much is it costing?
- Which models/keys are being used?
- Where are the failures?
- How fast are responses?

Without observability, your AI system is a black box — you can't improve what you can't measure.

## Our Implementation

### File: `server/src/services/aiObservability.ts`

### What Gets Tracked

Every Gemini API call logs:

| Field | Description | Example |
|---|---|---|
| `id` | Unique call identifier | `ai-47` |
| `timestamp` | When the call was made | `2026-05-16T14:30:00Z` |
| `type` | Which feature triggered it | `agent`, `multi-agent`, `ai-analysis` |
| `question` | User's question (truncated) | `"Should I buy Reliance?"` |
| `model` | Gemini model used | `gemini-2.5-flash` |
| `apiKeyIndex` | Which API key was used | `2` (key-3) |
| `toolsUsed` | Tools called during this interaction | `["get_analyst_data", "get_technicals"]` |
| `rounds` | Number of tool-call rounds | `3` |
| `responseTimeMs` | Total time from request to response | `4200` |
| `success` | Did the call succeed? | `true` / `false` |
| `error` | Error message if failed | `"429 Resource exhausted"` |
| `sessionId` | User's session (for conversation tracking) | `"abc-123"` |
| `tokensEstimate` | Estimated token usage | `1500` |

### Storage

- **In-memory array** (last 500 calls)
- Resets on server restart
- For production: would use a database or external service (Betterstack, Datadog)

## API Endpoints

### GET /api/ai-stats

Returns aggregated statistics about AI system health.

**Request:**
```bash
curl http://localhost:3001/api/ai-stats
```

**Response:**
```json
{
  "totalCalls": 47,
  "successCount": 42,
  "failureCount": 5,
  "successRate": "89.4%",
  "avgResponseTimeMs": 3200,
  "callsByModel": {
    "gemini-2.5-flash": 30,
    "gemini-2.0-flash": 17
  },
  "callsByKey": {
    "key-0": 12,
    "key-1": 13,
    "key-2": 11,
    "key-3": 11
  },
  "callsByType": {
    "agent": 20,
    "multi-agent": 25,
    "ai-analysis": 2
  },
  "errorsByModel": {
    "gemini-2.5-flash": 3,
    "gemini-2.0-flash": 2
  },
  "recentErrors": [
    {
      "timestamp": "2026-05-16T14:25:00Z",
      "model": "gemini-2.5-flash",
      "error": "429 Resource exhausted"
    }
  ],
  "topTools": {
    "get_stock_price": 15,
    "get_analyst_data": 12,
    "get_technicals": 10,
    "get_market_pulse": 8
  },
  "estimatedCostUSD": "$0.0035",
  "last24hCalls": 47,
  "peakHour": "10:00 (12 calls)"
}
```

### GET /api/ai-logs

Returns raw call logs for debugging.

**Request:**
```bash
curl http://localhost:3001/api/ai-logs?limit=5
```

**Response:**
```json
[
  {
    "id": "ai-47",
    "timestamp": "2026-05-16T14:30:00Z",
    "type": "multi-agent",
    "question": "Fundamental analysis for RELIANCE.NS",
    "model": "gemini-2.5-flash",
    "apiKeyIndex": 2,
    "toolsUsed": [],
    "rounds": 1,
    "responseTimeMs": 2100,
    "success": true,
    "tokensEstimate": 850
  }
]
```

## How It's Integrated

### Agent Service (agentService.ts)

```typescript
import { logAICall, estimateTokens } from './aiObservability.js';

// Before the call
const askStartTime = Date.now();

// On success
logAICall({
  type: 'agent',
  question,
  model: modelName,
  apiKeyIndex: currentKeyIndex,
  toolsUsed,
  rounds,
  responseTimeMs: Date.now() - askStartTime,
  success: true,
  tokensEstimate: estimateTokens(question + response),
});

// On failure
logAICall({
  type: 'agent',
  model: modelName,
  success: false,
  error: err.message,
  responseTimeMs: Date.now() - askStartTime,
  ...
});
```

### Multi-Agent Service (multiAgentService.ts)

Each specialist agent call (Analyst, Technical, Risk, News, Synthesis) is individually logged. A single Deep Analysis generates 5 log entries.

## Testing

### Local Testing

1. Start server: `cd server && npm run dev`
2. Make some AI calls (use the chatbot or Deep Analysis)
3. Check stats:
```bash
curl -s http://localhost:3001/api/ai-stats | python3 -m json.tool
```
4. Check logs:
```bash
curl -s http://localhost:3001/api/ai-logs?limit=10 | python3 -m json.tool
```

### What to Verify

| Check | Expected |
|---|---|
| Stats endpoint returns data | ✅ JSON with totalCalls > 0 |
| Success rate calculated | ✅ Percentage shown |
| Model distribution | ✅ Shows which models used |
| Key rotation visible | ✅ Calls spread across keys |
| Response time tracked | ✅ avgResponseTimeMs > 0 |
| Errors logged | ✅ recentErrors array populated on failures |
| Console output | ✅ `[AI ✓]` or `[AI ✗]` lines in terminal |

### Console Output Format

```
[AI ✓] agent | gemini-2.5-flash | key-2 | 3200ms | tools: get_stock_price,get_technicals
[AI ✓] multi-agent | gemini-2.5-flash | key-3 | 2100ms | tools: none
[AI ✗] agent | gemini-2.5-flash | key-1 | 450ms | tools: none
```

## Key Metrics to Monitor

| Metric | Healthy | Warning | Critical |
|---|---|---|---|
| Success Rate | > 90% | 70-90% | < 70% |
| Avg Response Time | < 5s | 5-10s | > 10s |
| Error Rate | < 10% | 10-30% | > 30% |
| Key Distribution | Even spread | One key dominant | One key exhausted |
| Cost per day | < $0.01 | $0.01-0.10 | > $0.10 |

## Future Enhancements

1. **Persistent storage** — Save to file/database (survives restarts)
2. **Dashboard UI** — Visual charts in the frontend
3. **Alerts** — Notify when error rate spikes
4. **A/B testing** — Compare prompt versions by tracking quality scores
5. **User feedback** — Track thumbs up/down on AI responses
6. **Token-level tracking** — Use Gemini's actual token count (not estimate)

## Interview Talking Points

> "I built an AI observability layer that tracks every LLM call — model used, API key rotation, response time, token count, and success rate. I can see which keys are hitting limits, which models fail most, and what the cost per query is. This lets me optimize prompts, manage costs, and debug failures."

> "The system logs 500 recent calls in-memory with aggregated stats available via API. In production, this would feed into Datadog or a dedicated LLM observability tool like LangSmith."
