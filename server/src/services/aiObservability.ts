// ============================================================
// AI Observability Service
//
// Tracks every LLM call: model, timing, tokens, success/failure.
// Provides stats endpoint for monitoring AI system health.
//
// This is what separates a demo from a production AI system.
// ============================================================

export interface AICallLog {
  id: string;
  timestamp: string;
  type: 'agent' | 'deep-analysis' | 'ai-analysis' | 'multi-agent';
  question?: string;
  symbol?: string;
  model: string;
  apiKeyIndex: number;
  toolsUsed: string[];
  rounds: number;
  responseTimeMs: number;
  success: boolean;
  error?: string;
  sessionId?: string;
  tokensEstimate: number; // rough estimate based on response length
}

export interface AIStats {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  successRate: string;
  avgResponseTimeMs: number;
  callsByModel: Record<string, number>;
  callsByKey: Record<string, number>;
  callsByType: Record<string, number>;
  errorsByModel: Record<string, number>;
  recentErrors: { timestamp: string; model: string; error: string }[];
  topTools: Record<string, number>;
  estimatedCostUSD: string;
  last24hCalls: number;
  peakHour: string;
}

// ── In-memory log store (last 500 calls) ─────────────────────
const MAX_LOGS = 500;
const logs: AICallLog[] = [];
let callCounter = 0;

// ── Log an AI call ───────────────────────────────────────────
export function logAICall(entry: Omit<AICallLog, 'id' | 'timestamp'>): void {
  callCounter++;
  const log: AICallLog = {
    id: `ai-${callCounter}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  logs.push(log);

  // Keep only last MAX_LOGS entries
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }

  // Console log for debugging
  const status = log.success ? '✓' : '✗';
  console.log(`[AI ${status}] ${log.type} | ${log.model} | key-${log.apiKeyIndex} | ${log.responseTimeMs}ms | tools: ${log.toolsUsed.join(',') || 'none'}`);
}

// ── Get stats ────────────────────────────────────────────────
export function getAIStats(): AIStats {
  const now = Date.now();
  const last24h = logs.filter(l => now - new Date(l.timestamp).getTime() < 24 * 60 * 60 * 1000);

  const totalCalls = logs.length;
  const successCount = logs.filter(l => l.success).length;
  const failureCount = totalCalls - successCount;
  const successRate = totalCalls > 0 ? ((successCount / totalCalls) * 100).toFixed(1) + '%' : '0%';

  const responseTimes = logs.filter(l => l.success).map(l => l.responseTimeMs);
  const avgResponseTimeMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  // Calls by model
  const callsByModel: Record<string, number> = {};
  logs.forEach(l => { callsByModel[l.model] = (callsByModel[l.model] || 0) + 1; });

  // Calls by key
  const callsByKey: Record<string, number> = {};
  logs.forEach(l => { callsByKey[`key-${l.apiKeyIndex}`] = (callsByKey[`key-${l.apiKeyIndex}`] || 0) + 1; });

  // Calls by type
  const callsByType: Record<string, number> = {};
  logs.forEach(l => { callsByType[l.type] = (callsByType[l.type] || 0) + 1; });

  // Errors by model
  const errorsByModel: Record<string, number> = {};
  logs.filter(l => !l.success).forEach(l => { errorsByModel[l.model] = (errorsByModel[l.model] || 0) + 1; });

  // Recent errors (last 10)
  const recentErrors = logs
    .filter(l => !l.success)
    .slice(-10)
    .map(l => ({ timestamp: l.timestamp, model: l.model, error: l.error || 'unknown' }));

  // Top tools used
  const topTools: Record<string, number> = {};
  logs.forEach(l => l.toolsUsed.forEach(t => { topTools[t] = (topTools[t] || 0) + 1; }));

  // Cost estimate (Gemini 2.5 Flash: ~$0.075/1M input tokens)
  const totalTokens = logs.reduce((sum, l) => sum + l.tokensEstimate, 0);
  const estimatedCostUSD = `$${(totalTokens * 0.000000075).toFixed(4)}`;

  // Peak hour
  const hourCounts: Record<number, number> = {};
  logs.forEach(l => {
    const hour = new Date(l.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const peakHourNum = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  const peakHour = peakHourNum ? `${peakHourNum[0]}:00 (${peakHourNum[1]} calls)` : 'N/A';

  return {
    totalCalls,
    successCount,
    failureCount,
    successRate,
    avgResponseTimeMs,
    callsByModel,
    callsByKey,
    callsByType,
    errorsByModel,
    recentErrors,
    topTools,
    estimatedCostUSD,
    last24hCalls: last24h.length,
    peakHour,
  };
}

// ── Get raw logs (for debugging) ─────────────────────────────
export function getAILogs(limit = 50): AICallLog[] {
  return logs.slice(-limit).reverse();
}

// ── Helper: estimate tokens from text length ─────────────────
export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}
