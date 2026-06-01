import { useState, useRef, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface Message {
  role: 'user' | 'agent';
  text: string;
  toolsUsed?: string[];
  rounds?: number;
}

/** Render agent message with markdown-like formatting */
function renderAgentMessage(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { nodes.push(<br key={key++} />); continue; }

    // Action line (bold) — highlight it
    if (trimmed.startsWith('**Action:**') || trimmed.startsWith('**Action Suggestion:**')) {
      const actionText = trimmed.replace(/\*\*/g, '');
      nodes.push(
        <div key={key++} className="agent-action-line">
          🎯 <strong>{actionText}</strong>
        </div>
      );
      continue;
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      const bulletText = trimmed.replace(/^[-•*]\s+/, '');
      nodes.push(
        <div key={key++} className="agent-bullet">• {renderInlineBold(bulletText)}</div>
      );
      continue;
    }

    // Regular text with inline bold
    nodes.push(<p key={key++} className="agent-para">{renderInlineBold(trimmed)}</p>);
  }

  return nodes;
}

/** Render **bold** text inline */
function renderInlineBold(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<strong key={k++}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

export default function AgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [deepAnalysisMode, setDeepAnalysisMode] = useState(false);
  const [similarMode, setSimilarMode] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID()); // Unique per chat session
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to top so latest quick-action response header is visible
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    // If in deep analysis mode, route to multi-agent
    if (deepAnalysisMode) {
      handleDeepAnalysisSubmit(input.trim());
      setInput('');
      return;
    }

    // If in similar stocks mode, route to vector search
    if (similarMode) {
      handleSimilarSubmit(input.trim());
      setInput('');
      return;
    }

    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      // Use streaming endpoint (SSE)
      const url = `${API_BASE}/api/agent/stream?question=${encodeURIComponent(question)}&sessionId=${encodeURIComponent(sessionId)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Agent failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let toolsUsed: string[] = [];
      let rounds = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.text) {
                if (!fullText) {
                  // First chunk — add the agent message
                  setMessages(prev => [...prev, { role: 'agent', text: data.text }]);
                } else {
                  // Subsequent chunks — update last message
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'agent', text: fullText + data.text };
                    return updated;
                  });
                }
                fullText += data.text;
              }
              if (data.done) {
                toolsUsed = data.toolsUsed || [];
                rounds = data.rounds || 0;
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch { /* skip malformed JSON */ }
          }
        }
      }

      // If no text received at all, show error
      if (!fullText) {
        // Fallback: try non-streaming endpoint
        try {
          const fallbackRes = await fetch(`${API_BASE}/api/agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, sessionId }),
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            setMessages(prev => [...prev, {
              role: 'agent',
              text: fallbackData.answer,
              toolsUsed: fallbackData.toolsUsed,
              rounds: fallbackData.rounds,
            }]);
          } else {
            setMessages(prev => [...prev, {
              role: 'agent',
              text: '❌ All AI models are currently overloaded. Please try again in 30 seconds.',
            }]);
          }
        } catch {
          setMessages(prev => [...prev, {
            role: 'agent',
            text: '❌ Agent unavailable. Please try again.',
          }]);
        }
      } else if (toolsUsed.length > 0) {
        // Final update with metadata
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'agent', text: fullText, toolsUsed, rounds };
          return updated;
        });
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `❌ ${err instanceof Error ? err.message : 'Something went wrong. Try again.'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: Find Similar Stocks (Vector DB — no LLM)
  const handleSimilarStocks = async () => {
    if (loading) return;
    setMessages([{ role: 'agent', text: '🔍 Enter a stock symbol below to find similar stocks (e.g., RELIANCE.NS):' }]);
    setSimilarMode(true);
    setDeepAnalysisMode(false);
  };

  // Handle similar stocks submission
  const handleSimilarSubmit = async (symbol: string) => {
    let sym = symbol.trim().toUpperCase();
    if (!sym.includes('.')) sym = sym + '.NS';

    // Apply name mapping
    const rawName = sym.replace('.NS', '').replace('.BO', '');
    const nameMap: Record<string, string> = {
      'INFOSYS': 'INFY.NS', 'HDFC': 'HDFCBANK.NS', 'HDDFC': 'HDFCBANK.NS',
      'ICICI': 'ICICIBANK.NS', 'SBI': 'SBIN.NS', 'AIRTEL': 'BHARTIARTL.NS',
      'TATA MOTORS': 'TATAMOTORS.NS', 'TATA POWER': 'TATAPOWER.NS',
    };
    if (nameMap[rawName]) sym = nameMap[rawName];

    setSimilarMode(false);
    setMessages([{ role: 'user', text: `🔍 Similar to: ${sym}` }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/vector/similar/${encodeURIComponent(sym)}`);
      if (!res.ok) throw new Error('Could not find similar stocks');
      const data = await res.json();

      if (!data.similar || data.similar.length === 0) {
        setMessages(prev => [...prev, { role: 'agent', text: `No similar stocks found for ${sym}. Try running the seed first or use a different symbol.` }]);
      } else {
        let text = `**🔍 Stocks Similar to ${sym}:**\n\n`;
        data.similar.forEach((s: any, i: number) => {
          text += `${i + 1}. **${s.symbol}** (${Math.round(s.score * 100)}% match)\n`;
          text += `   ${s.description}\n\n`;
        });
        text += `⚡ Powered by Vector DB (semantic search, no LLM)`;
        setMessages(prev => [...prev, { role: 'agent', text }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'agent', text: `❌ ${err instanceof Error ? err.message : 'Search failed'}` }]);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: Deep Analysis (Multi-Agent)
  const handleDeepAnalysis = () => {
    if (loading) return;
    if (deepAnalysisMode) {
      // Toggle OFF — back to normal agent
      setDeepAnalysisMode(false);
      setMessages([{ role: 'agent', text: '💬 Back to normal chat mode. Ask any question.' }]);
    } else {
      // Toggle ON — enter deep analysis mode
      setDeepAnalysisMode(true);
      setMessages([{ role: 'agent', text: '🔬 Enter a stock symbol below (e.g., RELIANCE.NS) and press Send for deep multi-agent analysis.' }]);
    }
  };

  // Handle deep analysis submission
  const handleDeepAnalysisSubmit = async (symbol: string) => {
    let sym = symbol.trim().toUpperCase();
    if (!sym) return;

    // Remove extra words like "WITH NEWS", "ANALYSIS" etc
    sym = sym.replace(/\s*(WITH|AND|FOR|ANALYSIS|NEWS|STOCK|PRICE)\s*/gi, '').trim();

    // Common name mappings (check BEFORE adding .NS)
    const nameMap: Record<string, string> = {
      'INFOSYS': 'INFY.NS',
      'ICICI': 'ICICIBANK.NS',
      'ICICI BANK': 'ICICIBANK.NS',
      'ICICIBANK': 'ICICIBANK.NS',
      'HDFC': 'HDFCBANK.NS',
      'HDDFC': 'HDFCBANK.NS',
      'HDFC BANK': 'HDFCBANK.NS',
      'HDFCBANK': 'HDFCBANK.NS',
      'TATA MOTORS': 'TATAMOTORS.NS',
      'TATAMOTORS': 'TATAMOTORS.NS',
      'TATA POWER': 'TATAPOWER.NS',
      'TATAPOWER': 'TATAPOWER.NS',
      'BHARTI AIRTEL': 'BHARTIARTL.NS',
      'BHARTIARTL': 'BHARTIARTL.NS',
      'AIRTEL': 'BHARTIARTL.NS',
      'SBI': 'SBIN.NS',
      'SBIN': 'SBIN.NS',
      'STATE BANK': 'SBIN.NS',
      'RELIANCE': 'RELIANCE.NS',
      'TCS': 'TCS.NS',
      'INFY': 'INFY.NS',
      'WIPRO': 'WIPRO.NS',
      'HAL': 'HAL.NS',
      'ITC': 'ITC.NS',
      'LT': 'LT.NS',
      'DABUR': 'DABUR.NS',
      'INDHOTEL': 'INDHOTEL.NS',
      'TVSMOTOR': 'TVSMOTOR.NS',
      'BEL': 'BEL.NS',
    };

    // Check map with raw input (without .NS)
    const rawName = sym.replace('.NS', '').replace('.BO', '');
    if (nameMap[rawName]) {
      sym = nameMap[rawName];
    } else if (!sym.includes('.')) {
      sym = sym + '.NS';
    }

    // Keep deepAnalysisMode ON so user can type another stock name
    setMessages([{ role: 'user', text: `🔬 Deep Analysis: ${sym}` }]);
    setLoading(true);

    try {
      const url = `${API_BASE}/api/agent/deep-analysis?symbol=${encodeURIComponent(sym)}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('Deep analysis failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      setMessages(prev => [...prev, { role: 'agent', text: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.text) {
                fullText += data.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'agent', text: fullText };
                  return updated;
                });
              }
              if (data.done) break;
              if (data.error) throw new Error(data.error);
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `❌ ${err instanceof Error ? err.message : 'Deep analysis failed'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: Fetch Index Futures directly (no LLM)
  const handleIndexFutures = async () => {
    if (loading) return;
    setDeepAnalysisMode(false);
    setMessages([{ role: 'user', text: '📈 Index Futures' }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/index-futures`);
      if (!res.ok) throw new Error('Could not fetch futures');
      const data = await res.json();

      let text = `**📈 Index Futures (Live)**\n\n`;
      for (const f of data.futures) {
        const arrow = f.direction === 'up' ? '🟢' : f.direction === 'down' ? '🔴' : '🟡';
        const sign = f.changePercent >= 0 ? '+' : '';
        text += `${arrow} **${f.flag} ${f.name}:** ${f.price.toLocaleString('en-US')} (${sign}${f.changePercent.toFixed(2)}%)\n`;
      }
      text += `\n⚡ Live from TradingView (no LLM)`;

      setMessages(prev => [...prev, { role: 'agent', text }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `❌ ${err instanceof Error ? err.message : 'Could not fetch index futures'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: Fetch Commodity Futures directly (no LLM)
  const handleCommodityFutures = async () => {
    if (loading) return;
    setDeepAnalysisMode(false);
    setMessages([{ role: 'user', text: '🛢️ Commodity Futures' }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/commodity-futures`);
      if (!res.ok) throw new Error('Could not fetch commodities');
      const data = await res.json();

      let text = `**🛢️ Commodity Futures (Live)**\n\n`;
      for (const c of data.commodities) {
        const arrow = c.direction === 'up' ? '🟢' : c.direction === 'down' ? '🔴' : '🟡';
        const sign = c.changePercent >= 0 ? '+' : '';
        text += `${arrow} **${c.flag} ${c.name}:** ${c.price.toLocaleString('en-US')} (${sign}${c.changePercent.toFixed(2)}%)\n`;
      }
      text += `\n⚡ Live from TradingView (no LLM)`;

      setMessages(prev => [...prev, { role: 'agent', text }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `❌ ${err instanceof Error ? err.message : 'Could not fetch commodity futures'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: Fetch Nifty levels directly (no LLM)
  const handleNiftyLevels = async () => {
    if (loading) return;
    setDeepAnalysisMode(false);
    setMessages([{ role: 'user', text: '📐 Nifty 50 Key Levels' }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/nifty-levels`);
      if (!res.ok) throw new Error('Could not fetch levels');
      const levels = await res.json();

      const biasEmoji = levels.bias === 'bullish' ? '🟢' : levels.bias === 'bearish' ? '🔴' : '🟡';
      const biasText = levels.bias === 'bullish' ? 'Above Pivot (Bullish)' :
                       levels.bias === 'bearish' ? 'Below Pivot (Bearish)' : 'At Pivot (Neutral)';

      const text = `**📐 Nifty 50 Key Levels**\n\n` +
        `**Resistance:**\n` +
        `• R2: ${levels.r2.toLocaleString('en-IN')} (strong resistance)\n` +
        `• R1: ${levels.r1.toLocaleString('en-IN')} (first hurdle)\n\n` +
        `**Pivot: ${levels.pivot.toLocaleString('en-IN')}**\n\n` +
        `**Support:**\n` +
        `• S1: ${levels.s1.toLocaleString('en-IN')} (first cushion)\n` +
        `• S2: ${levels.s2.toLocaleString('en-IN')} (strong floor)\n\n` +
        `**Current: ${levels.current.toLocaleString('en-IN')}**\n` +
        `**Bias: ${biasEmoji} ${biasText}**\n\n` +
        `- Trading above ${levels.pivot.toLocaleString('en-IN')} = bullish for the day\n` +
        `- Breaking below ${levels.s1.toLocaleString('en-IN')} = bearish signal\n` +
        `- Target on upside: ${levels.r1.toLocaleString('en-IN')}\n\n` +
        `⚡ Calculated from pivot formula (no LLM)`;

      setMessages(prev => [...prev, { role: 'agent', text }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `❌ ${err instanceof Error ? err.message : 'Could not fetch Nifty levels'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        className="agent-fab"
        onClick={() => {
          if (isOpen) setMessages([]); // Clear chat when closing
          setIsOpen(!isOpen);
        }}
        title="Ask AI Agent"
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="agent-panel">
          <div className="agent-panel-header">
            <span className="agent-panel-title">🤖 Stock Assistant</span>
            <span className="agent-panel-badge">AI Agent</span>
          </div>

          {/* Quick actions always visible below header */}
          <div className="agent-quick-actions-fixed">
            <button className="agent-quick-btn-sm" onClick={handleNiftyLevels} disabled={loading}>📐 Nifty Levels</button>
            <button className="agent-quick-btn-sm" onClick={handleIndexFutures} disabled={loading}>📈 Futures</button>
            <button className="agent-quick-btn-sm" onClick={handleCommodityFutures} disabled={loading}>🛢️ Commodities</button>
            <button className="agent-quick-btn-sm agent-deep-btn" onClick={handleDeepAnalysis} disabled={loading}>{deepAnalysisMode ? '💬 Normal Chat' : '🔬 Deep Analysis'}</button>
            <button className="agent-quick-btn-sm" onClick={handleSimilarStocks} disabled={loading}>🔍 Similar</button>
          </div>

          <div className="agent-messages" ref={messagesContainerRef}>
            {messages.length === 0 && (
              <div className="agent-welcome">
                <p>Ask me anything about stocks:</p>
                <div className="agent-suggestions">
                  <button onClick={() => { setInput('Should I buy ICICI Bank?'); }}>Should I buy ICICI Bank?</button>
                  <button onClick={() => { setInput('Which stock has highest upside?'); }}>Highest upside stock?</button>
                  <button onClick={() => { setInput("What's the market outlook for today? Consider Nifty, crude oil, FII/DII activity and give your prediction."); }}>Market prediction today?</button>
                  <button onClick={() => { setInput("What's Reliance support level?"); }}>Reliance support?</button>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`agent-msg agent-msg-${msg.role}`}>
                <div className="agent-msg-text">
                  {msg.role === 'agent' ? renderAgentMessage(msg.text) : msg.text}
                </div>
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="agent-msg-meta">
                    🔧 {msg.toolsUsed.join(', ')} · {msg.rounds} rounds
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="agent-msg agent-msg-agent">
                <div className="agent-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="agent-input-row">
            <input
              type="text"
              className="agent-input"
              placeholder={deepAnalysisMode ? "Enter stock symbol (e.g., RELIANCE.NS)..." : similarMode ? "Enter stock to find similar (e.g., TCS.NS)..." : "Ask about any stock..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button
              className="agent-send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
