import { useState, useEffect, useRef } from 'react'
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

const INITIAL_FLOW_STAGES = [
  { id: 'code', label: '1. CODE', desc: 'Git Commit', status: 'completed', color: '#58a6ff', log: 'commit cbcf2ec HEAD -> master\nAuthor: Humesh Deshmukh <humesh@omega.enterprise>\nDate: 2026-06-10\n- updated frontend layout to full-screen cockpit dashboard\n- integrated live telemetry simulator\n- optimized Helm timeout values' },
  { id: 'build', label: '2. BUILD', desc: 'Jenkins CI', status: 'completed', color: '#58a6ff', log: '[INFO] Starting Jenkins Pipeline Build #24...\n[INFO] Checking out branch master...\n[INFO] Running unit tests...\n[INFO] Test execution passed! (142 tests completed)\n[INFO] Docker image compilation success: omega-backend:1.2-rc1\n[INFO] Docker image compilation success: omega-frontend:1.2-rc1' },
  { id: 'test', label: '3. TEST', desc: 'SonarQube Quality', status: 'completed', color: '#3fb950', log: 'SonarQube scanner running...\n- Quality Gate: PASSED\n- Vulnerabilities: 0 Critical, 2 High\n- Code Smells: 4\n- Coverage: 92.4%\n- Security Hotspots: 1 reviewed' },
  { id: 'artifact', label: '4. ARTIFACT', desc: 'Nexus Upload', status: 'completed', color: '#58a6ff', log: 'Nexus Repository Manager API Connection...\nUploading docker image tag: omega-backend:1.2-rc1...\nUploading docker image tag: omega-frontend:1.2-rc1...\nUpload successful! HTTP 201 Created (224MB, 114MB)' },
  { id: 'iac', label: '5. IAC', desc: 'Terraform Plan', status: 'completed', color: '#bc8cff', log: 'Terraform v1.8.0 plan success.\nInfracost Cost Estimate:\nBaseline Monthly Cost: $142.50\nProposed Monthly Cost: $204.10\nCost Delta: +$61.60\nSecurity Policy Checked: 2 compliant, 1 non-compliant (S3 Public access block warning)' },
  { id: 'sync', label: '6. GITOPS', desc: 'ArgoCD Sync', status: 'completed', color: '#3fb950', log: 'ArgoCD application sync triggered...\n- Replicas: 4/4 synchronized\n- Ingress routes verified\n- ConfigMaps & Secrets matched\n- Status: Synced & Healthy' },
  { id: 'mesh', label: '7. MESH', desc: 'Istio Service Split', status: 'active', color: '#bc8cff', log: 'Istio ingress gateway online.\nVirtualService traffic routing:\n- omega-frontend -> 100% (v1.1)\n- omega-backend -> 90% (v1.1), 10% (v1.2-canary)\nSidecar injection: enabled in default namespace' },
  { id: 'telemetry', label: '8. TELEMETRY', desc: 'Prometheus Stack', status: 'active', color: '#58a6ff', log: 'Scraping metrics endpoint /metrics...\n- Latency Average: 42ms\n- Active connections: 85\n- Request rate: 12.4 req/sec\n- CPU metrics collected' },
  { id: 'aiops', label: '9. AIOPS', desc: 'Gemini Analysis', status: 'idle', color: '#bc8cff', log: 'AIOps Engine initialized.\nWaiting for log or config upload in the diagnostics panel...' }
];

const MOCK_POD_LOGS = {
  'omega-backend-7c98f-lmx': [
    "[18:04:10] Starting backend service on port 8000...",
    "[18:04:11] Connected to PostgreSQL Database at omega-postgres-db-0.db.svc",
    "[18:04:12] Redis connection pool initialized.",
    "[18:04:14] Istio sidecar proxy handshake completed (mTLS enabled).",
    "[18:04:15] Health check /healthz returned HTTP 200 OK.",
    "[18:04:20] GET /items/ - 200 OK (8.4ms)",
    "[18:04:25] GET /api/ai/analyze - 200 OK (245ms)",
  ],
  'omega-frontend-5b4c9-qrs': [
    "[18:04:08] Starting nginx web server...",
    "[18:04:09] DNS lookup configuration loaded.",
    "[18:04:11] Ingress rule matched / -> omega-frontend:80",
    "[18:04:12] Istio sidecar proxy configured with Envoy v1.30.",
    "[18:04:15] GET /index.html - 200 OK",
    "[18:04:18] GET /assets/index.css - 200 OK",
  ],
  'omega-postgres-db-0': [
    "[18:04:02] PostgreSQL Database cluster initialized.",
    "[18:04:03] Listening on local socket and port 5432.",
    "[18:04:05] Database 'omega_enterprise' ready for connections.",
    "[18:04:11] Connection received from 10.244.1.42 (omega-backend).",
    "[18:04:11] Authorized user 'humesh' (SSL enabled).",
    "[18:04:20] SELECT * FROM items; - SUCCESS (1.2ms)",
  ],
  'istio-ingressgateway-7c8': [
    "[18:03:59] Istio Ingress Gateway bootstrap completed.",
    "[18:04:00] Listening on ports 80 and 443.",
    "[18:04:11] Route rules matched host: omega.enterprise",
    "[18:04:12] Forwarding request: GET / -> omega-frontend-5b4c9-qrs:80",
    "[18:04:15] TLS handshake success with client: TLSv1.3 ECDHE-RSA-AES256-GCM-SHA384",
  ]
};

const INITIAL_MOCK_JENKINS_LOGS = {
  '#24': `[INFO] Jenkins Pipeline Build #24 STARTED\n[INFO] Triggered by: VCS push from Humesh\n[INFO] Checking out branch master...\n[INFO] Running unit tests...\n- testBackendCRUD: PASSED\n- testAIOpsModel: PASSED\n- testTelemetryPulse: PASSED\n[INFO] Testing completed successfully (3 passed)\n[INFO] Compiling production assets with Node 20...\n[INFO] Docker image tag: omega-backend:1.2-rc1 built successfully.\n[INFO] Docker image tag: omega-frontend:1.2-rc1 built successfully.\n[INFO] Uploading artifacts to Nexus repository manager on port 8081...\n[INFO] Triggering ArgoCD GitOps webhook reconciliation...\n[INFO] Jenkins Build #24 SUCCESS!`,
  '#23': `[INFO] Jenkins Pipeline Build #23 STARTED\n[INFO] Triggered by: VCS push from Humesh\n[INFO] Checking out branch master...\n[INFO] Running unit tests...\n- testBackendCRUD: PASSED\n- testTelemetryPulse: PASSED\n[INFO] Testing completed (2 passed)\n[INFO] Docker image tag: omega-backend:1.1.2 built successfully.\n[INFO] Uploading artifacts to Nexus...\n[INFO] Jenkins Build #23 SUCCESS`,
  '#22': `[INFO] Jenkins Pipeline Build #22 STARTED\n[INFO] Triggered by: VCS push from Bob\n[INFO] Checking out branch feature-metrics...\n[INFO] Running unit tests...\n- testBackendCRUD: PASSED\n- testTelemetryPulse: FAILED (connection reset by peer)\n[ERROR] testTelemetryPulse failed at line 142.\n[ERROR] Cannot connect to Prometheus metrics service.\n[ERROR] Docker image compilation skipped.\n[ERROR] Jenkins Build #22 FAILED\n[INFO] Sending Slack alerting notification...`,
  '#21': `[INFO] Jenkins Pipeline Build #21 STARTED\n[INFO] Triggered by: VCS push from Charlie\n[INFO] Checking out branch master...\n[INFO] Running unit tests...\n- testBackendCRUD: PASSED\n[INFO] Testing completed (1 passed)\n[INFO] Docker build success.\n[INFO] Jenkins Build #21 SUCCESS`
};

