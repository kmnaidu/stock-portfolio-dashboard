// ============================================================
// Vector DB Service — Semantic Stock Search
//
// Uses Upstash Vector + Gemini Embeddings to find similar stocks.
//
// How it works:
// 1. Each stock has a text description (sector, P/E, growth, etc.)
// 2. Gemini Embedding API converts text → 768 numbers (vector)
// 3. Vectors stored in Upstash Vector DB
// 4. "Find similar to X" = find nearest vectors = similar stocks
//
// Two operations:
// - seed(): Embed all stocks and store (run once or weekly)
// - findSimilar(symbol): Find 5 most similar stocks
// ============================================================

import { Index } from '@upstash/vector';

// ── Initialize Upstash Vector ────────────────────────────────
const vectorUrl = process.env.UPSTASH_VECTOR_REST_URL;
const vectorToken = process.env.UPSTASH_VECTOR_REST_TOKEN;

let vectorIndex: Index | null = null;
if (vectorUrl && vectorToken) {
  vectorIndex = new Index({ url: vectorUrl, token: vectorToken });
  console.log('✓ Upstash Vector DB connected (semantic search enabled)');
} else {
  console.log('⚠ No Vector DB credentials — similar stocks feature disabled');
}

// ── Gemini Embedding ─────────────────────────────────────────
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY || '',
  process.env.GEMINI_API_KEY_2 || '',
  process.env.GEMINI_API_KEY_3 || '',
  process.env.GEMINI_API_KEY_4 || '',
].filter(k => k.length > 0);

let embKeyIndex = 0;

