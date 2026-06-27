#!/bin/bash
# ============================================================
# Pre-warm analyst data cache for production (DYNAMIC)
#
# Reads stocks from scripts/prewarm-stocks.txt (grows over time).
# To add a new stock: just append it to prewarm-stocks.txt
# Stocks are NEVER removed — only accumulated.
#
# Usage:
#   ./scripts/prewarm-cache.sh
#   ./scripts/prewarm-cache.sh --add WIPRO.NS    (adds a stock)
#
# Prerequisites:
#   - Python service running locally: cd python-service && python3 app.py
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STOCKS_FILE="$SCRIPT_DIR/prewarm-stocks.txt"
LOCAL_PYTHON="http://localhost:5001"
PROD_NODE="https://stock-api-9ukf.onrender.com"

# Handle --add flag to add new stocks
if [ "$1" = "--add" ] && [ -n "$2" ]; then
  SYMBOL=$(echo "$2" | tr '[:lower:]' '[:upper:]')
  # Auto-append .NS if missing
  if [[ ! "$SYMBOL" == *.* ]]; then
    SYMBOL="${SYMBOL}.NS"
  fi
  # Check if already exists
  if grep -q "^${SYMBOL}$" "$STOCKS_FILE" 2>/dev/null; then
    echo "✅ ${SYMBOL} already in prewarm list"
  else
    echo "$SYMBOL" >> "$STOCKS_FILE"
    echo "✅ Added ${SYMBOL} to prewarm list"
  fi
  # Continue to run full prewarm
fi

echo "============================================"
echo "Stock Portfolio — Cache Pre-warmer (Dynamic)"
echo "============================================"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Stocks file: $STOCKS_FILE"

# Read stocks from file (skip empty lines and comments)
STOCKS=()
while IFS= read -r line; do
  line=$(echo "$line" | tr -d '[:space:]')
  [[ -z "$line" || "$line" == \#* ]] && continue
  STOCKS+=("$line")
done < "$STOCKS_FILE"

# Fetch requested stocks from production and merge into file
echo "Fetching user-requested stocks from production..."
REQUESTED=$(curl -s --max-time 10 "$PROD_NODE/api/requested-stocks" 2>/dev/null)
if echo "$REQUESTED" | grep -q '"stocks"'; then
  NEW_STOCKS=$(echo "$REQUESTED" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for s in d.get('stocks', []):
    print(s)
" 2>/dev/null)
  ADDED=0
  while IFS= read -r sym; do
    [[ -z "$sym" ]] && continue
    if ! grep -q "^${sym}$" "$STOCKS_FILE" 2>/dev/null; then
      echo "$sym" >> "$STOCKS_FILE"
      STOCKS+=("$sym")
      ADDED=$((ADDED + 1))
    fi
  done <<< "$NEW_STOCKS"
  if [ "$ADDED" -gt 0 ]; then
    echo "✅ Added $ADDED new stocks from user requests"
  else
    echo "  No new stocks from users"
  fi
else
  echo "  Could not fetch requested stocks (server may be waking up)"
fi
echo ""

echo "Stocks to warm: ${#STOCKS[@]}"
echo "Local Python: $LOCAL_PYTHON"
echo "Production API: $PROD_NODE"
echo ""

# Check local Python service
echo "Checking local Python service..."
HEALTH=$(curl -s --max-time 5 "$LOCAL_PYTHON/health" 2>/dev/null)
if ! echo "$HEALTH" | grep -q '"ok"'; then
  echo "❌ Local Python service not running!"
  echo "   Start it first: cd python-service && python3 app.py"
  exit 1
fi
echo "✅ Local Python service is up"
echo ""

# Fetch analyst data from local Python
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

# Push to production Node.js cache
echo "Pushing $SUCCESS stocks to production Node.js cache..."

PUSH_RESPONSE=$(curl -s --max-time 30 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"stocks\":$JSON_ARRAY}" \
  "$PROD_NODE/api/cache-analyst" 2>/dev/null)

if echo "$PUSH_RESPONSE" | grep -q '"cached"'; then
  CACHED=$(echo "$PUSH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cached',0))" 2>/dev/null)
  echo "✅ Production cache updated! $CACHED stocks cached for 7 days."
else
  echo "❌ Failed to push to production. Response:"
  echo "$PUSH_RESPONSE"
fi

echo ""
echo "Done! Cache valid for ~24 hours."
echo "To add more stocks: ./scripts/prewarm-cache.sh --add WIPRO.NS"
