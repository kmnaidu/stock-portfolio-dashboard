/**
 * Stock Price Alert Script — WhatsApp Notifications via Twilio
 * 
 * How it works:
 * 1. Checks stock prices from Yahoo Finance
 * 2. Compares with your alert targets
 * 3. Sends WhatsApp message if target is hit
 * 
 * Setup: Add to server/.env:
 *   TWILIO_ACCOUNT_SID=your_sid
 *   TWILIO_AUTH_TOKEN=your_token
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
 *   MY_WHATSAPP=whatsapp:+91XXXXXXXXXX
 * 
 * Run: npx tsx scripts/stock-alerts.ts
 */

import 'dotenv/config';

// ── Configuration (from environment variables) ───────────────
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const MY_WHATSAPP = process.env.MY_WHATSAPP || '';

// ── Your Price Alerts ────────────────────────────────────────
// Add stocks you want to monitor with target prices
const ALERTS = [
  { symbol: 'ICICIBANK.NS', targetLow: 1200, targetHigh: 1350, name: 'ICICI Bank' },
  { symbol: 'RELIANCE.NS', targetLow: 1300, targetHigh: 1400, name: 'Reliance' },
  { symbol: 'HDFCBANK.NS', targetLow: 740, targetHigh: 800, name: 'HDFC Bank' },
  { symbol: 'TCS.NS', targetLow: 2200, targetHigh: 2500, name: 'TCS' },
  { symbol: 'SBIN.NS', targetLow: 900, targetHigh: 1000, name: 'SBI' },
];

// ── Send WhatsApp Message via Twilio ─────────────────────────
async function sendWhatsApp(message: string): Promise<boolean> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const body = new URLSearchParams({
    From: TWILIO_WHATSAPP_FROM,
    To: MY_WHATSAPP,
    Body: message,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await res.json() as any;
    if (data.sid) {
      console.log('✓ WhatsApp sent:', message.slice(0, 50) + '...');
      return true;
    } else {
      console.error('✗ WhatsApp failed:', data.message || data);
      return false;
    }
  } catch (err) {
    console.error('✗ WhatsApp error:', (err as any)?.message);
    return false;
  }
}

// ── Fetch Stock Price from Yahoo ─────────────────────────────
async function getPrice(symbol: string): Promise<{ price: number; change: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;

    const json = (await res.json()) as any;
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return { price, change, changePct };
  } catch {
    return null;
  }
}

// ── Check Alerts ─────────────────────────────────────────────
async function checkAlerts() {
  console.log(`\n📊 Checking ${ALERTS.length} stock alerts...`);
  console.log(`   Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`);

  for (const alert of ALERTS) {
    const data = await getPrice(alert.symbol);
    if (!data) {
      console.log(`   ⚠ ${alert.name}: Could not fetch price`);
      continue;
    }

    const { price, changePct } = data;
    const arrow = changePct >= 0 ? '▲' : '▼';
    console.log(`   ${alert.name}: ₹${price.toFixed(2)} ${arrow} ${changePct.toFixed(2)}%`);

    // Check if price hit target
    if (price <= alert.targetLow) {
      await sendWhatsApp(
        `📉 *${alert.name}* Alert!\n\n` +
        `Price: ₹${price.toFixed(2)} (${changePct.toFixed(2)}%)\n` +
        `Hit your BUY target: ₹${alert.targetLow}\n\n` +
        `💡 Consider buying — price at your target level.\n` +
        `⚠️ Not financial advice.`
      );
    } else if (price >= alert.targetHigh) {
      await sendWhatsApp(
        `📈 *${alert.name}* Alert!\n\n` +
        `Price: ₹${price.toFixed(2)} (${changePct.toFixed(2)}%)\n` +
        `Hit your SELL target: ₹${alert.targetHigh}\n\n` +
        `💡 Consider booking profits.\n` +
        `⚠️ Not financial advice.`
      );
    }
  }

  console.log('\n✓ Alert check complete.\n');
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--test') {
    // Send a test message
    console.log('Sending test WhatsApp message...');
    await sendWhatsApp(
      `🔔 *Stock Alert System Active!*\n\n` +
      `Your alerts are configured for:\n` +
      ALERTS.map(a => `• ${a.name}: Buy ₹${a.targetLow} / Sell ₹${a.targetHigh}`).join('\n') +
      `\n\n✓ You'll receive alerts when targets are hit.`
    );
    return;
  }

  if (args[0] === '--watch') {
    // Continuous monitoring (check every 5 minutes)
    console.log('🔔 Stock Alert Monitor Started (checking every 5 min)');
    console.log('   Press Ctrl+C to stop\n');
    await checkAlerts();
    setInterval(checkAlerts, 5 * 60 * 1000); // Every 5 minutes
    return;
  }

  // Default: single check
  await checkAlerts();
}

main();
