# Intraday Mode — Feasibility Analysis

> Decision document before implementing intraday trading features.
> Read this fully before writing any code.

---

## 1. THE BIG QUESTION

**Can your current architecture support real-time intraday trading analysis?**

**Short answer:** Partially yes — with significant constraints and design changes.

**Why it's harder than your current daily analysis:**
- Daily analysis uses end-of-day data (1 API call per stock per day)
- Intraday needs minute-by-minute data (potentially 375+ data points per stock per day)
- Decisions must be made in seconds, not minutes
- Indian market window: 9:15 AM – 3:30 PM IST (only ~6 hours)
- Free hosting (Render) sleeps after 15 min inactivity — can't keep WebSocket connections

---

## 2. DATA AVAILABILITY ANALYSIS

### Yahoo Finance (Current Source)

**Intraday support:**
- ✅ Supports `interval=1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h`
- ✅ Free, no API key needed
- ⚠️ 1m data limited to last 7 days
- ⚠️ 5m data limited to last 60 days
- ⚠️ **15-20 minute delay for free tier** (not truly real-time)
- ⚠️ NSE symbols sometimes have gaps

**API endpoint we'd use:**
```
https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS
  ?range=1d&interval=5m
```

### TradingView Scanner (Already Using)

**Intraday support:**
- ✅ Near real-time prices (already used for futures)
- ✅ Free, no auth
- ⚠️ Snapshot only — no historical intraday bars
- ⚠️ Rate limited
- ❌ Can't compute VWAP/EMA from snapshots alone

### NSE Official APIs

- ⚠️ Limited rate (~5 req/sec)
- ⚠️ Blocks datacenter IPs (Render is blocked)
- ❌ Not viable without local proxy

### Paid Real-Time Feeds

| Provider | Cost | Latency |
|----------|------|---------|
| Zerodha Kite Connect | ₹2,000/month | <1 sec |
| Upstox Pro | ₹500-1500/month | <1 sec |
| Alpha Vantage Premium | $50/month | 1 min |
| TrueData | ₹4,000/month | <1 sec |

**Verdict:** For free tier, Yahoo 5-minute intraday with 15-min delay is the most practical. Real-time requires paid feed.

---

## 3. FEATURE-BY-FEATURE FEASIBILITY

### ✅ VWAP (Volume Weighted Average Price)
- **Formula:** Σ(Price × Volume) / Σ(Volume) — cumulative from market open
- **Data needed:** 5-min bars from 9:15 AM today
- **Feasibility:** HIGH — pure math on Yahoo intraday data
- **Effort:** Low (1 service file, ~50 LOC)

### ✅ Price vs VWAP
- **Calculation:** Current price - VWAP (positive = above VWAP = bullish)
- **Feasibility:** HIGH — derived from VWAP
- **Effort:** Trivial (5 LOC)

### ✅ VWAP Trend
- **Calculation:** VWAP slope over last 30-60 mins (rising/falling/flat)
- **Feasibility:** HIGH
- **Effort:** Low (computed alongside VWAP)

### ✅ 20 EMA / 50 EMA (Exponential Moving Average)
- **Formula:** Standard EMA formula on 5-min bars
- **Data needed:** Last 60+ minutes of 5-min bars (12 bars for 20 EMA)
- **Feasibility:** HIGH — pure math
- **Effort:** Low (already have SMA logic, EMA is similar)

### ✅ Opening Range High/Low (ORB)
- **Calculation:** Highest high + lowest low in first 15-30 mins of trading (9:15-9:45 AM)
- **Data needed:** 5-min bars from market open
- **Feasibility:** HIGH
- **Effort:** Low (filter bars by time range)
- **Use case:** Breakout strategy — buy when price crosses ORB high

### ✅ Today's High/Low
- **Source:** Yahoo Finance daily quote already has `dayHigh` and `dayLow`
- **Feasibility:** TRIVIAL — already available in your code
- **Effort:** Zero (already there)

### ✅ Volume Spike Detection
- **Calculation:** Current 5-min volume / Average 5-min volume (last 20 bars)
- **Threshold:** >2x average = spike
- **Feasibility:** HIGH
- **Effort:** Low (~30 LOC)

### ✅ ATR-based Stop Loss
- **ATR (Average True Range):** Volatility measure over N periods
- **Formula:** True Range = max(high-low, |high-prevClose|, |low-prevClose|)
- **Stop Loss:** Entry - (1.5 × ATR) for long, Entry + (1.5 × ATR) for short
- **Feasibility:** HIGH
- **Effort:** Medium (~50 LOC for ATR calculation)

### ⚠️ AI-Generated Entry, Stop, Target
- **Approach:** Feed all above signals to Gemini, get LLM recommendation
- **Feasibility:** HIGH — leverages existing AI infrastructure
- **Effort:** Low (~100 LOC, similar to your existing AI analysis service)
- **Cost:** 1 LLM call per intraday analysis = ~50 calls/day across stocks (within free tier)

### ⚠️ Intraday Confidence Score
- **Approach:** Composite score from signals:
  - VWAP signal (+/- points)
  - EMA cross signal
  - Volume spike
  - ORB breakout
  - ATR-favorable risk-reward
- **Feasibility:** HIGH — pure math, no LLM needed
- **Effort:** Low (~40 LOC for scoring engine)

---

## 4. ARCHITECTURE OPTIONS

### Option A: On-Demand Snapshot (Recommended for Free Tier)
```
User clicks "Intraday Analysis" → 
  Fetch last 5-min bars (1 API call) → 
  Calculate all indicators → 
  Single LLM call for recommendation → 
  Display
```
**Pros:**
- Works on free tier (no continuous monitoring needed)
- No WebSocket complexity
- Reuses existing patterns from your dashboard
- ~$0/month cost

