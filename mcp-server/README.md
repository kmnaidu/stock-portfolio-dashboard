# Stock Market MCP Server

An MCP (Model Context Protocol) server that provides real-time Indian stock market data to any AI IDE (Kiro, Claude Desktop, Cursor).

## Tools Available

| Tool | Description |
|---|---|
| `get_stock_price` | Current price, day high/low, 52-week high/low for any NSE/BSE stock |
| `get_nifty_levels` | Nifty 50 pivot point support/resistance levels (S2, S1, PP, R1, R2) |
| `get_index_futures` | Live index futures — Nifty, Bank Nifty, S&P 500, NASDAQ, Dow, DAX, CAC 40 |
| `get_commodity_futures` | Live commodity futures — Gold, Silver, Crude, Brent, Copper, Natural Gas, Wheat |
| `get_market_pulse` | Full market overview — all indicators + sentiment score |

## Setup

### In Kiro / Cursor

Add to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "stock-market": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

### In Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stock-market": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

## Build

```bash
cd mcp-server
npm install
npm run build
```

## Data Sources

- **Yahoo Finance** — Stock prices, Nifty/Sensex, Crude, Gold, Silver, USD/INR
- **TradingView Scanner API** — Index futures, Commodity futures, GIFT Nifty

No API keys required. All free data sources.

## Example Usage

Once configured, ask your AI assistant:

- "What's the price of Reliance?"
- "Show me Nifty support and resistance levels"
- "How are global futures looking?"
- "What's the gold price?"
- "Give me the market pulse"

## Author

Krishna Naidu ([@kmnaidu](https://github.com/kmnaidu))
