# VWAP Intraday Trading Guide

A practical reference for using VWAP (Volume Weighted Average Price) to make buy/sell decisions in Indian intraday trading.

---

## Table of Contents

1. [What is VWAP](#what-is-vwap)
2. [The Formula](#the-formula)
3. [Why Institutions Use VWAP](#why-institutions-use-vwap)
4. [The Four Core Signals](#the-four-core-signals)
5. [Do-Not-Trade Zones](#do-not-trade-zones)
6. [Complete Decision Flow](#complete-decision-flow)
7. [Multi-Signal Combinations](#multi-signal-combinations)
8. [Honest Risk Warnings](#honest-risk-warnings)
9. [Path to ₹2K/Day](#path-to-2k-day)
10. [Daily Routine Template](#daily-routine-template)
11. [Trade Journal Template](#trade-journal-template)

---

## What is VWAP

**VWAP = Volume Weighted Average Price**

It's the average price at which a stock has traded today, weighted by the volume at each price level. Unlike a simple moving average, VWAP gives more importance to bars where lots of shares changed hands.

VWAP starts fresh every trading day at 9:15 AM IST and accumulates until 3:30 PM. It's a **cumulative** indicator — meaning every new 5-min bar adds to it, but bars never drop off.

---

## The Formula

```
VWAP = Σ(Typical Price × Volume) / Σ(Volume)
```

For each 5-minute bar:

```
Typical Price (TP) = (High + Low + Close) / 3
```

Then you multiply TP × Volume for each bar, sum across the whole day, and divide by total volume:

```
For each bar from 9:15 AM to now:
  TP_bar = (High_bar + Low_bar + Close_bar) / 3
  totalPV += TP_bar × Volume_bar
  totalVolume += Volume_bar

VWAP = totalPV / totalVolume
```

### Worked Example

First 3 bars of a hypothetical RELIANCE session:

| Bar | Time | High | Low | Close | Volume | TP = (H+L+C)/3 | PV = TP × V |
|---|---|---|---|---|---|---|---|
| 1 | 9:15-9:20 | 1305 | 1300 | 1303 | 50,000 | 1302.67 | 65,133,500 |
| 2 | 9:20-9:25 | 1308 | 1302 | 1306 | 80,000 | 1305.33 | 104,426,400 |
| 3 | 9:25-9:30 | 1310 | 1305 | 1307 | 60,000 | 1307.33 | 78,439,800 |

After Bar 3:
- Total PV = 65,133,500 + 104,426,400 + 78,439,800 = 247,999,700
- Total V = 50,000 + 80,000 + 60,000 = 190,000
- **VWAP = 247,999,700 / 190,000 = ₹1,305.26**

Notice the VWAP is pulled toward Bar 2's typical price because Bar 2 had the highest volume.

---

## Why Institutions Use VWAP

VWAP isn't magic — it works because **institutions are mechanically forced to use it as their execution benchmark**.

When a mutual fund manager is told to buy ₹100 crore of Reliance today, his execution gets graded:
- Bought below VWAP → "good execution" → bonus
- Bought above VWAP → "bad execution" → questions get asked

This creates predictable behavior you can ride:
- Price dips below VWAP → institutions step in to buy → price bounces back
- Price rallies above VWAP → institutions take profits → price fades back

**Retail traders use VWAP because institutions are forced to. You're piggy-backing on their footprints.**

---

## The Four Core Signals

### Signal 1: Price Above VWAP → Bullish Bias

**What it means**: Buyers have been paying a premium today. Average buyer is profitable.

**Trade idea (Long)**:
- Wait for a pullback to VWAP that holds
- Enter on a strong green 5-min candle bouncing off VWAP
- Stop loss: just below VWAP (₹2–5 below)
- Target: previous day's high, or +0.5% to +1% above entry

**Example**:
- HAL at ₹4,342, VWAP at ₹4,321
- Price dips to ₹4,322 (touching VWAP)
- Next 5-min candle closes green at ₹4,330
- BUY at ₹4,330 | SL ₹4,318 | Target ₹4,360
- Risk: ₹12 | Reward: ₹30 | R:R = 1:2.5

---

### Signal 2: Price Below VWAP → Bearish Bias

**What it means**: Sellers in control. Average seller is winning. Don't catch falling knives.

**Trade idea (Short via futures)**:
- Wait for a rally up to VWAP that fails
- Enter on a red rejection candle at VWAP
- Stop loss: above VWAP
- Target: previous day's low

**For cash market** (no shorting available):
- Don't buy stocks below VWAP intraday
- Wait for a VWAP reclaim (Signal 3) before going long

---

### Signal 3: VWAP Reclaim → Highest Probability Setup

**This is the gold standard setup.**

When price has been below VWAP for 30+ minutes, then breaks above and holds → seller supply absorbed, buyers now in control.

**Setup Checklist**:
- [ ] Stock below VWAP for at least 30–45 minutes (sustained, not brief)
- [ ] One 5-min candle closes clearly above VWAP
- [ ] Next 5-min candle confirms by holding above VWAP
- [ ] Breakout candle volume is higher than the previous 3-4 bars average
- [ ] Broader market (Nifty) also bullish or neutral

**Entry**: After the second confirmation candle closes above VWAP
**Stop Loss**: Below the breakout candle's low, just under VWAP
**Target**: Risk-to-reward minimum 1:2

**Example flow**:
- 10:30 AM: TCS trading at ₹3,200, VWAP at ₹3,215 (15 below)
- 11:00 AM: Still below VWAP
- 11:30 AM: 5-min candle breaks and closes at ₹3,220 (above VWAP ₹3,217)
- 11:35 AM: Next candle holds at ₹3,224, volume 1.8× average
- Entry: ₹3,224 | SL: ₹3,213 (below VWAP) | Target: ₹3,246 (1:2 R:R)

---

### Signal 4: VWAP Rejection → Reversal Short

Mirror image of reclaim. Stock above VWAP earlier, drops below, rallies back, fails at VWAP.

**Setup**:
- Stock previously above VWAP
- Drops below VWAP
- Rallies back, tags VWAP, but the next candle is red with rejection wick
- Rejection candle volume picks up

**Trade**: Short on rejection close, SL above VWAP, target previous low.

---

## Do-Not-Trade Zones

This is what loses retail traders money. Recognize these states and **stay out**.

### 1. Price at VWAP (within ±0.1%)
Bulls and bears evenly matched. Most chop happens here. Wait for direction.

### 2. Flat VWAP slope
If VWAP itself is moving sideways across the day, the stock has no conviction. Stay out.

### 3. First 15 minutes (9:15–9:30 AM)
VWAP needs volume to be meaningful. First 3 bars are noise. **Do not trade VWAP signals before 9:45 AM IST.**

### 4. Low-volume stocks
VWAP works on liquid large-caps: RELIANCE, HDFCBANK, ICICIBANK, INFY, TCS, HAL, SBIN, BHARTIARTL, LT, ITC. Avoid mid-caps and small-caps for VWAP signals — too easy to manipulate.

### 5. News event days
Earnings announcements, RBI meets, budget day, US Fed days → VWAP becomes meaningless because new information dominates. Stay out unless you specifically trade news.

### 6. Last 30 minutes (3:00–3:30 PM)
Closing auction volatility distorts signals. Square off existing positions, don't enter new ones.

---

## Complete Decision Flow

Use this checklist before every trade:

### Step 1: Market Context (Nifty)
- Nifty above its own VWAP → bias LONG on stocks above their VWAP
- Nifty below its own VWAP → bias SHORT or sit out
- Nifty within ±0.1% of VWAP → **no-trade day**

### Step 2: Stock Position
- Above + bouncing off VWAP → long candidate
- Below + rejecting at VWAP → short candidate
- At VWAP → wait, no trade

### Step 3: Volume Confirmation
- Breakout candle volume > 1.5× average → strong signal
- Breakout on weak volume → trap, **skip**

### Step 4: Define Risk Before Entry
- Stop loss: ₹X below entry (concrete number)
- Target: ₹2X–3X above entry
- Position size: max **1% of capital** risked per trade

### Step 5: Time-Based Exit
- If trade hasn't moved in 1 hour → exit
- If reaching 3:00 PM → square off no matter what

---

## Multi-Signal Combinations

VWAP alone has ~55–60% accuracy. Combine with these for 65–70%:

| Combination | Why it works |
|---|---|
| VWAP reclaim + RSI(14) crossing above 50 | Trend reversal + momentum confirms |
| VWAP reclaim + previous day's close held | Strong support reinforced |
| VWAP reclaim + above 20-EMA on 5-min | Short-term trend agrees |
| VWAP rejection + RSI bearish divergence | Classic short setup |
| Price > VWAP + Nifty > Nifty VWAP | Both stock and market aligned |
| VWAP reclaim + buy range (from your analyzer) | Multi-timeframe confluence |

Your dashboard already shows RSI, SMA20/50/200, support/resistance, buy range. **Pair VWAP with those** for the strongest setups.

---

## Honest Risk Warnings

**1. SEBI data is real**: 90% of intraday traders lose money over 3 years. Average loss ₹1.1 lakh. The 10% who profit are mostly using algos and faster feeds.

**2. Yahoo's 15-min delay is a real handicap**: By the time you see a VWAP reclaim signal, the move may already be 15 min old. Professional traders see it live.
- **Fix**: For real money, use a broker terminal (Zerodha Kite, Upstox) with live data. Use this dashboard for *learning* and identifying setups.

**3. Costs eat returns**:
   - Brokerage: ~0.03% (Zerodha intraday)
   - STT on sell: 0.025%
   - GST + stamp duty + exchange: ~0.01%
   - **Total round-trip**: ~0.07%
   - To earn ₹1000 net on ₹50,000 capital, you need ~2.07% gross move (significant)

**4. Psychology is the killer**: VWAP gives ~5–10 quality setups per week. Most people overtrade (5+ per day), take bad setups, and give back profits to costs.

**5. Don't trade with money you can't lose**: First 3 months should be paper trading or maximum ₹20,000 real capital. Treat it as tuition fee.

---

## Path to ₹2K/Day

### The Math

**Target**: ₹2,000 net per day = ₹40,000/month (20 trading days)

**Realistic win rate**: 55–60% for a disciplined VWAP trader after 3 months of practice

**Realistic R:R**: 1:2 on winning trades, 1:1 stop on losing trades

**Expected value per trade**:
- Win 60% × +0.7% = +0.42%
- Loss 40% × -0.5% = -0.20%
- **Net per trade**: +0.22% (before costs)
- After costs (-0.07%): **+0.15% net per trade**

### Capital Required

To make ₹2,000 net per trade at 0.15% EV:
```
Required capital = ₹2,000 / 0.0015 = ₹13.3 lakh
```

That's *per trade*. Realistically you'll take 2–3 trades per day.

**For 2 trades/day to net ₹2,000/day**:
```
Required capital = ₹13.3 lakh / 2 = ~₹6.5 lakh
```

**With intraday margin (5x leverage on Zerodha MIS)**:
```
Required own capital = ~₹1.3–1.5 lakh
```

⚠️ **Warning**: Leverage cuts both ways. A bad day can wipe out a week's profit. Use leverage cautiously.

### Phased Roadmap

**Phase 1 — Paper Trading (Weeks 1–4) — Cost ₹0**
- Use TradingView paper trading or Sensibull paper trade
- Take only VWAP reclaim setups on top 7 stocks (RELIANCE, HDFCBANK, ICICIBANK, INFY, TCS, HAL, SBIN)
- Max 3 trades/day
- Log everything in trade journal
- **Goal**: 50 trades logged. Win rate > 55%.

**Phase 2 — Small Real Money (Weeks 5–12) — Capital ₹20,000**
- Trade ₹20,000 cash, no leverage
- Target ₹200–400 per day net
- Same 7 stocks, same setups
- Continue journal
- **Goal**: 3 consecutive profitable months

**Phase 3 — Scale Up (Month 4+) — Capital ₹1–2 lakh**
- Add 5x intraday margin (MIS orders)
- Target ₹1,000–2,000 per day
- Expand to 10–12 stocks
- **Goal**: ₹40K/month average over 6 months

**Phase 4 — Full Routine (Month 10+) — Capital ₹3–5 lakh own + margin**
- Target ₹2K/day consistently
- Develop your own variations of VWAP setups
- Optionally add weekly options selling for additional income

---

## Daily Routine Template

### Pre-Market (8:30–9:15 AM)
- [ ] Check Nifty futures (your dashboard's Index Futures section)
- [ ] Check global cues (S&P 500, Nasdaq, Asia open)
- [ ] Check FII/DII data from previous day
- [ ] Note any earnings/results today
- [ ] Set 3 stocks to watch (top 7 list, choose 3 with biggest gaps)

### Market Open (9:15–9:45 AM)
- [ ] **Do not trade**. Watch only.
- [ ] Note opening range (first 15 min high/low) for each watch stock
- [ ] Note VWAP development direction
- [ ] Note Nifty behavior (above/below its VWAP)

### Trading Window (9:45 AM–3:00 PM)
- [ ] Check setups every 15 min
- [ ] Only enter on Signal 3 (VWAP reclaim) or Signal 4 (VWAP rejection)
- [ ] Set SL and target **at entry** — never adjust SL against you
- [ ] Max 3 trades per day. Stop after 2 losses in a row.

### Square Off (3:00–3:15 PM)
- [ ] Close all positions, even profitable ones
- [ ] Don't carry intraday positions to next day

### Post-Market (4:00 PM)
- [ ] Update trade journal
- [ ] Review what worked / didn't work
- [ ] Note one lesson for tomorrow

---

## Trade Journal Template

Keep this in a Google Sheet. Update after every trade.

| # | Date | Stock | Setup | Entry | SL | Target | Exit | P/L ₹ | R:R | Win/Loss | Why? | Lesson |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 30-Jun | RELIANCE | VWAP reclaim | 1310 | 1306 | 1320 | 1318 | +8 | 1:2 | W | Volume strong | Pattern repeated cleanly |
| 2 | 30-Jun | TCS | VWAP reject | 3210 | 3215 | 3195 | 3215 | -5 | -1 | L | Nifty turned bullish | Should have checked Nifty trend first |

**Weekly review questions**:
1. What % of trades were Signal 3 reclaim setups vs other?
2. What's my actual win rate this week?
3. Did I follow my stop loss every time? (most important)
4. Did I overtrade?
5. Did I take trades during do-not-trade zones?

---

## Resources to Learn More

**Books**:
- *Trading in the Zone* by Mark Douglas (psychology — most important)
- *The Daily Trading Coach* by Brett Steenbarger
- *How to Make Money in Intraday Trading* by Ashwani Gujral (Indian context)

**YouTube channels (Indian intraday)**:
- Pranjal Kamra (basics)
- P R Sundar (options + intraday)
- Booming Bulls (intraday setups)

**Paper trading**:
- TradingView paper trade (free)
- Sensibull (₹free tier)
- Streak by Zerodha (algorithmic backtesting)

**Tools**:
- Zerodha Kite (for execution when ready)
- ChartInk (free scanner)
- This dashboard (for setup identification)

---

## Final Reminder

> "The market is a device for transferring money from the impatient to the patient." — Warren Buffett

Intraday is hard. Most people fail because of impatience, overtrading, and ignoring stop losses. If you can stay disciplined — take only the A+ setups, respect your stops, log every trade — ₹2K/day is achievable over 6–12 months of consistent practice.

But remember: **a ₹70 LPA AI Engineering Lead job pays ₹19,000/day post-tax**, with healthcare, ESOPs, learning, and zero stress. Trading is supplementary income at best. Don't let it become your primary plan.

Good luck — and trade safely.
