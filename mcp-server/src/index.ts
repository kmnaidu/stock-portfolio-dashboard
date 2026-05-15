#!/usr/bin/env node

/**
 * Stock Market MCP Server
 * 
 * This is an MCP (Model Context Protocol) server that exposes
 * Indian stock market tools to any AI IDE (Claude Desktop, Cursor, Kiro).
 * 
 * HOW IT WORKS:
 * 1. AI IDE starts this process (via "command": "node dist/index.js")
 * 2. This server declares its tools (names, descriptions, input schemas)
 * 3. When user asks a stock question, AI IDE calls our tools
 * 4. We fetch real data and return it
 * 5. AI IDE uses the data to answer the user
 * 
 * COMMUNICATION: via stdin/stdout (not HTTP!)
 * The MCP SDK handles all the protocol details.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getStockPrice } from './tools/stockPrice.js';
import { getNiftyLevels } from './tools/niftyLevels.js';
import { getIndexFutures } from './tools/indexFutures.js';
import { getCommodityFutures } from './tools/commodityFutures.js';
import { getMarketPulse } from './tools/marketPulse.js';

// ─── Create the MCP Server ──────────────────────────────────
const server = new McpServer({
  name: 'stock-market-mcp',
  version: '1.0.0',
});

// ─── Tool 1: Get Stock Price ─────────────────────────────────
// When user asks "What's the price of Reliance?" → AI calls this
server.tool(
  'get_stock_price',
  'Get current stock price, day high/low, 52-week high/low for any NSE/BSE stock',
  {
    symbol: z.string().describe('Stock symbol (e.g., RELIANCE.NS, TCS.NS, HDFC.NS)'),
  },
  async ({ symbol }) => {
    const data = await getStockPrice(symbol);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Tool 2: Get Nifty 50 Key Levels ────────────────────────
// When user asks "What are Nifty support levels?" → AI calls this
server.tool(
  'get_nifty_levels',
  'Get Nifty 50 pivot point support and resistance levels for today (S2, S1, Pivot, R1, R2)',
  {},
  async () => {
    const data = await getNiftyLevels();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Tool 3: Get Index Futures ───────────────────────────────
// When user asks "How are global futures?" → AI calls this
server.tool(
  'get_index_futures',
  'Get live index futures - Nifty, Bank Nifty, S&P 500, NASDAQ, Dow Jones, Russell 2000, DAX, CAC 40',
  {},
  async () => {
    const data = await getIndexFutures();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Tool 4: Get Commodity Futures ───────────────────────────
// When user asks "What's gold price?" → AI calls this
server.tool(
  'get_commodity_futures',
  'Get live commodity futures - Gold, Silver, Crude Oil, Brent, Copper, Natural Gas, Soybeans, Wheat',
  {},
  async () => {
    const data = await getCommodityFutures();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Tool 5: Get Market Pulse ────────────────────────────────
// When user asks "How's the market today?" → AI calls this
server.tool(
  'get_market_pulse',
  'Get Indian market pulse - Nifty, Sensex, GIFT Nifty, India VIX, Crude, USD/INR, Gold, Silver with sentiment score',
  {},
  async () => {
    const data = await getMarketPulse();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Start the Server ────────────────────────────────────────
// This connects to stdin/stdout — the AI IDE communicates through pipes
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Stock Market MCP Server running on stdio');
}

main().catch(console.error);
