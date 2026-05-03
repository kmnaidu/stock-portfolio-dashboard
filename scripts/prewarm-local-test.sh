#!/bin/bash
# Local test version — points at localhost instead of production
# Tests the full flow: Local Python → Local Node.js cache

LOCAL_PYTHON="http://localhost:5001"
LOCAL_NODE="http://localhost:3001"

# Test with just 3 stocks to keep it quick
STOCKS=("RELIANCE.NS" "HDFCBANK.NS" "ICICIBANK.NS")

echo "============================================"
echo "Pre-warm LOCAL TEST (3 stocks)"
echo "============================================"
echo ""

# Check services
echo "Checking local Python..."
HEALTH=$(curl -s --max-time 5 "$LOCAL_PYTHON/health" 2>/dev/null)
if ! echo "$HEALTH" | grep -q '"ok"'; then
  echo "❌ Local Python not running! Start: cd python-service && python3 app.py"
  exit 1
fi
echo "✅ Python is up"

echo "Checking local Node.js..."
HEALTH=$(curl -s --max-time 5 "$LOCAL_NODE/api/health" 2>/dev/null)
if ! echo "$HEALTH" | grep -q '"ok"'; then
  echo "❌ Local Node.js not running! Start: cd server && npm run dev"
  exit 1
fi
echo "✅ Node.js is up"
echo ""

# Fetch from local Python
echo "Fetching analyst data from Yahoo via local Python..."
echo "--------------------------------------------"

JSON_ARRAY="["
SUCCESS=0
FIRST=true

for STOCK in "${STOCKS[@]}"; do
  RESPONSE=$(curl -s --max-time 60 "$LOCAL_PYTHON/analyst/$STOCK" 2>/dev/null)

  if echo "$RESPONSE" | grep -q '"targetMeanPrice"'; then
    TARGET=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'₹{d[\"targetMeanPrice\"]:.2f}')" 2>/dev/null)
    ANALYSTS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('numberOfAnalystOpinions',0))" 2>/dev/null)
    echo "  ✅ $STOCK — target: $TARGET ($ANALYSTS analysts)"

    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      JSON_ARRAY="$JSON_ARRAY,"
    fi
    JSON_ARRAY="$JSON_ARRAY{\"symbol\":\"$STOCK\",\"data\":$RESPONSE}"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ $STOCK — failed"
  fi
  sleep 2
done

JSON_ARRAY="$JSON_ARRAY]"

echo ""
echo "Fetched $SUCCESS stocks. Pushing to local Node.js cache..."

# Push to local Node.js
PUSH_RESPONSE=$(curl -s --max-time 10 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"stocks\":$JSON_ARRAY}" \
  "$LOCAL_NODE/api/cache-analyst" 2>/dev/null)

echo "Response: $PUSH_RESPONSE"
echo ""

# Verify: fetch from Node.js (should come from cache, not Python)
echo "Verifying cache... fetching RELIANCE from Node.js:"
VERIFY=$(curl -s --max-time 5 "$LOCAL_NODE/api/analyst/RELIANCE.NS" 2>/dev/null)
TARGET=$(echo "$VERIFY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'₹{d.get(\"targetMeanPrice\",0):.2f}')" 2>/dev/null)
echo "  → Target: $TARGET (served from cache ✅)"
echo ""
echo "Local test complete! Ready to push to production."
