import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = window.location.hostname === 'localhost' && window.location.port === '5173'
  ? 'http://localhost:8000'
  : '';

const TEMPLATES = {
  kubernetes: {
    title: "K8s Pod OOMKilled",
    context: "kubernetes",
    data: `[2026-06-10 18:04:12] [k8s-pod-backend-86dfc79b8f-lmxqr] ERROR: memory limit exceeded.
[2026-06-10 18:04:13] [kubelet] Pod backend-86dfc79b8f-lmxqr (container "backend") terminated: OOMKilled. Exit code 137.
[2026-06-10 18:04:13] [k8s-scheduler] Scaling replica set down/up, node status: critical memory pressure.
[2026-06-10 18:04:15] [kube-state-metrics] container_memory_working_set_bytes{pod="backend-86dfc79b8f-lmxqr"} peaked at 512MiB (limit was 512MiB).`
  },
  terraform: {
    title: "Permissive S3 Bucket",
    context: "terraform",
    data: `resource "aws_s3_bucket" "sensitive_data" {
  bucket        = "omega-enterprise-sensitive-data"
  force_destroy = true
}

resource "aws_s3_bucket_acl" "sensitive_data_acl" {
  bucket = aws_s3_bucket.sensitive_data.id
  acl    = "public-read" # Security concern: public read access enabled
}

resource "aws_s3_bucket_public_access_block" "block" {
  bucket = aws_s3_bucket.sensitive_data.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}`
  },
  jenkins: {
    title: "Docker Connection Refused",
    context: "logs",
    data: `[INFO] Running build step: Docker Build & Push
[ERROR] Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
[ERROR] Jenkins build failed in stage "Docker Build & Push" with exit code 1.
[INFO] Sending Slack alerting notification...
[WARN] Vault connection timed out during secret retrieval.`
  },
  prometheus: {
    title: "High Latency Alert",
    context: "metrics",
    data: `{
  "alertname": "RedisHighLatency",
  "severity": "critical",
  "instance": "redis-master:6379",
  "summary": "Redis average response time exceeds 250ms",
  "description": "Redis database latency has spiked over the last 5 minutes due to high connection count (1,245 active connections)."
}`
  }
};

