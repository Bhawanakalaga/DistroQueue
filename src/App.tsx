import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import { 
  Activity, CheckCircle, AlertCircle, Clock, Database, 
  Plus, RefreshCcw, Shield, Terminal, ArrowUpRight,
  Cpu, Zap, Layers, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, query, orderBy, limit 
} from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { JobType, JobStatus, Job, JobPriority } from './types.ts';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase Client
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('distro_auth_token'));
  const [selectedJobType, setSelectedJobType] = useState<JobType>(JobType.EMAIL);
  const [selectedPriority, setSelectedPriority] = useState<JobPriority>(JobPriority.MEDIUM);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'DLQ'>('LEDGER');
  const [dlqJobs, setDlqJobs] = useState<any[]>([]);

  const fetchDlq = async () => {
    if (!authToken || activeTab !== 'DLQ') return;
    try {
      const res = await fetch('/api/dlq', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      setDlqJobs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const login = async () => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('distro_auth_token', data.token);
        setAuthToken(data.token);
      } else {
        alert('Invalid credentials');
      }
    } catch (err) {
      console.error('Login failed', err);
      alert('Login connection error');
    }
  };

  useEffect(() => {
    if (!authToken) return;

    // 1. Listen for real-time job updates
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeJobs = onSnapshot(q, (snapshot) => {
      const jobsList = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: (doc.data() as any).createdAt?.toDate(),
        updatedAt: (doc.data() as any).updatedAt?.toDate(),
        nextRunAt: (doc.data() as any).nextRunAt?.toDate()
      })) as any[];
      setJobs(jobsList);
      setLoading(false);
    }, (err) => {
       if (err.message.includes('permission-denied')) {
         console.warn('Permission denied for Firestore listener. Might need login.');
       }
    });

    // 2. Fetch metrics
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.status === 401) {
          setAuthToken(null);
          localStorage.removeItem('distro_auth_token');
          return;
        }
        if (!res.ok) {
          const text = await res.text();
          console.error('Metrics fetch failed:', text);
          return;
        }
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to fetch metrics', err);
      }
    };

    fetchMetrics();
    const metricsInterval = setInterval(fetchMetrics, 10000);

    return () => {
      unsubscribeJobs();
      clearInterval(metricsInterval);
    };
  }, [authToken]);

  useEffect(() => {
    if (activeTab === 'DLQ' && authToken) fetchDlq();
  }, [activeTab, authToken]);

  const submitJob = async (type: JobType) => {
    if (!authToken) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          jobType: type,
          priority: selectedPriority,
          payload: { timestamp: new Date().toISOString(), source: 'Dashboard' },
          maxRetries: 3
        })
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!authToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative">
        <div className="technical-grid" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 border border-zinc-900/10 bg-white rounded-2xl shadow-2xl max-w-sm w-full text-center"
        >
          <div className="w-16 h-16 bg-zinc-900 mx-auto rounded-xl flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold mb-2">ACCESS TERMINAL</h1>
          <p className="text-xs text-zinc-500 mb-6 font-mono uppercase tracking-widest">Credentials Required</p>
          
          <div className="space-y-4 mb-8 text-left">
            <div>
              <label className="text-[10px] font-bold uppercase opacity-50 block mb-1">Operator Identity</label>
              <input 
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-900/10 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase opacity-50 block mb-1">Security Key</label>
              <input 
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-900/10 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

          <button 
            onClick={login}
            className="w-full bg-zinc-900 text-white py-3 rounded-lg font-bold text-sm tracking-widest hover:bg-zinc-800 transition-colors"
          >
            ESTABLISH SESSION
          </button>
        </motion.div>
      </div>
    );
  }

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.COMPLETED: return 'text-green-600';
      case JobStatus.PROCESSING: return 'text-blue-500 animate-pulse';
      case JobStatus.FAILED: return 'text-orange-500';
      case JobStatus.DLQ: return 'text-red-600';
      case JobStatus.PENDING: return 'text-zinc-400';
      case JobStatus.CANCELED: return 'text-zinc-500 line-through opacity-50';
      default: return 'text-zinc-500';
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const chartData = metrics ? [
    { name: 'Pending', value: metrics.pending },
    { name: 'Processing', value: metrics.processing },
    { name: 'Completed', value: metrics.completed },
    { name: 'Failed', value: metrics.failed },
    { name: 'DLQ', value: metrics.dlq },
    { name: 'Canceled', value: metrics.canceled || 0 },
  ] : [];

  return (
    <div className="min-h-screen relative font-sans selection:bg-zinc-900 selection:text-white pb-20">
      <div className="technical-grid" />
      
      {/* Navigation / Header */}
      <nav className="border-b border-zinc-900/10 bg-zinc-50/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 flex items-center justify-center rounded">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">DISTRO<span className="font-light opacity-50">QUEUE</span></h1>
              <div className="text-[10px] uppercase tracking-widest font-mono opacity-50 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> High-Throughput Distributed Engine
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-900">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              SYSTEM OPERATIONAL
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar / Controls */}
        <aside className="lg:col-span-3 space-y-8">
          <section>
            <h2 className="col-header mb-4 text-orange-500 flex items-center gap-2">
              <Plus className="w-3 h-3" /> Execution Gate
            </h2>
            
            <div className="space-y-4 p-4 border border-zinc-900/10 rounded-xl bg-white shadow-sm">
              <div>
                <label className="text-[10px] font-bold uppercase opacity-50 block mb-2">1. Select Job Type</label>
                <select 
                  value={selectedJobType}
                  onChange={(e) => setSelectedJobType(e.target.value as JobType)}
                  className="w-full bg-zinc-50 border border-zinc-900/10 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  {Object.values(JobType).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase opacity-50 block mb-2">2. Priority Multiplier</label>
                <div className="flex gap-1 p-1 bg-zinc-100 rounded-lg">
                  {Object.values(JobPriority).map(p => (
                    <button
                      key={p}
                      onClick={() => setSelectedPriority(p)}
                      className={`flex-1 py-1.5 text-[9px] font-bold rounded-md transition-all ${
                        selectedPriority === p ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => submitJob(selectedJobType)}
                disabled={isSubmitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-bold text-[10px] tracking-widest transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <RefreshCcw className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                SUBMIT JOB TO CLUSTER
              </button>
              
              <div className="text-[9px] text-zinc-400 text-center font-mono italic">
                {isSubmitting ? 'Transmitting payload...' : 'Ready for ingestion'}
              </div>
            </div>
          </section>

          <section className="p-4 border border-zinc-900/10 rounded-xl bg-zinc-100/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 opacity-50" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-50">Cluster Health</h3>
              </div>
              <button onClick={() => { localStorage.removeItem('distro_auth_token'); setAuthToken(null); }} className="text-[8px] underline opacity-50 hover:opacity-100">LOGOUT</button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-50">Active Workers</span>
                <span className="font-mono">{metrics?.activeWorkers || 0} / 5</span>
              </div>
              <div className="w-full bg-zinc-200 h-1 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-zinc-900 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((metrics?.activeWorkers || 0) / 5) * 100}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs pt-2">
                <span className="opacity-50">Throughput</span>
                <span className="font-mono text-green-600">842 ops/s</span>
              </div>
            </div>
          </section>
        </aside>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-12">
          
          {/* Metrics Visualization */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label="TOTAL JOBS" value={metrics?.total || 0} icon={<Database className="w-4 h-4" />} />
            <MetricCard label="COMPLETED" value={metrics?.completed || 0} icon={<CheckCircle className="w-4 h-4 text-green-600" />} />
            <MetricCard label="DLQ STORAGE" value={metrics?.dlq || 0} icon={<Trash2 className="w-4 h-4 text-red-600" />} />
            <MetricCard label="LATENCY (AVG)" value="1.2s" icon={<Clock className="w-4 h-4" />} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard 
              label="AVG PAYLOAD SIZE" 
              value={formatBytes(metrics?.avgPayloadSize || 0)} 
              icon={<Layers className="w-4 h-4 opacity-50" />} 
            />
            <MetricCard 
              label="MAX PAYLOAD SIZE" 
              value={formatBytes(metrics?.maxPayloadSize || 0)} 
              icon={<Zap className="w-4 h-4 text-orange-500" />} 
            />
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 border border-zinc-900/10 rounded-2xl bg-white shadow-sm">
              <h3 className="col-header mb-6">Distribution State</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#141414', opacity: 0.5}} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#141414', opacity: 0.5}} 
                    />
                    <Tooltip 
                      cursor={{fill: '#F4F4F5'}}
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 2 ? '#16A34A' : index === 4 ? '#DC2626' : '#141414'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="p-6 border border-zinc-900/10 rounded-2xl bg-white shadow-sm">
              <h3 className="col-header mb-6">Real-time Throughput</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={[
                    { t: 0, v: 400 }, { t: 1, v: 300 }, { t: 2, v: 600 }, { t: 3, v: 500 }, { t: 4, v: 800 }, { t: 5, v: 700 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                    <XAxis hide />
                    <YAxis hide />
                    <Line type="monotone" dataKey="v" stroke="#141414" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Job Queue Table */}
          <section className="bg-white border border-zinc-900/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-900/10 flex items-center justify-between">
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveTab('LEDGER')}
                  className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'LEDGER' ? 'opacity-100' : 'opacity-30 hover:opacity-50'}`}
                >
                  <Terminal className="w-4 h-4" /> Distributed Ledger
                </button>
                <button 
                  onClick={() => setActiveTab('DLQ')}
                  className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'DLQ' ? 'opacity-100' : 'opacity-30 hover:opacity-50'}`}
                >
                  <Trash2 className="w-4 h-4" /> Dead Letter Queue
                </button>
              </div>
              <div className="text-[10px] font-mono opacity-50 uppercase tracking-tighter">
                {activeTab === 'LEDGER' ? 'POLLING CLUSTER...' : 'INSPECTING FAILURES...'}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {activeTab === 'LEDGER' ? (
                  <div className="contents">
                    <div className="grid grid-cols-7 p-4 col-header bg-zinc-50 border-none">
                      <div>JOB ID</div>
                      <div>TYPE</div>
                      <div>PRIORITY</div>
                      <div>STATUS</div>
                      <div>RETRIES</div>
                      <div>WORKER</div>
                      <div className="text-right">UPDATED</div>
                    </div>
                    
                    <div className="divide-y divide-zinc-900/10">
                      <AnimatePresence mode='popLayout'>
                        {jobs.map((job) => (
                          <motion.div 
                            key={job.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="divide-y divide-zinc-900/5"
                          >
                            <div 
                              onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                              className={`grid grid-cols-7 p-4 text-xs font-mono items-center cursor-pointer transition-colors ${
                                expandedJob === job.id ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50'
                              }`}
                            >
                              <div className="truncate pr-4 opacity-50">#{job.id.slice(-8)}</div>
                              <div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold border border-zinc-900/5 ${
                                  expandedJob === job.id ? 'bg-white/10 text-white border-white/20' : 'bg-zinc-100 text-zinc-900'
                                }`}>
                                  {job.jobType}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold ${
                                  job.priority === JobPriority.HIGH ? 'text-orange-500' : 
                                  job.priority === JobPriority.MEDIUM ? 'text-blue-500' : 'text-zinc-400'
                                }`}>
                                  {job.priority}
                                </span>
                                {job.priority === JobPriority.HIGH && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />}
                              </div>
                              <div className={getStatusColor(job.status)}>
                                {job.status}
                              </div>
                              <div className="opacity-70">{job.retryCount} / {job.maxRetries}</div>
                              <div className="opacity-50">{job.workerName || '---'}</div>
                              <div className="text-right opacity-50 flex items-center justify-end gap-1">
                                {job.updatedAt?.toLocaleTimeString() || 'Waiting'}
                                <small className="text-[8px] uppercase">UTC</small>
                              </div>
                            </div>
                            
                            {expandedJob === job.id && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="bg-zinc-100 p-6 border-x border-zinc-900 text-[11px] font-mono shadow-inner"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div>
                                    <div className="flex justify-between items-start mb-4">
                                      <h4 className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2">
                                        <Terminal className="w-3 h-3" /> Execution Log
                                      </h4>
                                      <div className="flex gap-2">
                                        {job.status === JobStatus.PENDING && (
                                          <button 
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (confirm('Cancel this job?')) {
                                                await fetch(`/api/jobs/${job.id}`, { 
                                                  method: 'DELETE',
                                                  headers: { 'Authorization': `Bearer ${authToken}` }
                                                });
                                              }
                                            }}
                                            className="text-red-600 hover:text-red-700 font-bold flex items-center gap-1 text-[9px] uppercase border border-red-200 bg-red-50 px-2 py-1 rounded transition-colors"
                                          >
                                            <AlertCircle className="w-3 h-3" /> Cancel Job
                                          </button>
                                        )}
                                        {[JobStatus.FAILED, JobStatus.CANCELED, JobStatus.DLQ].includes(job.status) && (
                                          <button 
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (confirm('Retry this job?')) {
                                                await fetch(`/api/jobs/${job.id}/retry`, { 
                                                  method: 'POST',
                                                  headers: { 'Authorization': `Bearer ${authToken}` }
                                                });
                                              }
                                            }}
                                            className="text-zinc-900 hover:bg-zinc-900 hover:text-white font-bold flex items-center gap-1 text-[9px] uppercase border border-zinc-900/20 bg-white px-2 py-1 rounded transition-colors"
                                          >
                                            <RefreshCcw className="w-3 h-3" /> Retry Job
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar text-zinc-600">
                                      {job.logs?.map((log: string, i: number) => (
                                        <div key={i} className="flex gap-2">
                                          <span className="opacity-30">[{i+1}]</span>
                                          <span>{log}</span>
                                        </div>
                                      )) || <div className="italic opacity-30">No logs generated.</div>}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-[10px] font-bold uppercase mb-4 opacity-50 flex items-center gap-2">
                                      <Zap className="w-3 h-3 text-orange-500" /> AI Insights
                                    </h4>
                                    {job.aiAnalysis ? (
                                      <div className="bg-white p-4 rounded-lg border border-zinc-900/10 shadow-sm leading-relaxed text-zinc-800 prose prose-sm max-w-none">
                                        <div className="text-orange-600 font-bold mb-3 border-b border-orange-100 pb-1 flex items-center gap-2">
                                          <Shield className="w-3 h-3" /> [TECHNICAL INCIDENT REPORT]
                                        </div>
                                        <div className="markdown-body">
                                          <ReactMarkdown>{job.aiAnalysis}</ReactMarkdown>
                                        </div>
                                      </div>
                                    ) : job.status === JobStatus.DLQ ? (
                                      <div className="animate-pulse flex gap-2 items-center text-zinc-400">
                                        <RefreshCcw className="w-3 h-3 animate-spin" />
                                        GENERATING FAILURE REPORT...
                                      </div>
                                    ) : (
                                      <div className="italic opacity-30">Analytical engine standby. Waiting for terminal failure state.</div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ) : (
                  <div className="contents">
                    <div className="grid grid-cols-6 p-4 col-header bg-zinc-50 border-none">
                      <div>ORIGINAL ID</div>
                      <div>REASON</div>
                      <div>WORKER</div>
                      <div>ELAPSED</div>
                      <div>PAYLOAD</div>
                      <div className="text-right">ACTIONS</div>
                    </div>
                    <div className="divide-y divide-zinc-900/10">
                      {dlqJobs.map((job) => (
                        <div key={job.id} className="grid grid-cols-6 p-4 text-xs font-mono items-center hover:bg-zinc-50">
                          <div className="opacity-50">#{job.originalJobId?.slice(-8)}</div>
                          <div className="text-red-600 truncate pr-4">{job.failureReason}</div>
                          <div className="opacity-70">{job.workerId || '---'}</div>
                          <div className="opacity-50">{job.processingDuration ? `${job.processingDuration}ms` : '---'}</div>
                          <div className="truncate opacity-50 text-[10px] pr-4">{JSON.stringify(job.payload)}</div>
                          <div className="text-right flex justify-end gap-2">
                            <button 
                              onClick={async () => {
                                if (confirm('Re-queue this job?')) {
                                  const res = await fetch(`/api/dlq/${job.id}/re-queue`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${authToken}` }
                                  });
                                  if (res.ok) fetchDlq();
                                }
                              }}
                              className="text-zinc-900 hover:bg-zinc-900 hover:text-white border border-zinc-900/20 px-2 py-1 rounded text-[9px] font-bold uppercase flex items-center gap-1 transition-all"
                            >
                              <RefreshCcw className="w-3 h-3" /> Re-queue
                            </button>
                          </div>
                        </div>
                      ))}
                      {dlqJobs.length === 0 && (
                        <div className="p-12 text-center text-zinc-400 font-mono text-xs italic">
                          Dead Letter Queue is empty.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
          
          {/* System Blueprint - Flow Explanation */}
          <section className="p-8 border border-zinc-900/10 rounded-2xl bg-white shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Layers className="w-40 h-40" />
            </div>
            
            <h3 className="text-sm font-bold uppercase tracking-widest mb-10 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" /> Distributed Architecture Blueprint
            </h3>

            <div className="relative">
              {/* Flow Lines (Hidden on Mobile) */}
              <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-0.5 bg-zinc-100 -z-0" />
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
                <div className="text-center">
                  <div className="w-12 h-12 bg-zinc-900 text-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Terminal className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-[10px] uppercase mb-1">1. Ingestion</div>
                  <div className="text-[10px] opacity-50 px-4">REST API receives unique payload + priority</div>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-[10px] uppercase mb-1">2. Persistence</div>
                  <div className="text-[10px] opacity-50 px-4">Job entered into Distributed Ledger (Firestore)</div>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-orange-500 text-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-[10px] uppercase mb-1">3. Processing</div>
                  <div className="text-[10px] opacity-50 px-4">Priority-aware workers poll & execute concurrently</div>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-green-500 text-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-[10px] uppercase mb-1">4. Terminal State</div>
                  <div className="text-[10px] opacity-50 px-4">Marked Completed or moved to DLQ if max-retry reached</div>
                </div>
              </div>
            </div>

            <div className="mt-12 p-4 bg-zinc-50 rounded-xl border border-dashed border-zinc-900/20">
              <h4 className="text-[10px] font-bold uppercase mb-2 flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-red-500" /> Error Handling Strategy
              </h4>
              <p className="text-[11px] leading-relaxed text-zinc-600">
                The system employs <strong>Exponential Backoff</strong> (Wait Time = 2<sup>RetryCount</sup> seconds). 
                Permanent failures trigger the <strong>AI Analytical Engine</strong> to diagnose root causes before 
                archiving to the Dead-Letter Queue.
              </p>
            </div>
          </section>

          {/* System Guide */}
          <section className="p-8 border border-zinc-900/10 rounded-2xl bg-zinc-50/50">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Operations Manual v1.0
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="font-bold text-xs mb-2">1. INGESTION</div>
                <p className="text-[11px] leading-relaxed opacity-60">
                  Select a job type and priority multiplier from the terminal. High priority jobs bypass standard queue polling latency.
                </p>
              </div>
              <div>
                <div className="font-bold text-xs mb-2">2. MONITORING</div>
                <p className="text-[11px] leading-relaxed opacity-60">
                  Track the Distributed Ledger. Pending jobs are picked up by the next available worker in the cluster.
                </p>
              </div>
              <div>
                <div className="font-bold text-xs mb-2">3. RECOVERY</div>
                <p className="text-[11px] leading-relaxed opacity-60">
                  Failed jobs migrate to the DLQ. AI Analysis provides root-cause diagnosis. Use Re-queue to retry execution.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Persistence Notification */}
      <footer className="fixed bottom-0 w-full bg-zinc-900 text-white py-2 px-6 flex justify-between items-center text-[10px] font-mono tracking-widest z-50 uppercase">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1"><RefreshCcw className="w-2.5 h-2.5" /> AUTO-SYNC ON</div>
          <div className="flex items-center gap-1 opacity-50 hidden md:flex"><CheckCircle className="w-2.5 h-2.5" /> CLOUD STORAGE EMULATED</div>
        </div>
        <div className="flex items-center gap-4">
           <span>DB: FIRESTORE (ENTERPRISE)</span>
           <span>LOC: ASIA-SOUTHEAST1</span>
        </div>
      </footer>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="p-5 border border-zinc-900/10 rounded-2xl bg-white shadow-sm flex flex-col justify-between h-28 relative overflow-hidden group hover:border-zinc-900/30 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{label}</span>
        <div className="opacity-30 group-hover:opacity-100 transition-opacity">{icon}</div>
      </div>
      <div className="text-2xl font-mono tracking-tighter flex items-end justify-between">
        {value}
        <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0" />
      </div>
    </div>
  );
}
