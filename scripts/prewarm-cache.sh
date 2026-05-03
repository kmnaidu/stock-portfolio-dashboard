#!/bin/bash
# ============================================================
# Pre-warm analyst data cache for production
#
# How it works:
#   1. Fetches analyst data from LOCAL Python service (your home IP → Yahoo)
#   2. Pushes the data to PRODUCTION Node.js cache via POST /api/cache-analyst
#   3. Production cache is filled for 24 hours — no ScraperAPI needed
#
# Prerequisites:
#   - Python service running locally: cd python-service && python3 app.py
#
# Usage:
#   chmod +x scripts/prewarm-cache.sh
#   ./scripts/prewarm-cache.sh
#
# Optional daily cron (8 AM Mon-Fri, before market opens at 9:15):
#   crontab -e
#   0 8 * * 1-5 cd /path/to/project && ./scripts/prewarm-cache.sh >> /tmp/prewarm.log 2>&1
# ============================================================

LOCAL_PYTHON="http://localhost:5001"
PROD_NODE="https://stock-api-9ukf.onrender.com"

STOCKS=(
  "RELIANCE.NS" "ADANIPOWER.NS" "TATAPOWER.NS" "HDFCBANK.NS"
  "SBIN.NS" "ICICIBANK.NS" "CUB.NS" "TCS.NS" "INFY.NS"
  "KPITTECH.NS" "M&M.NS" "TVSMOTOR.NS" "TATAMOTORS.NS"
  "HAL.NS" "BEL.NS" "LT.NS" "BHARTIARTL.NS" "DRREDDY.NS"
  "BIOCON.NS" "ITC.NS" "DABUR.NS" "NATIONALUM.NS" "INDIGO.NS"
  "ETERNAL.NS" "DELHIVERY.NS" "INDHOTEL.NS" "NIFTYBEES.NS"
  "GOLDBEES.NS"
)

echo "============================================"
echo "Stock Portfolio — Cache Pre-warmer"
echo "============================================"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Local Python: $LOCAL_PYTHON"
echo "Production API: $PROD_NODE"
echo "Stocks: ${#STOCKS[@]}"
echo ""

# Step 1: Check local Python service
echo "Checking local Python service..."
HEALTH=$(curl -s --max-time 5 "$LOCAL_PYTHON/health" 2>/dev/null)
if ! echo "$HEALTH" | grep -q '"ok"'; then
  echo "❌ Local Python service not running!"
  echo "   Start it first: cd python-service && python3 app.py"
  exit 1
fi
echo "✅ Local Python service is up"
echo ""

# Step 2: Fetch analyst data from local Python (home IP → Yahoo directly)
echo "Fetching analyst data from Yahoo via local Python..."
echo "--------------------------------------------"

JSON_ARRAY="["
SUCCESS=0
FAILED=0
FIRST=true

for STOCK in "${STOCKS[@]}"; do
  RESPONSE=$(curl -s --max-time 60 "$LOCAL_PYTHON/analyst/$STOCK" 2>/dev/null)

  if echo "$RESPONSE" | grep -q '"targetMeanPrice"'; then
    TARGET=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'₹{d[\"targetMeanPrice\"]:.2f}')" 2>/dev/null || echo "?")
    ANALYSTS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('numberOfAnalystOpinions',0))" 2>/dev/null || echo "?")
    echo "  ✅ $STOCK — target: $TARGET ($ANALYSTS analysts)"

    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      JSON_ARRAY="$JSON_ARRAY,"
    fi
    JSON_ARRAY="$JSON_ARRAY{\"symbol\":\"$STOCK\",\"data\":$RESPONSE}"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ $STOCK — failed or no data"
    FAILED=$((FAILED + 1))
  fi

  # Small delay to be gentle with Yahoo
  sleep 2
done

JSON_ARRAY="$JSON_ARRAY]"

echo ""
echo "Fetched: ✅ $SUCCESS  ❌ $FAILED"
echo ""

if [ "$SUCCESS" -eq 0 ]; then
  echo "❌ No data fetched. Nothing to push."
  exit 1
fi

# Step 3: Push all data to production Node.js cache in one call
echo "Pushing $SUCCESS stocks to production Node.js cache..."

PUSH_RESPONSE=$(curl -s --max-time 30 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"stocks\":$JSON_ARRAY}" \
  "$PROD_NODE/api/cache-analyst" 2>/dev/null)

if echo "$PUSH_RESPONSE" | grep -q '"cached"'; then
  CACHED=$(echo "$PUSH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cached',0))" 2>/dev/null)
  echo "✅ Production cache updated! $CACHED stocks cached for 24 hours."
else
  echo "❌ Failed to push to production. Response:"
  echo "$PUSH_RESPONSE"
fi

echo ""
echo "Done! Your friends will see analyst data instantly."
echo "Run this again tomorrow to refresh."
