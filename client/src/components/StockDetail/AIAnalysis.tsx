import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface AIAnalysisData {
  symbol: string;
  analysis: string;
  generatedAt: string;
  model: string;
}

interface Props {
  symbol: string;
}

/** Parse inline markdown (**bold**) into React nodes. */
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={key++}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/** Section type detection from a header line. */
function getSectionClass(header: string): string {
  const lower = header.toLowerCase();
  if (lower.includes('strength')) return 'ai-section-strengths';
  if (lower.includes('risk')) return 'ai-section-risks';
  if (lower.includes('action') || lower.includes('suggest')) return 'ai-section-action';
  if (lower.includes('horizon') || lower.includes('time')) return 'ai-section-horizon';
  if (lower.includes('overall') || lower.includes('assessment')) return 'ai-section-overall';
  return 'ai-section-default';
}

/** Get an icon for a section header. */
function getSectionIcon(header: string): string {
  const lower = header.toLowerCase();
  if (lower.includes('strength')) return '💪';
  if (lower.includes('risk')) return '⚠️';
  if (lower.includes('action') || lower.includes('suggest')) return '🎯';
  if (lower.includes('horizon') || lower.includes('time')) return '⏳';
  if (lower.includes('overall') || lower.includes('assessment')) return '📋';
  return '▸';
}

interface Section {
  header: string;
  icon: string;
  className: string;
  content: { type: 'text' | 'bullet'; value: string }[];
}

/** Parse the full AI response into structured sections. */
function parseAnalysis(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect section header: either **Header:** or **Header** at start of line
    const headerMatch = line.match(/^\*\*([^*]+?):?\*\*:?\s*(.*)$/);
    if (headerMatch) {
      const header = headerMatch[1].trim().replace(/:$/, '');
      const inline = headerMatch[2].trim();
      current = {
        header,
        icon: getSectionIcon(header),
        className: getSectionClass(header),
        content: [],
      };
      sections.push(current);
      if (inline) {
        current.content.push({ type: 'text', value: inline });
      }
      continue;
    }

    // Bullet point
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      const value = line.replace(/^[-•*]\s+/, '').trim();
      if (current) {
        current.content.push({ type: 'bullet', value });
      }
      continue;
    }

    // Regular text
    if (current) {
      current.content.push({ type: 'text', value: line });
    } else {
      // Intro text before first header — create an intro section
      if (sections.length === 0) {
        current = {
          header: 'Intro',
          icon: '',
          className: 'ai-section-intro',
          content: [{ type: 'text', value: line }],
        };
        sections.push(current);
      }
    }
  }

  return sections;
}

/** Extract action verdict for the highlight badge. */
function extractVerdict(sections: Section[]): { label: string; tone: string } | null {
  const actionSection = sections.find((s) => s.className === 'ai-section-action');
  if (!actionSection) return null;
  const text = actionSection.content.map((c) => c.value).join(' ').toLowerCase();

  if (text.includes('strong buy')) return { label: 'Strong Buy', tone: 'verdict-strong-buy' };
  if (text.includes('wait for dip') || text.includes('accumulate on dip')) return { label: 'Wait for Dip', tone: 'verdict-wait' };
  if (text.includes('avoid')) return { label: 'Avoid', tone: 'verdict-avoid' };
  if (text.includes('sell')) return { label: 'Sell', tone: 'verdict-sell' };
  if (text.includes('hold')) return { label: 'Hold', tone: 'verdict-hold' };
  if (text.includes('buy')) return { label: 'Buy', tone: 'verdict-buy' };
  return null;
}

export default function AIAnalysis({ symbol }: Props) {
  const [data, setData] = useState<AIAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai-analysis/${symbol}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'AI analysis failed');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setLoading(false);
    }
  };

  const sections = data ? parseAnalysis(data.analysis) : [];
  const verdict = data ? extractVerdict(sections) : null;

  return (
    <div className="ai-analysis-panel">
      <div className="ai-analysis-header">
        <h3 className="ai-analysis-title">🤖 AI Stock Analysis</h3>
        <span className="ai-analysis-badge">Powered by Google Gemini</span>
      </div>

      {!data && !loading && !error && (
        <div className="ai-analysis-prompt">
          <p className="ai-analysis-desc">
            Get an AI-generated analysis combining analyst consensus, technical indicators,
            and market context into a clear buy/hold/sell recommendation.
          </p>
          <button className="ai-analysis-btn" onClick={handleAnalyze}>
            🤖 Generate AI Analysis
          </button>
        </div>
      )}

      {loading && (
        <div className="ai-analysis-loading">
          <div className="ai-spinner"></div>
          <span>Analyzing {symbol.replace('.NS', '')} — gathering data and generating insights...</span>
        </div>
      )}

      {error && (
        <div className="ai-analysis-error">
          <p>❌ {error}</p>
          <button className="ai-analysis-btn ai-retry-btn" onClick={handleAnalyze}>
            Retry
          </button>
        </div>
      )}

      {data && (
        <div className="ai-analysis-result">
          {verdict && (
            <div className={`ai-verdict-banner ${verdict.tone}`}>
              <span className="ai-verdict-label">AI Verdict</span>
              <span className="ai-verdict-value">{verdict.label}</span>
            </div>
          )}

          <div className="ai-sections-container">
            {sections.filter((s) => s.className !== 'ai-section-intro').map((section, i) => (
              <div key={i} className={`ai-section ${section.className}`}>
                <div className="ai-section-title">
                  {section.icon && <span className="ai-section-icon">{section.icon}</span>}
                  <span>{section.header}</span>
                </div>
                <div className="ai-section-body">
                  {section.content.map((item, j) =>
                    item.type === 'bullet' ? (
                      <div key={j} className="ai-bullet-item">
                        <span className="ai-bullet-dot">•</span>
                        <span className="ai-bullet-text">{parseInline(item.value)}</span>
                      </div>
                    ) : (
                      <p key={j} className="ai-text-item">{parseInline(item.value)}</p>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="ai-disclaimer">
            ⚠️ AI-generated analysis based on available data. Not financial advice. Always DYOR.
          </div>

          <div className="ai-analysis-footer">
            <span className="ai-model-info">
              Model: {data.model} · Generated: {new Date(data.generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </span>
            <button className="ai-analysis-btn ai-refresh-btn" onClick={handleAnalyze}>
              🔄 Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
