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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Agent failed');
      }

      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'agent',
        text: data.answer,
        toolsUsed: data.toolsUsed,
        rounds: data.rounds,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `❌ ${err instanceof Error ? err.message : 'Something went wrong. Try again.'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: Fetch Nifty levels directly (no LLM)
  const handleNiftyLevels = async () => {
    if (loading) return;
    setMessages(prev => [...prev, { role: 'user', text: '📐 Nifty 50 Key Levels' }]);
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

          <div className="agent-messages">
            {messages.length === 0 && (
              <div className="agent-welcome">
                <p>Ask me anything about stocks:</p>
                <div className="agent-quick-actions">
                  <button className="agent-quick-btn" onClick={handleNiftyLevels}>📐 Nifty Key Levels</button>
                </div>
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
              placeholder="Ask about any stock..."
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