function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('overview'); // overview, pipeline, mesh, aiops
  const [cicdLogTab, setCicdLogTab] = useState('jenkins'); // jenkins, stage

  // DB Items States
  const [dbItems, setDbItems] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPriority, setNewItemPriority] = useState('High');
  const [newItemAssignee, setNewItemAssignee] = useState('Humesh');

  // AI Analyzer States
  const [logInput, setLogInput] = useState('');
  const [contextType, setContextType] = useState('logs');
  const [aiResponse, setAiResponse] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiStreamingText, setAiStreamingText] = useState('');

  // Interactive flow states
  const [stagesList, setStagesList] = useState(INITIAL_FLOW_STAGES);
  const [selectedStage, setSelectedStage] = useState(INITIAL_FLOW_STAGES[6]); // default to Istio Mesh stage
  const [pipelineLog, setPipelineLog] = useState(INITIAL_FLOW_STAGES[6].log);
  const [isSimulatingPipeline, setIsSimulatingPipeline] = useState(false);

  // Istio Canary states
  const [canarySplit, setCanarySplit] = useState(10); // 0 to 100

  // GitOps ArgoCD states
  const [argoSyncStatus, setArgoSyncStatus] = useState('Synced');
  const [argoHealthStatus, setArgoHealthStatus] = useState('Healthy');
  const [isArgoSyncing, setIsArgoSyncing] = useState(false);
  const [selectedArgoResource, setSelectedArgoResource] = useState('Deployment');

  // Security Audit & CVE states
  const [cveCounts, setCveCounts] = useState({ critical: 0, high: 2, medium: 8, low: 15 });
  const [isCveScanning, setIsCveScanning] = useState(false);
  const [lastCveScanTime, setLastCveScanTime] = useState('1 hour ago');

  // Jenkins Build History states
  const [jenkinsBuilds, setJenkinsBuilds] = useState([
    { id: '#24', status: 'SUCCESS', branch: 'master', commit: 'cbcf2ec', duration: '2m 14s', date: '10 mins ago', author: 'Humesh' },
    { id: '#23', status: 'SUCCESS', branch: 'master', commit: 'e79b9a1', duration: '2m 08s', date: '1 hour ago', author: 'Humesh' },
    { id: '#22', status: 'FAILURE', branch: 'feature-metrics', commit: 'a4b2c8e', duration: '1m 45s', date: '3 hours ago', author: 'Bob' },
    { id: '#21', status: 'SUCCESS', branch: 'master', commit: '98d7f2a', duration: '2m 19s', date: '5 hours ago', author: 'Charlie' }
  ]);
  const [isJenkinsBuilding, setIsJenkinsBuilding] = useState(false);
  const [jenkinsLogsMap, setJenkinsLogsMap] = useState(INITIAL_MOCK_JENKINS_LOGS);
  const [selectedJenkinsBuild, setSelectedJenkinsBuild] = useState('#24');
  const [activeJenkinsLog, setActiveJenkinsLog] = useState(INITIAL_MOCK_JENKINS_LOGS['#24']);

  // Live Telemetry states (Simulator)
  const [cpuLoad, setCpuLoad] = useState(42.5);
  const [memLoad, setMemLoad] = useState(68.2);
  const [reqRate, setReqRate] = useState(12.4);
  const [errorRate, setErrorRate] = useState(0.02);
  const [latencyHistory, setLatencyHistory] = useState([41, 45, 38, 42, 49, 44, 42]);
  const [podsList, setPodsList] = useState([
    { name: 'omega-backend-7c98f-lmx', ready: '1/1', status: 'Running', restarts: 0, cpu: '48m', mem: '184Mi', statusClass: 'running' },
    { name: 'omega-frontend-5b4c9-qrs', ready: '1/1', status: 'Running', restarts: 0, cpu: '12m', mem: '34Mi', statusClass: 'running' },
    { name: 'omega-postgres-db-0', ready: '1/1', status: 'Running', restarts: 0, cpu: '8m', mem: '96Mi', statusClass: 'running' },
    { name: 'istio-ingressgateway-7c8', ready: '1/1', status: 'Running', restarts: 0, cpu: '22m', mem: '112Mi', statusClass: 'running' }
  ]);

  // Selected pod log drawer
  const [selectedPod, setSelectedPod] = useState(null);
  const [podLogs, setPodLogs] = useState([]);
  const [isPodDrawerOpen, setIsPodDrawerOpen] = useState(false);

  // Live System Events Feed for Overview Tab
  const [systemEvents, setSystemEvents] = useState([
    { time: '22:01:05', type: 'git', text: 'Commit cbcf2ec pushed to master by Humesh' },
    { time: '22:01:10', type: 'jenkins', text: 'Jenkins Build #24 completed successfully in 2m 14s' },
    { time: '22:01:12', type: 'trivy', text: 'Trivy vulnerability scan finished: 0 Critical threats' },
    { time: '22:01:15', type: 'argo', text: 'ArgoCD synchronized deployment manifests to target 1.2-rc1' },
    { time: '22:01:22', type: 'istio', text: 'Istio split route updated: Canary subset gets 10% traffic' }
  ]);

  const logEndRef = useRef(null);
  const podLogEndRef = useRef(null);
  const eventsEndRef = useRef(null);
  const jenkinsLogEndRef = useRef(null);

  // Simulate dynamic telemetry changes, adjusted by Canary Split
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuLoad(prev => {
        const base = 40 + (canarySplit * 0.25);
        return Math.min(Math.max(Number((base + (Math.random() * 6 - 3)).toFixed(1)), 15), 95);
      });
      setMemLoad(prev => {
        const base = 65 + (canarySplit * 0.1);
        return Math.min(Math.max(Number((base + (Math.random() * 4 - 2)).toFixed(1)), 30), 90);
      });
      
      setReqRate(prev => {
        const baseRate = 12.4 + (canarySplit * 0.15);
        return Math.min(Math.max(Number((baseRate + (Math.random() * 2 - 1)).toFixed(1)), 2), 45);
      });

      setErrorRate(prev => {
        if (canarySplit > 80) {
          return Number((0.08 + Math.random() * 0.07).toFixed(3));
        } else if (canarySplit > 50) {
          return Number((0.02 + Math.random() * 0.03).toFixed(3));
        } else {
          return Number((0.002 + Math.random() * 0.01).toFixed(3));
        }
      });
      
      setLatencyHistory(prev => {
        const next = [...prev.slice(1)];
        const baseLatency = 35 + Math.floor(canarySplit * 0.3);
        const newVal = Math.floor(baseLatency + Math.random() * 15);
        next.push(newVal);
        return next;
      });

      setPodsList(prev => prev.map(pod => {
        let cpuVal = 5 + Math.floor(Math.random() * 15);
        let memVal = '32Mi';

        if (pod.name.includes('backend')) {
          cpuVal = 30 + Math.floor(canarySplit * 0.4) + Math.floor(Math.random() * 10);
          memVal = `${160 + Math.floor(Math.random() * 20) + Math.floor(canarySplit * 0.5)}Mi`;
        } else if (pod.name.includes('db')) {
          cpuVal = 8 + Math.floor(Math.random() * 4);
          memVal = `${92 + Math.floor(Math.random() * 8)}Mi`;
        } else if (pod.name.includes('ingress')) {
          cpuVal = 15 + Math.floor(canarySplit * 0.2) + Math.floor(Math.random() * 6);
          memVal = `${105 + Math.floor(Math.random() * 10)}Mi`;
        } else if (pod.name.includes('frontend')) {
          cpuVal = 10 + Math.floor(Math.random() * 5);
          memVal = `${30 + Math.floor(Math.random() * 5)}Mi`;
        }

        return {
          ...pod,
          cpu: `${cpuVal}m`,
          mem: memVal
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [canarySplit]);

  // Pod Logs stream simulator
  useEffect(() => {
    if (!selectedPod || !isPodDrawerOpen) return;

    const interval = setInterval(() => {
      setPodLogs(prev => {
        const next = [...prev];
        if (next.length > 50) next.shift();
        
        const timestamp = new Date().toLocaleTimeString();
        const routes = ["/items/", "/api/ai/analyze", "/healthz", "/metrics"];
        const selectedRoute = routes[Math.floor(Math.random() * routes.length)];
        const latency = Math.floor(5 + Math.random() * 120);
        
        let newLog = `[${timestamp}] INFO: client connected, PID: ${Math.floor(100 + Math.random() * 900)}`;
        if (selectedPod.includes('backend')) {
          newLog = `[${timestamp}] GET ${selectedRoute} - 200 OK (${latency}ms) - thread_pool_active: ${Math.floor(Math.random() * 5)}`;
        } else if (selectedPod.includes('frontend')) {
          newLog = `[${timestamp}] NGINX Access: client 10.244.0.1 - GET /static/index.js HTTP/1.1 200 (size: ${Math.floor(12 + Math.random()*20)}KB)`;
        } else if (selectedPod.includes('db')) {
          newLog = `[${timestamp}] DB Engine: Active connections - ${Math.floor(2 + Math.random()*5)}, idle connections: 12`;
        } else if (selectedPod.includes('ingress')) {
          newLog = `[${timestamp}] Proxy: Route matched backend - weighting: stable=${100-canarySplit}%, canary=${canarySplit}%`;
        }
        
        next.push(newLog);
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedPod, isPodDrawerOpen, canarySplit]);

  // Push new events to Overview Feed randomly
  useEffect(() => {
    const interval = setInterval(() => {
      const timestamp = new Date().toLocaleTimeString();
      const mockEvents = [
        { type: 'telemetry', text: `Scraping metrics: Average latency stable at ${latencyHistory[latencyHistory.length-1]}ms` },
        { type: 'k8s', text: `Node kube-state-metrics: CPU utilization normalized at ${cpuLoad}%` },
        { type: 'db', text: `Postgres database pool check: Healthy, ${dbItems.length} tasks registered` },
        { type: 'istio', text: `Canary traffic split validated: subset weights balanced at ${100-canarySplit}:${canarySplit}` }
      ];
      const selectedEvent = mockEvents[Math.floor(Math.random() * mockEvents.length)];
      setSystemEvents(prev => {
        const next = [...prev];
        if (next.length > 25) next.shift();
        next.push({ time: timestamp, type: selectedEvent.type, text: selectedEvent.text });
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [latencyHistory, cpuLoad, dbItems, canarySplit]);

  // Fetch DB Items on mount
  useEffect(() => {
    fetchDbItems();
  }, []);

  // Scroll details panes to bottom
  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [pipelineLog]);

  useEffect(() => {
    if (podLogEndRef.current) podLogEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [podLogs]);

  useEffect(() => {
    if (eventsEndRef.current) eventsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [systemEvents]);

  useEffect(() => {
    if (jenkinsLogEndRef.current) jenkinsLogEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [activeJenkinsLog]);

  // Stream typing response for AI Diagnostics
  useEffect(() => {
    if (!aiResponse) {
      setAiStreamingText('');
      return;
    }
    
    let index = 0;
    setAiStreamingText('');
    const typingTimer = setInterval(() => {
      setAiStreamingText(prev => prev + aiResponse.charAt(index));
      index++;
      if (index >= aiResponse.length) {
        clearInterval(typingTimer);
      }
    }, 12);

    return () => clearInterval(typingTimer);
  }, [aiResponse]);

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
    
    const formattedDesc = `${newItemAssignee} | ${newItemPriority}`;
    
    try {
      const res = await fetch(`${API_BASE}/items/?name=${encodeURIComponent(newItemName)}&description=${encodeURIComponent(formattedDesc)}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to add item');
      
      setSystemEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        type: 'db',
        text: `PG Database: Saved task "${newItemName}" assigned to ${newItemAssignee}`
      }]);
      
      setNewItemName('');
      fetchDbItems();
    } catch (err) {
      setDbError(err.message || 'Failed to save item');
      setDbLoading(false);
    }
  }

  async function handleDeleteItem(itemId) {
    setDbLoading(true);
    try {
      const res = await fetch(`${API_BASE}/items/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete item');
      fetchDbItems();
    } catch (err) {
      setDbError(err.message || 'Failed to delete item');
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

  function handleStageClick(stage) {
    setSelectedStage(stage);
    setPipelineLog(stage.log);
    setCicdLogTab('stage');
  }

  // Trigger simulated Jenkins Build
  function handleTriggerJenkinsBuild() {
    if (isJenkinsBuilding) return;
    setIsJenkinsBuilding(true);
    
    const newBuildId = `#${parseInt(jenkinsBuilds[0].id.replace('#', '')) + 1}`;
    const newBuild = {
      id: newBuildId,
      status: 'BUILDING',
      branch: 'master',
      commit: Math.random().toString(16).substring(2, 9),
      duration: '--',
      date: 'Just now',
      author: 'Humesh'
    };
    
    setJenkinsBuilds(prev => [newBuild, ...prev]);
    setSelectedJenkinsBuild(newBuildId);
    setCicdLogTab('jenkins');
    
    const startLog = `[INFO] Jenkins Pipeline Build ${newBuildId} STARTED\n[INFO] Triggered by: manual operator dashboard click\n[INFO] Checking out branch master...\n[INFO] Compiling production web assets...\n[INFO] Running test runner suit...`;
    setActiveJenkinsLog(startLog);

    setSystemEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      type: 'jenkins',
      text: `Jenkins Pipeline: Triggered build run ${newBuildId}`
    }]);

    setStagesList(prev => prev.map(s => s.id === 'build' ? { ...s, status: 'active', log: '[INFO] Jenkins Build triggered...\n[INFO] Compiling files...' } : s));

    setTimeout(() => {
      const midLog = `${startLog}\n[INFO] Unit tests running...\n- testBackendCRUD: PASSED\n- testAIOpsModel: PASSED\n- testTelemetryPulse: PASSED\n[INFO] Testing completed successfully.\n[INFO] Running static analysis scanning...\n[INFO] Compilation success. Packaging Docker Container layers...`;
      setActiveJenkinsLog(midLog);
      
      setStagesList(prev => prev.map(s => s.id === 'build' ? { ...s, log: '[INFO] Unit tests: PASSED. Compiling Docker image layer...' } : s));
    }, 2000);

    setTimeout(() => {
      setJenkinsBuilds(prev => prev.map(b => b.id === newBuildId ? { ...b, status: 'SUCCESS', duration: '2m 04s' } : b));
      
      const completeLog = `[INFO] Jenkins Pipeline Build ${newBuildId} SUCCESS\n- Unit tests: 142 passed\n- Security scan: Trivy CVE compliance passed\n- Docker image tag: omega-backend:1.2-rc2 built successfully (224MB)\n- Docker image tag: omega-frontend:1.2-rc2 built successfully (114MB)\n[INFO] Uploading artifacts to Nexus server...\n[INFO] Artifact tag published: HTTP 201 Created\n[INFO] Triggering GitOps reconciliation sync...\n[INFO] Pipeline execution FINISHED successfully.`;
      
      setActiveJenkinsLog(completeLog);
      setJenkinsLogsMap(prev => ({ ...prev, [newBuildId]: completeLog }));

      setStagesList(prev => prev.map(s => s.id === 'build' ? { 
        ...s, 
        status: 'completed', 
        log: `[INFO] Jenkins Pipeline Build ${newBuildId} SUCCESS\n- Unit tests: 142 passed\n- Security scan: Trivy compliance passed\n- Built image successfully` 
      } : s));
      setSystemEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        type: 'jenkins',
        text: `Jenkins Pipeline: Build ${newBuildId} finished SUCCESS in 2m 04s`
      }]);
      setIsJenkinsBuilding(false);
    }, 4500);
  }

  // Handle selecting a Jenkins build in history
  function handleSelectJenkinsBuild(build) {
    setSelectedJenkinsBuild(build.id);
    setActiveJenkinsLog(jenkinsLogsMap[build.id] || `[INFO] Logs for build ${build.id} not loaded.`);
    setCicdLogTab('jenkins');
  }

  // Trigger ArgoCD GitOps Re-Sync
  function handleTriggerArgoSync() {
    if (isArgoSyncing) return;
    setIsArgoSyncing(true);
    setArgoSyncStatus('Syncing');
    setArgoHealthStatus('Progressing');
    setSystemEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      type: 'argo',
      text: 'ArgoCD GitOps: Initiated manual applications manifest synchronisation'
    }]);

    setStagesList(prev => prev.map(s => s.id === 'sync' ? { ...s, status: 'active', log: 'ArgoCD synchronizing manifests...' } : s));

    setTimeout(() => {
      setArgoSyncStatus('Synced');
      setArgoHealthStatus('Healthy');
      setIsArgoSyncing(false);
      setStagesList(prev => prev.map(s => s.id === 'sync' ? { 
        ...s, 
        status: 'completed', 
        log: 'ArgoCD Synchronized.\nTarget Version: 1.2-rc1\nHealth: Healthy\nReplicaSets updated successfully' 
      } : s));
      setSystemEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        type: 'argo',
        text: 'ArgoCD GitOps: Manifest sync success. Cluster state matches VCS branch target'
      }]);
    }, 3500);
  }

  // Trigger CVE Security scan
  function handleTriggerCveScan() {
    if (isCveScanning) return;
    setIsCveScanning(true);
    setCveCounts({ critical: 0, high: 0, medium: 0, low: 0 });
    setSystemEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      type: 'trivy',
      text: 'Trivy Audit: Initiating Kubernetes namespace container image scan'
    }]);

    setTimeout(() => {
      setCveCounts({ critical: 0, high: 1, medium: 4, low: 9 });
      setLastCveScanTime('Just now');
      setIsCveScanning(false);
      setSystemEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        type: 'trivy',
        text: 'Trivy Audit: Scan completed. High threats reduced to 1, Medium threats: 4'
      }]);
    }, 3000);
  }

  // Trigger Full Pipeline Run Animation
  function handleTriggerPipelineRun() {
    if (isSimulatingPipeline) return;
    setIsSimulatingPipeline(true);
    setCicdLogTab('stage');
    setSystemEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      type: 'jenkins',
      text: 'Cockpit Simulation: Started sequential CI/CD lifecycle pipeline run'
    }]);
    
    setStagesList(prev => prev.map((s, idx) => ({
      ...s,
      status: idx === 0 ? 'active' : 'idle'
    })));
    setSelectedStage(stagesList[0]);
    setPipelineLog("Initializing pipeline run...\n");

    let currentStageIndex = 0;
    
    const interval = setInterval(() => {
      if (currentStageIndex >= stagesList.length) {
        clearInterval(interval);
        setIsSimulatingPipeline(false);
        setStagesList(INITIAL_FLOW_STAGES);
        setSelectedStage(INITIAL_FLOW_STAGES[6]);
        setPipelineLog(INITIAL_FLOW_STAGES[6].log);
        setSystemEvents(prev => [...prev, {
          time: new Date().toLocaleTimeString(),
          type: 'jenkins',
          text: 'Cockpit Simulation: Sequential CI/CD pipeline run finished successfully'
        }]);
        return;
      }

      const stage = stagesList[currentStageIndex];
      setSelectedStage(stage);
      setPipelineLog(stage.log);

      setStagesList(prev => prev.map((s, idx) => {
        if (idx === currentStageIndex) return { ...s, status: 'active' };
        if (idx < currentStageIndex) return { ...s, status: 'completed' };
        return { ...s, status: 'idle' };
      }));

      currentStageIndex++;
    }, 2000);
  }

  // Handle Pod click to show Drawer
  function handlePodClick(pod) {
    setSelectedPod(pod.name);
    setPodLogs(MOCK_POD_LOGS[pod.name] || [
      `[18:04:12] Initializing pod ${pod.name}...`,
      `[18:04:13] Sidecar configuration loaded successfully.`,
      `[18:04:14] Streaming container metrics (Ready ${pod.ready})...`
    ]);
    setIsPodDrawerOpen(true);
  }

  // Parse description into Assignee and Priority
  function parseDescription(desc) {
    if (!desc) return { assignee: 'N/A', priority: 'Medium' };
    const parts = desc.split('|');
    if (parts.length < 2) return { assignee: desc, priority: 'Medium' };
    return { assignee: parts[0].trim(), priority: parts[1].trim() };
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

  const renderArgoNode = (type, name, status) => {
    const isSelected = selectedArgoResource === type;
    return (
      <div 
        className={`argo-tree-node ${isSelected ? 'selected' : ''} ${status}`}
        onClick={() => setSelectedArgoResource(type)}
      >
        <span className="argo-node-dot"></span>
        <div className="argo-node-text">
          <span className="argo-node-type">{type}</span>
          <span className="argo-node-name">{name}</span>
        </div>
      </div>
    );
  };

  // Tab 1: Overview Screen Renderer
  const renderOverviewTab = () => {
    return (
      <div className="tab-pane-grid overview-grid-layout">
        {/* Column Left: Live metrics & Summary */}
        <div className="grid-column">
          {/* Card: Metric Health Summary */}
          <div className="dashboard-card overview-telemetry-card">
            <div className="card-header">
              <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              <h2>Telemetry Health Insights</h2>
            </div>
            
            <div className="overview-telemetry-body scrollable-panel-content">
              <div className="sparkline-container">
                <div className="sparkline-header-row">
                  <span className="spark-lbl">Network Latency History (ms)</span>
                  <span className="spark-curr-val">{latencyHistory[latencyHistory.length - 1]}ms</span>
                </div>
                <div className="sparkline-chart">
                  {latencyHistory.map((val, idx) => (
                    <div key={idx} className="sparkline-bar-wrapper">
                      <div 
                        className="sparkline-bar" 
                        style={{ height: `${Math.min(val * 1.2, 90)}px` }} 
                        title={`Latency: ${val}ms`}
                      ></div>
                      <span className="sparkline-val-lbl">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="metric-progress-panel">
                <div className="metric-prog-row">
                  <span className="prog-lbl">Cluster CPU Load</span>
                  <span className="prog-val">{cpuLoad}%</span>
                </div>
                <div className="prog-bar-track">
                  <div className="prog-bar-fill purple-fill" style={{ width: `${cpuLoad}%` }}></div>
                </div>

                <div className="metric-prog-row">
                  <span className="prog-lbl">Cluster Memory Allocation</span>
                  <span className="prog-val">{memLoad}%</span>
                </div>
                <div className="prog-bar-track">
                  <div className="prog-bar-fill blue-fill" style={{ width: `${memLoad}%` }}></div>
                </div>
              </div>

              <div className="overview-system-scores">
                <div className="score-box">
                  <span className="sc-val green-text">4 / 4</span>
                  <span className="sc-lbl">K8s Pods Active</span>
                </div>
                <div className="score-box">
                  <span className="sc-val orange-text">v1.2-canary</span>
                  <span className="sc-lbl">Istio Subset</span>
                </div>
                <div className="score-box">
                  <span className="sc-val purple-text">$204.10</span>
                  <span className="sc-lbl">Terraform Cost</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column Right: Live Event Streams */}
        <div className="grid-column">
          <div className="dashboard-card events-feed-card">
            <div className="card-header">
              <svg className="card-icon glow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <h2>Real-time DevOps Activity Feed</h2>
            </div>
            
            <div className="events-feed-body scrollable-panel-content">
              <div className="events-stream-list">
                {systemEvents.map((evt, idx) => (
                  <div key={idx} className={`event-feed-row event-${evt.type}`}>
                    <span className="event-time">[{evt.time}]</span>
                    <span className={`event-icon-dot dot-${evt.type}`}></span>
                    <span className="event-text">{evt.text}</span>
                  </div>
                ))}
                <div ref={eventsEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Tab 2: Integrated CI/CD Pipeline Renderer
  const renderPipelineTab = () => {
    return (
      <div className="cicd-tab-container">
        {/* Top Section: DevOps Lifecycle Pipeline Graph */}
        <div className="pipeline-graph-section">
          {renderPipelineGraph()}
        </div>

        {/* Bottom Section: Split Columns */}
        <div className="pipeline-bottom-grid">
          {/* Column Left: Jenkins CI Log History */}
          <div className="pipeline-bottom-col">
            <div className="dashboard-card jenkins-card">
              <div className="card-header">
                <svg className="card-icon color-jenkins" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="9" cy="9" r="2"></circle>
                  <circle cx="15" cy="9" r="2"></circle>
                  <path d="M9 15c1.5 1 4.5 1 6 0"></path>
                </svg>
                <h2>Jenkins CI Build Run Log History</h2>
              </div>
              <div className="jenkins-dashboard-content scrollable-panel-content">
                <div className="jenkins-actions-header">
                  <span className="builds-count">{jenkinsBuilds.length} builds recorded</span>
                  <button 
                    className={`btn-tab btn-build-jenkins ${isJenkinsBuilding ? 'building' : ''}`}
                    onClick={handleTriggerJenkinsBuild}
                    disabled={isJenkinsBuilding}
                  >
                    {isJenkinsBuilding ? 'Building...' : '⚒ Trigger Jenkins Build'}
                  </button>
                </div>

                <div className="jenkins-table-wrapper">
                  <table className="jenkins-table">
                    <thead>
                      <tr>
                        <th>Build</th>
                        <th>Branch</th>
                        <th>Commit</th>
                        <th>Duration</th>
                        <th>Trigger Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jenkinsBuilds.map((build, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => handleSelectJenkinsBuild(build)}
                          className={`pod-row-interactive ${selectedJenkinsBuild === build.id ? 'active-pod-row' : ''} ${build.status === 'SUCCESS' ? 'row-success' : build.status === 'FAILURE' ? 'row-fail' : 'row-running'}`}
                        >
                          <td className="build-id-td">{build.id}</td>
                          <td>{build.branch}</td>
                          <td className="font-mono-tag">{build.commit}</td>
                          <td>{build.duration}</td>
                          <td className="build-date-td">{build.date}</td>
                          <td>
                            <span className={`status-pill ${build.status.toLowerCase()}`}>{build.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Column Right: Consolidated Log Viewer */}
          <div className="pipeline-bottom-col">
            <div className="dashboard-card logs-card">
              <div className="card-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg className="card-icon color-jenkins" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="9" x2="20" y2="9"></line>
                    <line x1="16" y1="3" x2="14" y2="21"></line>
                  </svg>
                  <h2>CI/CD Console Logs Drawer</h2>
                </div>
                {/* Embedded Sub-tab selection */}
                <div className="logs-tab-menu" style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button"
                    className={`btn-tab ${cicdLogTab === 'jenkins' ? 'active' : ''}`}
                    onClick={() => setCicdLogTab('jenkins')}
                    style={{ fontSize: '11px', padding: '2px 8px', background: cicdLogTab === 'jenkins' ? 'rgba(56, 189, 248, 0.15)' : '', borderColor: cicdLogTab === 'jenkins' ? 'var(--accent-blue)' : '' }}
                  >
                    ⚒ Jenkins {selectedJenkinsBuild}
                  </button>
                  <button 
                    type="button"
                    className={`btn-tab ${cicdLogTab === 'stage' ? 'active' : ''}`}
                    onClick={() => setCicdLogTab('stage')}
                    style={{ fontSize: '11px', padding: '2px 8px', background: cicdLogTab === 'stage' ? 'rgba(192, 132, 252, 0.15)' : '', borderColor: cicdLogTab === 'stage' ? 'var(--accent-purple)' : '' }}
                  >
                    🔍 Stage: {selectedStage.label}
                  </button>
                </div>
              </div>

              <div className="log-viewer-pane">
                <div className="log-header">
                  <span className="log-title">
                    {cicdLogTab === 'jenkins' ? `Jenkins Console Output for ${selectedJenkinsBuild}` : `Stage Inspector: ${selectedStage.label}`}
                  </span>
                  <span className={`status-badge status-pill ${cicdLogTab === 'jenkins' ? 'synced' : 'synced'}`} style={{ backgroundColor: cicdLogTab === 'stage' ? selectedStage.color : '' }}>
                    {cicdLogTab === 'jenkins' ? 'SUCCESS' : selectedStage.status.toUpperCase()}
                  </span>
                </div>
                <pre className="log-output-pre">
                  <code>
                    {cicdLogTab === 'jenkins' ? activeJenkinsLog : pipelineLog}
                  </code>
                  <div ref={cicdLogTab === 'jenkins' ? jenkinsLogEndRef : logEndRef} />
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Tab 4: Cluster & Mesh Renderer
  const renderMeshTab = () => {
    return (
      <div className="tab-pane-grid mesh-grid-layout">
        {/* Column Left: ArgoCD Reconciliation */}
        <div className="grid-column">
          <div className="dashboard-card argocd-card">
            <div className="card-header">
              <svg className="card-icon color-argo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
              <h2>GitOps ArgoCD Reconciliation Tree</h2>
            </div>
            
            <div className="argo-dashboard-content scrollable-panel-content">
              <div className="argo-controls-strip">
                <div className="argo-status-labels">
                  <span className={`status-badge sync-${argoSyncStatus.toLowerCase()}`}>{argoSyncStatus}</span>
                  <span className={`status-badge health-${argoHealthStatus.toLowerCase()}`}>{argoHealthStatus}</span>
                </div>
                <button 
                  className={`btn-tab btn-sync-argo ${isArgoSyncing ? 'syncing' : ''}`}
                  onClick={handleTriggerArgoSync}
                  disabled={isArgoSyncing}
                >
                  {isArgoSyncing ? 'Syncing...' : '↻ GitOps Re-Sync'}
                </button>
              </div>

              <div className="argo-layout-container">
                <div className="argo-tree-column">
                  <h4>Application Root</h4>
                  {renderArgoNode('Application', 'omega-enterprise-app', argoSyncStatus.toLowerCase())}
                </div>
                
                <div className="argo-tree-arrow">➔</div>
                
                <div className="argo-tree-column">
                  <h4>Kubernetes Resources</h4>
                  {renderArgoNode('Deployment', 'omega-backend-deployment', argoHealthStatus.toLowerCase())}
                  {renderArgoNode('Service', 'omega-backend-svc', 'healthy')}
                  {renderArgoNode('Ingress', 'omega-ingressgateway', 'healthy')}
                </div>
              </div>

              {selectedArgoResource && (
                <div className="argo-resource-detail-box">
                  <h5>Selected: {selectedArgoResource} Schema</h5>
                  <pre className="font-mono-logs">
                    {selectedArgoResource === 'Application' && `source: \n  repoURL: https://github.com/humesh/omega.git\n  targetRevision: HEAD\n  path: k8s/base\ndestination:\n  server: https://kubernetes.default.svc\n  namespace: default`}
                    {selectedArgoResource === 'Deployment' && `spec:\n  replicas: 4\n  strategy:\n    type: RollingUpdate\n  template:\n    spec:\n      containers:\n      - name: backend\n        image: omega-backend:1.2-rc1`}
                    {selectedArgoResource === 'Service' && `spec:\n  ports:\n  - port: 8000\n    targetPort: 8000\n  selector:\n    app: omega-backend`}
                    {selectedArgoResource === 'Ingress' && `spec:\n  rules:\n  - host: omega.enterprise.internal\n    http:\n      paths:\n      - path: /api\n        backend: \n          serviceName: omega-backend`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column Middle: Traffic Shifter */}
        <div className="grid-column">
          <div className="dashboard-card istio-card">
            <div className="card-header">
              <svg className="card-icon color-mesh" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
              <h2>Istio VirtualService Traffic Shifter</h2>
            </div>
            <div className="istio-dashboard-content scrollable-panel-content">
              <div className="canary-slider-wrapper">
                <div className="canary-labels">
                  <span className="v-tag">Stable (v1.1): <strong>{100 - canarySplit}%</strong></span>
                  <span className="v-tag canary">Canary (v1.2): <strong>{canarySplit}%</strong></span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={canarySplit} 
                  onChange={(e) => setCanarySplit(parseInt(e.target.value))} 
                  className="canary-slider"
                />
              </div>

              {canarySplit > 80 && (
                <div className="canary-danger-alert animate-shake">
                  💥 <strong>WARNING:</strong> Split ratios above 80% on v1.2-canary are causing high simulated failure rates (up to 15%)! Dial back traffic or run AIOps diagnostics.
                </div>
              )}

              <div className="mesh-virtualservice-preview">
                <h5>routing subset weights</h5>
                <pre className="vs-yaml-pre">
{`- destination:
    host: omega-backend
    subset: v1
  weight: ${100 - canarySplit}
- destination:
    host: omega-backend
    subset: v2
  weight: ${canarySplit}`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Column Right: Pods list */}
        <div className="grid-column">
          <div className="dashboard-card k8s-card">
            <div className="card-header">
              <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
                <line x1="15" y1="3" x2="15" y2="21"></line>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="3" y1="15" x2="21" y2="15"></line>
              </svg>
              <h2>K8s Cluster Node Pods Monitor</h2>
            </div>
            
            <div className="k8s-pods-table-wrapper scrollable-panel-content">
              <span className="table-caption-lbl">Click a pod name to inspect container events stream:</span>
              <table className="k8s-table">
                <thead>
                  <tr>
                    <th>Pod Name</th>
                    <th>Ready</th>
                    <th>Status</th>
                    <th>CPU</th>
                    <th>Mem</th>
                  </tr>
                </thead>
                <tbody>
                  {podsList.map((pod, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => handlePodClick(pod)} 
                      className={`pod-row-interactive ${selectedPod === pod.name ? 'active-pod-row' : ''}`}
                    >
                      <td className="pod-name-td">📦 {pod.name}</td>
                      <td>{pod.ready}</td>
                      <td>
                        <span className={`status-pill ${pod.statusClass}`}>{pod.status}</span>
                      </td>
                      <td className="font-mono-tag">{pod.cpu}</td>
                      <td className="font-mono-tag">{pod.mem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Tab 5: AIOps & Tasks Renderer
  const renderAiopsTab = () => {
    return (
      <div className="tab-pane-grid aiops-grid-layout">
        {/* Column Left: Gemini diagnostics */}
        <div className="grid-column">
          <div className="dashboard-card ai-card cockpit-ai">
            <div className="card-header">
              <svg className="card-icon glow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
                <circle cx="12" cy="12" r="4"></circle>
              </svg>
              <h2>Gemini AIOps Intelligent Diagnostics</h2>
            </div>

            <div className="template-bar">
              <span className="bar-label">Incorporate Template:</span>
              <div className="template-buttons">
                <button type="button" className="btn-tab" onClick={() => loadTemplate('kubernetes')}>K8s OOM</button>
                <button type="button" className="btn-tab" onClick={() => loadTemplate('terraform')}>TF S3</button>
                <button type="button" className="btn-tab" onClick={() => loadTemplate('jenkins')}>Jenkins</button>
                <button type="button" className="btn-tab" onClick={() => loadTemplate('prometheus')}>Latency</button>
              </div>
            </div>

            <div className="ai-control-group">
              <div className="input-row-flex">
                <div className="input-group inline-group select-compact">
                  <label>Context Parameter</label>
                  <select value={contextType} onChange={(e) => setContextType(e.target.value)}>
                    <option value="logs">Logs Analyzer</option>
                    <option value="kubernetes">Kubernetes Node</option>
                    <option value="terraform">IaC Terraform</option>
                    <option value="metrics">Prometheus Metrics</option>
                  </select>
                </div>
                <button 
                  type="button" 
                  className="btn-ai" 
                  onClick={handleAnalyze} 
                  disabled={aiLoading || !logInput.trim()}
                >
                  {aiLoading ? 'Running diagnostics...' : 'Run Gemini AI Diagnostics'}
                </button>
              </div>
              
              <div className="input-group text-compact">
                <textarea
                  placeholder="Paste error logs, YAML configuration files, or metrics dump..."
                  value={logInput}
                  onChange={(e) => setLogInput(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            {aiError && (
              <div className="alert alert-error">
                <strong>Error:</strong> {aiError}
              </div>
            )}

            {aiStreamingText && (
              <div className="ai-output-container cockpit-output flex-grow-output">
                <div className="output-header">
                  <span className="output-title">🤖 Gemini Diagnostic Report</span>
                  {aiModel && <span className="model-badge">{aiModel}</span>}
                </div>
                <div className="output-content">
                  {renderMarkdown(aiStreamingText)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column Middle: PG database coordinator */}
        <div className="grid-column">
          <div className="dashboard-card db-card compact-card">
            <div className="card-header">
              <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
              </svg>
              <h2>PostgreSQL Task Coordinator (CRUD)</h2>
            </div>
            
            {dbError && (
              <div className="alert alert-error">
                <strong>DB Error:</strong> {dbError}
                <button className="btn-retry" onClick={fetchDbItems}>Retry</button>
              </div>
            )}

            <form onSubmit={handleAddItem} className="db-form-compact">
              <div className="form-fields-grid">
                <input 
                  type="text" 
                  placeholder="Define task..." 
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  required
                />
                <select value={newItemAssignee} onChange={(e) => setNewItemAssignee(e.target.value)}>
                  <option value="Humesh">Humesh</option>
                  <option value="Alice">Alice</option>
                  <option value="Bob">Bob</option>
                  <option value="Charlie">Charlie</option>
                </select>
                <select value={newItemPriority} onChange={(e) => setNewItemPriority(e.target.value)}>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <button type="submit" className="btn-primary" disabled={dbLoading}>Add</button>
              </div>
            </form>

            <div className="items-list-container scrollable-panel-content">
              <ul className="items-list compact-list">
                {dbLoading && <div className="spinner-small"></div>}
                {!dbLoading && dbItems.length === 0 && (
                  <p className="no-items-text">No action items found in local database.</p>
                )}
                {dbItems.map((item) => {
                  const meta = parseDescription(item.description);
                  return (
                    <li key={item.id} className="item-row compact-row">
                      <div className="item-main">
                        <span className="item-name">{item.name}</span>
                        <div className="item-meta-tags">
                          <span className="tag-assignee">👤 {meta.assignee}</span>
                          <span className={`tag-priority priority-${meta.priority.toLowerCase()}`}>
                            {meta.priority}
                          </span>
                        </div>
                      </div>
                      <button 
                        className="btn-delete-task" 
                        onClick={() => handleDeleteItem(item.id)} 
                        title="Remove task from DB"
                      >
                        ✓ Done
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Column Right: CVE Compliance Scan */}
        <div className="grid-column">
          <div className="dashboard-card security-cve-card">
            <div className="card-header">
              <svg className="card-icon color-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <h2>CVE Security Audit & Compliance</h2>
            </div>
            <div className="security-dashboard-content scrollable-panel-content">
              <div className="security-scan-header">
                <div className="scan-timestamp-group">
                  <span className="sec-lbl">Last Trivy Audit:</span>
                  <span className="sec-val">{lastCveScanTime}</span>
                </div>
                <button 
                  className={`btn-tab btn-sec-scan ${isCveScanning ? 'scanning' : ''}`}
                  onClick={handleTriggerCveScan}
                  disabled={isCveScanning}
                >
                  {isCveScanning ? 'Auditing...' : '🛡 Run CVE Audit'}
                </button>
              </div>

              <div className="cve-grid-counts">
                <div className="cve-box critical">
                  <span className="cve-num">{cveCounts.critical}</span>
                  <span className="cve-lbl">Critical</span>
                </div>
                <div className="cve-box high">
                  <span className="cve-num">{cveCounts.high}</span>
                  <span className="cve-lbl">High</span>
                </div>
                <div className="cve-box medium">
                  <span className="cve-num">{cveCounts.medium}</span>
                  <span className="cve-lbl">Medium</span>
                </div>
                <div className="cve-box low">
                  <span className="cve-num">{cveCounts.low}</span>
                  <span className="cve-lbl">Low</span>
                </div>
              </div>

              <div className="compliance-progress-bar">
                <div className="progress-label-row">
                  <span>Quality Gate: <strong>PASSED</strong></span>
                  <span>92.4% Coverage</span>
                </div>
                <div className="sec-progress-track">
                  <div className="sec-progress-fill" style={{ width: '92.4%' }}></div>
                </div>
              </div>

              <div className="security-warnings-list" style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#8b949e', margin: '0 0 10px 0', textAlign: 'left' }}>
                  Critical & High Severity CVE Details
                </h4>
                <div className="cve-warnings-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="cve-warning-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.15)', borderRadius: '4px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 'bold', color: '#f43f5e' }}>CVE-2026-0182</span>
                    <span style={{ color: '#8b949e' }}>glibc buffer overflow (patched)</span>
                    <span className="status-badge status-pill synced" style={{ fontSize: '9px', padding: '2px 4px' }}>FIXED</span>
                  </div>
                  <div className="cve-warning-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(251, 146, 60, 0.05)', border: '1px solid rgba(251, 146, 60, 0.15)', borderRadius: '4px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-orange)' }}>CVE-2026-3849</span>
                    <span style={{ color: '#8b949e' }}>python-pillow vulnerability</span>
                    <span className="status-badge status-pill error" style={{ fontSize: '9px', padding: '2px 4px' }}>OPEN</span>
                  </div>
                  <div className="cve-warning-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(251, 146, 60, 0.05)', border: '1px solid rgba(251, 146, 60, 0.15)', borderRadius: '4px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-orange)' }}>CVE-2026-1192</span>
                    <span style={{ color: '#8b949e' }}>npm json-schema vuln</span>
                    <span className="status-badge status-pill error" style={{ fontSize: '9px', padding: '2px 4px' }}>OPEN</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Shared component helper for stage node graph
  const renderPipelineGraph = () => {
    return (
      <div className="flow-visualizer-card">
        <div className="flow-titlebar">
          <div className="flow-titlebar-left">
            <div className="pulse-indicator pulse-purple"></div>
            <h3>DevOps Lifecycle Pipeline Graph</h3>
          </div>
          <div className="flow-titlebar-right">
            <button 
              className={`btn-primary btn-run-pipeline ${isSimulatingPipeline ? 'running' : ''}`}
              onClick={handleTriggerPipelineRun}
              disabled={isSimulatingPipeline}
            >
              {isSimulatingPipeline ? 'Pipeline Running...' : '⚡ Simulate Full Pipeline Run'}
            </button>
            <span className="flow-hint">Current Inspector Node: <strong>{selectedStage.label}</strong></span>
          </div>
        </div>
        
        <div className="flow-nodes-wrapper">
          <div className="flow-nodes-container">
            {stagesList.map((stage, index) => {
              const isSelected = selectedStage.id === stage.id;
              const isLast = index === stagesList.length - 1;
              return (
                <div key={stage.id} className="flow-node-pair">
                  <div 
                    className={`flow-node ${isSelected ? 'selected' : ''} ${stage.status}`}
                    style={{ '--node-color': stage.color }}
                    onClick={() => handleStageClick(stage)}
                  >
                    <div className="node-icon-placeholder">
                      {stage.status === 'completed' && <span className="icon-check">✓</span>}
                      {stage.status === 'active' && <span className="icon-pulse"></span>}
                      {stage.status === 'idle' && <span className="icon-dots">⋯</span>}
                    </div>
                    <div className="node-info">
                      <span className="node-label">{stage.label}</span>
                      <span className="node-desc">{stage.desc}</span>
                    </div>
                  </div>
                  {!isLast && (
                    <svg className="flow-connector" width="40" height="24">
                      <line 
                        x1="0" 
                        y1="12" 
                        x2="40" 
                        y2="12" 
                        stroke={stage.status === 'completed' ? 'var(--accent-green)' : stage.status === 'active' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.08)'} 
                        strokeWidth="3" 
                        strokeDasharray={stage.status === 'active' ? '5,5' : 'none'}
                        className={stage.status === 'active' ? 'dash-pulse' : ''}
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container cockpit-view sidebar-layout-active">
      
      {/* Permanent Left Sidebar Header */}
      <aside className="sidebar-nav">
        <div className="sidebar-brand">
          <div className="pulse-indicator"></div>
          <div className="brand-text">
            <h2>OMEGA</h2>
            <span className="brand-sub">DevOps Cockpit</span>
          </div>
        </div>
        
        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} 
            onClick={() => setActiveTab('overview')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Dashboard Overview</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'pipeline' ? 'active' : ''}`} 
            onClick={() => setActiveTab('pipeline')}
          >
            <span className="nav-icon">🔄</span>
            <span className="nav-text">CI/CD Pipeline</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'mesh' ? 'active' : ''}`} 
            onClick={() => setActiveTab('mesh')}
          >
            <span className="nav-icon">🌐</span>
            <span className="nav-text">Cluster & Mesh</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'aiops' ? 'active' : ''}`} 
            onClick={() => setActiveTab('aiops')}
          >
            <span className="nav-icon">🤖</span>
            <span className="nav-text">AIOps & Tasks</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="footer-status-row">
            <span className="dot-blink"></span>
            <span className="footer-status-txt">Cluster: ONLINE</span>
          </div>
          <div className="footer-status-row">
            <span className="tag-assignee">v1.3 Compose</span>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="main-content-view">
        
        {/* Top Header */}
        <header className="app-header">
          <div className="header-brand">
            <span className="badge">v1.3 Enterprise View</span>
            <span className="active-section-label">➔ {activeTab.toUpperCase()}</span>
          </div>
          
          {/* Global Live Dashboard Metrics */}
          <div className="global-metrics-strip">
            <div className="metric-box">
              <span className="m-label">Cluster CPU</span>
              <span className="m-val">{cpuLoad}%</span>
              <div className="mini-progress"><div className="mini-bar purple-bar" style={{ width: `${cpuLoad}%` }}></div></div>
            </div>
            <div className="metric-box">
              <span className="m-label">Cluster RAM</span>
              <span className="m-val">{memLoad}%</span>
              <div className="mini-progress"><div className="mini-bar blue-bar" style={{ width: `${memLoad}%` }}></div></div>
            </div>
            <div className="metric-box font-mono-box">
              <span className="m-label">Throughput</span>
              <span className="m-val green-text">{reqRate}/s</span>
            </div>
            <div className="metric-box font-mono-box">
              <span className="m-label">Failure Rate</span>
              <span className={`m-val ${(errorRate * 100) > 4 ? 'red-text' : (errorRate * 100) > 1.5 ? 'orange-text' : 'green-text'}`}>
                {(errorRate * 100).toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="system-status">
            <span className="status-label">Env:</span>
            <span className="status-val k8s-text">Compose Local</span>
          </div>
        </header>

        {/* Dynamic Tab Contents */}
        <div className="tab-content-container">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'pipeline' && renderPipelineTab()}
          {activeTab === 'mesh' && renderMeshTab()}
          {activeTab === 'aiops' && renderAiopsTab()}
        </div>

        {/* Footer */}
        <footer className="app-footer">
          <p>© 2026 Omega DevOps Framework. Powered by Google Gemini and enterprise local microservices.</p>
        </footer>
      </main>

      {/* Pod Logs Events Stream Slide-out Drawer */}
      <div className={`pod-drawer-overlay ${isPodDrawerOpen ? 'open' : ''}`} onClick={() => setIsPodDrawerOpen(false)}>
        <div className="pod-drawer-content" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-header">
            <div className="drawer-header-left">
              <span className="drawer-pulse"></span>
              <h3>Live Container Console Stream: <code>{selectedPod}</code></h3>
            </div>
            <button className="btn-close-drawer" onClick={() => setIsPodDrawerOpen(false)}>✕ Close Terminal</button>
          </div>
          <div className="drawer-body">
            <pre className="drawer-terminal-logs">
              {podLogs.map((log, index) => (
                <div key={index} className="log-line">{log}</div>
              ))}
              <div ref={podLogEndRef} />
            </pre>
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