async function getEmbedding(text: string): Promise<number[] | null> {
  if (GEMINI_API_KEYS.length === 0) return null;

  const key = GEMINI_API_KEYS[embKeyIndex % GEMINI_API_KEYS.length];
  embKeyIndex++;

  try {
    // Use REST API directly (SDK has issues with embedding model names)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    });

    if (!res.ok) {
      console.error('[Vector] Embedding API error:', res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as any;
    return data?.embedding?.values || null;
  } catch (err) {
    console.error('[Vector] Embedding failed:', (err as any)?.message);
    return null;
  }
}

// ── Stock Descriptions (what we embed) ───────────────────────
// These descriptions capture each stock's identity for similarity matching
const STOCK_PROFILES: Record<string, string> = {
  'RELIANCE.NS': 'Reliance Industries. Large-cap conglomerate. Oil refining, Jio telecom, retail. Energy sector. Diversified business. Market cap 18 lakh crore. Strong Buy consensus.',
  'TCS.NS': 'Tata Consultancy Services. Large-cap IT services. Software consulting, digital transformation. Technology sector. Stable dividend. Export-oriented.',
  'INFY.NS': 'Infosys. Large-cap IT services. Digital services, consulting, outsourcing. Technology sector. Strong margins. Export-oriented.',
  'HDFCBANK.NS': 'HDFC Bank. Large-cap private banking. Retail banking, corporate loans. Financial sector. High asset quality. Consistent growth.',
  'ICICIBANK.NS': 'ICICI Bank. Large-cap private banking. Retail and corporate banking. Financial sector. Digital banking leader. Strong growth.',
  'SBIN.NS': 'State Bank of India. Large-cap public sector bank. Largest bank in India. Financial sector. Government owned. Wide branch network.',
  'HAL.NS': 'Hindustan Aeronautics. Large-cap defense. Aircraft manufacturing, helicopters. Defense sector. Government orders. Make in India beneficiary.',
  'BEL.NS': 'Bharat Electronics. Large-cap defense electronics. Radar, communication systems. Defense sector. Government orders. Strong order book.',
  'BHARTIARTL.NS': 'Bharti Airtel. Large-cap telecom. Mobile, broadband, DTH. Telecom sector. ARPU growth. 5G rollout. Africa operations.',
  'TATAMOTORS.NS': 'Tata Motors. Large-cap auto. JLR luxury cars, commercial vehicles, EVs. Auto sector. EV transition. Global presence.',
  'TVSMOTOR.NS': 'TVS Motor. Mid-cap auto. Two-wheelers, motorcycles, scooters. Auto sector. Premium segment growth. Export markets.',
  'M&M.NS': 'Mahindra & Mahindra. Large-cap auto and farm. SUVs, tractors, farm equipment. Auto sector. Rural India exposure. EV push.',
  'ITC.NS': 'ITC Limited. Large-cap FMCG and tobacco. Cigarettes, hotels, FMCG, agri. Consumer defensive. High dividend. Stable cash flows.',
  'DABUR.NS': 'Dabur India. Mid-cap FMCG. Ayurvedic products, personal care, food. Consumer defensive. Rural distribution. Health and wellness.',
  'LT.NS': 'Larsen & Toubro. Large-cap engineering. Infrastructure, construction, defense, IT. Industrial sector. Order book driven. Capex beneficiary.',
  'KPITTECH.NS': 'KPIT Technologies. Mid-cap IT. Automotive software, embedded systems. Technology sector. EV and ADAS focus. High growth.',
  'TATAPOWER.NS': 'Tata Power. Mid-cap utilities. Power generation, solar, EV charging. Utilities sector. Green energy transition. Renewable focus.',
  'DRREDDY.NS': 'Dr Reddys Laboratories. Large-cap pharma. Generic drugs, biosimilars. Healthcare sector. US market exposure. R&D pipeline.',
  'BIOCON.NS': 'Biocon. Mid-cap pharma. Biosimilars, biologics, research services. Healthcare sector. Innovation driven. Global biosimilar leader.',
  'NATIONALUM.NS': 'National Aluminium. Mid-cap metals. Aluminium production, mining. Materials sector. Commodity cyclical. Government owned.',
  'INDIGO.NS': 'InterGlobe Aviation (IndiGo). Large-cap aviation. Low-cost airline, domestic leader. Consumer discretionary. Market share leader. Fleet expansion.',
  'ETERNAL.NS': 'Eternal (Zomato). Mid-cap food tech. Food delivery, quick commerce, Blinkit. Consumer discretionary. High growth. Loss-making but improving.',
  'DELHIVERY.NS': 'Delhivery. Mid-cap logistics. E-commerce logistics, supply chain. Industrial sector. Tech-driven logistics. Growing volumes.',
  'INDHOTEL.NS': 'Indian Hotels (Taj). Mid-cap hospitality. Luxury hotels, Taj brand. Consumer discretionary. Tourism recovery. Premium positioning.',
  'WIPRO.NS': 'Wipro. Large-cap IT services. Digital transformation, consulting. Technology sector. Turnaround story. Cloud and AI focus.',
  'CIPLA.NS': 'Cipla. Large-cap pharma. Respiratory, anti-retroviral drugs. Healthcare sector. India and global markets. Strong brand.',
  'PERSISTENT.NS': 'Persistent Systems. Mid-cap IT. Product engineering, digital services. Technology sector. High growth. Healthcare and BFSI focus.',
  'LTM.NS': 'LTIMindtree. Large-cap IT services. Digital engineering, cloud. Technology sector. Merged entity. Strong deal pipeline.',
  'GRAPHITE.NS': 'Graphite India. Small-cap materials. Graphite electrodes, carbon products. Materials sector. Cyclical. Steel industry dependent.',
  'ADANIPOWER.NS': 'Adani Power. Large-cap utilities. Thermal power generation. Utilities sector. Adani group. Capacity expansion.',
  'CUB.NS': 'City Union Bank. Small-cap banking. South India focused. Financial sector. Conservative lending. Niche regional bank.',
};

// ── Seed Vector DB (run once or weekly) ──────────────────────
export async function seedVectorDB(): Promise<{ success: number; failed: number }> {
  if (!vectorIndex) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  for (const [symbol, description] of Object.entries(STOCK_PROFILES)) {
    try {
      const embedding = await getEmbedding(description);
      if (!embedding) { failed++; continue; }

      await vectorIndex.upsert({
        id: symbol,
        vector: embedding,
        metadata: { symbol, description },
      });

      success++;
      console.log(`[Vector] ✓ Embedded ${symbol}`);

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      failed++;
      console.error(`[Vector] ✗ Failed ${symbol}:`, (err as any)?.message);
    }
  }

  console.log(`[Vector] Seed complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

// ── Find Similar Stocks ──────────────────────────────────────
export async function findSimilarStocks(symbol: string, topK = 5): Promise<Array<{ symbol: string; score: number; description: string }>> {
  if (!vectorIndex) return [];

  // Get the description for the input stock
  const description = STOCK_PROFILES[symbol];
  if (!description) return [];

  // Get embedding for this stock's description
  const embedding = await getEmbedding(description);
  if (!embedding) return [];

  try {
    // Query vector DB for nearest neighbors
    const results = await vectorIndex.query({
      vector: embedding,
      topK: topK + 1, // +1 because it'll include itself
      includeMetadata: true,
    });

    // Filter out the stock itself and return similar ones
    return results
      .filter(r => r.id !== symbol)
      .slice(0, topK)
      .map(r => ({
        symbol: r.id as string,
        score: Math.round((r.score || 0) * 100) / 100,
        description: (r.metadata as any)?.description || '',
      }));
  } catch (err) {
    console.error('[Vector] Search failed:', (err as any)?.message);
    return [];
  }
}

// ── Check if Vector DB is available ──────────────────────────
export function isVectorDBAvailable(): boolean {
  return vectorIndex !== null;
}
