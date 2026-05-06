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
          <div className="ai-analysis-content">
            {data.analysis.split('\n').map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              // Bold headers (lines starting with **)
              if (line.startsWith('**') && line.endsWith('**')) {
                return <h4 key={i} className="ai-section-header">{line.replace(/\*\*/g, '')}</h4>;
              }
              // Bullet points
              if (line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('* ')) {
                return <li key={i} className="ai-bullet">{line.replace(/^[\s\-•*]+/, '')}</li>;
              }
              return <p key={i} className="ai-paragraph">{line}</p>;
            })}
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