function App() {
  // DB Items States
  const [dbItems, setDbItems] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');

  // AI Analyzer States
  const [logInput, setLogInput] = useState('');
  const [contextType, setContextType] = useState('logs');
  const [aiResponse, setAiResponse] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Fetch DB Items on mount
  useEffect(() => {
    fetchDbItems();
  }, []);

  async function fetchDbItems() {
    setDbLoading(true);
    setDbError('');
    try {
      const res = await fetch(`${API_BASE}/items/`);
      if (!res.ok) throw new Error('Failed to fetch items');
      const data = await res.json();
      setDbItems(data);
    } catch (err) {
      setDbError(err.message || 'Database connection offline');
    } finally {
      setDbLoading(false);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setDbLoading(true);
    try {
      const res = await fetch(`${API_BASE}/items/?name=${encodeURIComponent(newItemName)}&description=${encodeURIComponent(newItemDesc)}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to add item');
      setNewItemName('');
      setNewItemDesc('');
      fetchDbItems();
    } catch (err) {
      setDbError(err.message || 'Failed to save item');
      setDbLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!logInput.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiResponse('');
    setAiModel('');
    try {
      const res = await fetch(`${API_BASE}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          log_data: logInput,
          context_type: contextType
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to analyze');
      }
      const data = await res.json();
      setAiResponse(data.analysis);
      setAiModel(data.model);
    } catch (err) {
      setAiError(err.message || 'AI request failed');
    } finally {
      setAiLoading(false);
    }
  }

  function loadTemplate(key) {
    const tmpl = TEMPLATES[key];
    if (tmpl) {
      setLogInput(tmpl.data);
      setContextType(tmpl.context);
    }
  }

  // Custom high-fidelity Markdown parser/renderer
  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let insideCodeBlock = false;
    let codeBlockLines = [];
    let codeBlockLang = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        if (insideCodeBlock) {
          elements.push(
            <div key={`code-${i}`} className="md-code-container">
              {codeBlockLang && <span className="md-code-lang">{codeBlockLang}</span>}
              <pre className="md-pre"><code>{codeBlockLines.join('\n')}</code></pre>
            </div>
          );
          codeBlockLines = [];
          insideCodeBlock = false;
        } else {
          insideCodeBlock = true;
          codeBlockLang = line.replace('```', '').trim() || 'code';
        }
        continue;
      }

      if (insideCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="md-h1">{line.slice(2)}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="md-h2">{line.slice(3)}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="md-h3">{line.slice(4)}</h3>);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(<li key={i} className="md-li">{line.slice(2)}</li>);
      } else if (line.startsWith('> ')) {
        elements.push(<blockquote key={i} className="md-quote">{line.slice(2)}</blockquote>);
      } else {
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;
        const parts = [];
        let lastIdx = 0;
        while ((match = boldRegex.exec(line)) !== null) {
          parts.push(line.substring(lastIdx, match.index));
          parts.push(<strong key={match.index}>{match[1]}</strong>);
          lastIdx = boldRegex.lastIndex;
        }
        parts.push(line.substring(lastIdx));

        if (line.trim() === '') {
          elements.push(<div key={i} className="md-spacer" />);
        } else {
          elements.push(
            <p key={i} className="md-p">
              {parts.length > 1 ? parts : line}
            </p>
          );
        }
      }
    }
    return elements;
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="pulse-indicator"></div>
          <h1>OMEGA AIOps Dashboard</h1>
          <span className="badge">v1.1 Enterprise</span>
        </div>
        <div className="system-status">
          <span className="status-label">Environment:</span>
          <span className="status-val k8s-text">Minikube / Istio Mesh</span>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="dashboard-grid">
        
        {/* Left Column: DB CRUD Test & Configuration */}
        <section className="dashboard-card db-card">
          <div className="card-header">
            <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
            </svg>
            <h2>Database Sync & CRUD Check</h2>
          </div>
          
          {dbError && (
            <div className="alert alert-error">
              <strong>Database Error:</strong> {dbError}
              <button className="btn-retry" onClick={fetchDbItems}>Retry</button>
            </div>
          )}

          <form onSubmit={handleAddItem} className="db-form">
            <div className="input-group">
              <label>DevOps Action Item</label>
              <input 
                type="text" 
                placeholder="e.g. Upgrade Jenkins Helm chart" 
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label>Assignee / Details</label>
              <input 
                type="text" 
                placeholder="e.g. DevOps Platform Team" 
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={dbLoading}>
              {dbLoading ? 'Saving...' : 'Add Action Item'}
            </button>
          </form>

          <div className="items-list-container">
            <h3>Registered Action Items ({dbItems.length})</h3>
            {dbLoading && <div className="spinner-small"></div>}
            {!dbLoading && dbItems.length === 0 && (
              <p className="no-items-text">No action items found in PostgreSQL. Add one above!</p>
            )}
            <ul className="items-list">
              {dbItems.map((item) => (
                <li key={item.id} className="item-row">
                  <div className="item-main">
                    <span className="item-name">{item.name}</span>
                    {item.description && <span className="item-desc">{item.description}</span>}
                  </div>
                  <span className="item-id">ID: {item.id}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Right Column: AI Operations Analysis */}
        <section className="dashboard-card ai-card">
          <div className="card-header">
            <svg className="card-icon glow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
              <circle cx="12" cy="12" r="4"></circle>
            </svg>
            <h2>Gemini AIOps Log & Config Analyzer</h2>
          </div>

          <div className="template-bar">
            <span className="bar-label">Pre-filled Templates:</span>
            <div className="template-buttons">
              <button type="button" className="btn-tab" onClick={() => loadTemplate('kubernetes')}>Kubernetes OOM</button>
              <button type="button" className="btn-tab" onClick={() => loadTemplate('terraform')}>Terraform ACL</button>
              <button type="button" className="btn-tab" onClick={() => loadTemplate('jenkins')}>Jenkins Daemon</button>
              <button type="button" className="btn-tab" onClick={() => loadTemplate('prometheus')}>Prometheus Alert</button>
            </div>
          </div>

          <div className="ai-control-group">
            <div className="input-group inline-group">
              <label>Context Type</label>
              <select value={contextType} onChange={(e) => setContextType(e.target.value)}>
                <option value="logs">Application/Build Logs</option>
                <option value="kubernetes">Kubernetes Manifests</option>
                <option value="terraform">Terraform IaC</option>
                <option value="metrics">Prometheus Metrics / Alert JSON</option>
              </select>
            </div>
            
            <div className="input-group">
              <label>Raw Log / Code Input</label>
              <textarea
                placeholder="Paste your Kubernetes yaml, Terraform code, or build log here..."
                value={logInput}
                onChange={(e) => setLogInput(e.target.value)}
                rows={8}
              />
            </div>

            <button 
              type="button" 
              className="btn-ai" 
              onClick={handleAnalyze} 
              disabled={aiLoading || !logInput.trim()}
            >
              {aiLoading ? (
                <>
                  <span className="spinner-ai"></span>
                  Analyzing via Gemini AI...
                </>
              ) : (
                'Run Gemini AI Diagnostics'
              )}
            </button>
          </div>

          {aiError && (
            <div className="alert alert-error">
              <strong>Gemini API Error:</strong> {aiError}
            </div>
          )}

          {aiResponse && (
            <div className="ai-output-container">
              <div className="output-header">
                <span className="output-title">🤖 Gemini Diagnostic Insights</span>
                {aiModel && <span className="model-badge">Model: {aiModel}</span>}
              </div>
              <div className="output-content">
                {renderMarkdown(aiResponse)}
              </div>
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>© 2026 Omega DevOps Framework. Powered by Google Gemini and Enterprise-grade microservices.</p>
      </footer>
    </div>
  );
}

export default App;