**Cons:**
- Not "live" — user must refresh manually
- 15-min Yahoo delay means data is not real-time

### Option B: Polling Every 60 Seconds (Hybrid)
```
User opens intraday view → 
  Background poll every 60 sec → 
  Update indicators incrementally → 
  Alert if signal changes
```
**Pros:**
- Feels more "live"
- Decent for swing/positional intraday (not scalping)

**Cons:**
- Hits Render API limits faster
- Need to track market hours (only poll during 9:15 AM – 3:30 PM)
- Free tier may sleep between polls if user idle

### Option C: Real-Time WebSocket Streaming (Paid Tier Required)
```
Connect to Zerodha/Upstox WebSocket → 
  Receive tick-by-tick → 
  Update UI in real-time
```
**Pros:**
- True real-time (sub-second latency)
- Professional trading-grade

**Cons:**
- Requires Zerodha account + Kite Connect API (₹2,000/month)
- Free hosting can't keep WebSocket open (Render sleeps)
- Significant complexity increase
- Would need always-on backend (e.g., Railway, Fly.io paid)

---

## 5. RECOMMENDATION: Phased Implementation

### Phase 1 — On-Demand Intraday Mode (Now) ⭐
**Time:** 1 weekend
**Cost:** $0
**Implementation:**
- New service: `server/src/services/intradayService.ts`
- New endpoint: `GET /api/intraday/:symbol`
- Fetches 5-min bars from Yahoo (`?interval=5m&range=1d`)
- Computes: VWAP, EMA 20/50, ORB, Volume Spike, ATR
- Returns JSON with all signals + LLM-generated recommendation
- New page: `client/src/pages/IntradayPage.tsx`
- Manual refresh button (or auto-refresh every 60s when market open)

**Limitations:**
- 15-min data delay (Yahoo free)
- Not for scalping; works for swing intraday (10-min+ holding periods)

### Phase 2 — Polling + Alerts (Later, 2 weeks)
- Auto-refresh every 60 sec during market hours
- Alert via WhatsApp when signal crosses threshold (reuse Twilio code)
- Volume spike alerts in real-time

### Phase 3 — Real-Time (Future, if you go paid)
- Integrate Zerodha Kite Connect
- WebSocket streaming
- Sub-second indicator updates
- True scalping support

---

## 6. CODE STRUCTURE FOR PHASE 1

```
server/src/services/intradayService.ts     (~300 LOC)
  - fetchIntradayBars()
  - computeVWAP()
  - computeEMA(20, 50)
  - computeORB()
  - detectVolumeSpike()
  - computeATR()
  - computeConfidenceScore()

server/src/routes/api.ts
  - GET /api/intraday/:symbol
  - GET /api/intraday/:symbol/ai-analysis

client/src/pages/IntradayPage.tsx
  - Intraday metrics panel
  - VWAP chart
  - EMA crossover indicators
  - Confidence gauge
  - AI recommendation card

client/src/components/Intraday/
  - VWAPChart.tsx
  - EMAPanel.tsx
  - ORBPanel.tsx
  - ConfidenceGauge.tsx
  - AIRecommendation.tsx
```

---

## 7. RISKS & MITIGATIONS

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Yahoo intraday delayed by 15 mins | High | Display "as of" timestamp; market for swing not scalp |
| Render free tier sleeps mid-session | Medium | UptimeRobot at 10-min interval during market hours only |
| Yahoo blocks NSE symbols intermittently | Low | Cache last successful response + fallback to TradingView snapshot |
| LLM rate limits during heavy use | Low | Already handled by multi-key rotation |
| Users expect live ticks but get 5-min bars | Medium | Clear UI labeling: "5-min delayed data" |

---

## 8. WHAT WE NEED FROM YOU BEFORE CODING

1. **Confirm scope** — Phase 1 only (on-demand) or Phase 1+2 (polling/alerts)?
2. **Confirm stocks** — Same 9 stocks as daily briefing, or all 32?
3. **UI placement** — New page, new tab, or integrated into existing stock detail page?
4. **Auto-refresh** — On (every 60s when market open) or manual button?
5. **WhatsApp alerts** — Add intraday alerts on volume spike or wait for Phase 2?

---

## 9. EFFORT ESTIMATE

| Phase | Effort | Output |
|-------|--------|--------|
| Phase 1: On-demand intraday | ~12-16 hours (1 weekend) | All 11 features working |
| Phase 2: Polling + alerts | ~8 hours | Live-feel + WhatsApp alerts |
| Phase 3: Real-time WebSocket | ~30 hours + ₹2k/month | Pro-grade scalping mode |

---

## 10. MY HONEST RECOMMENDATION

**Build Phase 1 only for now.** Here's why:

1. **It's enough for your use case** — You're a swing/positional investor, not a scalper
2. **Free tier compatible** — No infrastructure changes
3. **Showcases more AI engineering** — Resume-worthy feature
4. **One-weekend project** — Doesn't derail your job search
5. **Validates demand** — If you use it daily and want more, then go to Phase 2

**Skip Phase 3 (Real-Time)** unless you actually start trading professionally — the cost (₹2,000/month + always-on hosting) isn't justified for personal use.

---

## DECISION POINT

Want to proceed with Phase 1 implementation? If yes, answer the 5 questions in Section 8 and we'll plan the build.

If you want to think more, fine — but let me know what additional analysis you need.
