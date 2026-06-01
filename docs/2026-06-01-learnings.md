# Daily Learnings — June 1, 2026 (Sunday)

## Features Built & Fixed Today

### 1. Upstash Redis — Persistent Cache (Major Fix)
- **Problem:** In-memory cache wiped every time Render restarts (random restarts on free tier)
- **Solution:** Replaced in-memory cache with Upstash Redis (external cloud DB)
- **How it works:** Analyst data stored in Redis (survives any restart). Server reads from Redis on every request.
- **Hybrid approach:** Short-lived data (30s market pulse) stays in-memory. Long-lived data (analyst, 7-day TTL) goes to Redis.
- **Cost:** Free (Upstash free tier: 10K commands/day, 256MB)

**Key Learning:** In-memory cache is unreliable on free hosting. External cache (Redis) is the production-grade solution. Same pattern used by Netflix, Twitter, Instagram.

**Files:** `server/src/services/cacheService.ts`, `server/src/services/analystDataService.ts`

### 2. Multi-Agent Rate Limiting Fix
- **Problem:** 5 Gemini calls in quick succession → rate limited → agents fail
- **Solution 1:** Sequential calls with 2-second delays between agents
- **Solution 2:** Each `callGemini` now tries 3 keys × 3 models = 9 attempts before giving up
- **Result:** All 5 agents now respond reliably

**Key Learning:** Free tier LLMs have strict per-minute limits. Sequential + multi-key rotation + delays = reliable at scale.

### 3. Cache TTL Increase
- Changed prewarm cache TTL from 24 hours to 7 days
- Analyst data barely changes weekly — no need for daily expiry
- Even if you miss running prewarm for a few days, data persists

### 4. Render Service Resumed (June 1 Reset)
- Free tier hours reset on 1st of each month
- Configured UptimeRobot: Node.js at 20-min (awake), Python paused (saves hours)
- Strategy: ~510 hours/month for Node.js only = lasts full month

## Concepts Learned

### Redis as External Cache
```
In-memory (before):  Data lives in server RAM → lost on restart
Redis (after):       Data lives in cloud DB → survives everything
```

- Redis is a key-value store optimized for speed (~5ms reads)
- Upstash provides Redis as a REST API (no TCP connection needed)
- Hybrid cache: short TTL → memory, long TTL → Redis
- Same `cache.get()`/`cache.set()` interface — no code changes needed elsewhere

### Rate Limiting Strategies for LLMs
```
Problem: 10 RPM limit on Gemini free tier
Solutions applied:
  1. Sequential calls (not parallel)
  2. 2-second delays between calls
  3. Multi-key rotation (4 keys = 40 RPM effective)
  4. Multi-model fallback (3 models per key)
  5. Retry with different key on failure
```

### Render Free Tier Limitations
- 750 hours/month shared across all services
- Random restarts (container rebalancing)
- 15-min sleep on inactivity
- Solution: External cache + UptimeRobot + accept cold starts

## Production Status
- ✅ Dashboard live with Redis-backed cache
- ✅ Deep Analysis working (all 5 agents responding)
- ✅ UptimeRobot configured for month-long uptime
- ✅ Prewarm data persists in Redis (7-day TTL)

## Interview Talking Points

> "I implemented a hybrid caching strategy — in-memory for sub-minute data and Upstash Redis for persistent data. This solved the reliability issue on free-tier hosting where containers restart unpredictably."

> "For multi-agent LLM calls, I implemented rate-limit resilience with sequential execution, inter-call delays, multi-key rotation, and multi-model fallback. Each call attempts up to 9 key+model combinations before failing."

> "I understand the tradeoffs between in-memory cache (fast but volatile) and external cache (slightly slower but persistent). The hybrid approach gives both speed and reliability."

## Tomorrow's Plan
- Vector DB + Embeddings implementation
- Or continue with other improvements

## Git Commits Today
- `feat: Upstash Redis persistent cache`
- `fix: add 2s delay between multi-agent calls`
- `fix: multi-agent retries with multiple keys + 3 models`
- `fix: increase prewarm cache TTL to 7 days`
