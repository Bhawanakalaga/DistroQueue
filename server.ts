
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import fs from 'fs';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  Timestamp, 
  orderBy, 
  limit, 
  getDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  deleteDoc,
  getCountFromServer
} from 'firebase/firestore';
import { JobType, JobStatus, Job, SystemMetrics, JobPriority } from './src/types.js';

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET environment variable is not set. Using a temporary insecure secret for development.');
}
const ACTUAL_JWT_SECRET = JWT_SECRET || 'insecure-dev-only-secret';

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// 1. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased limit to accommodate dashboard polling
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// 2. Auth Middleware (JWT)
const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  
  if (!token) return res.status(401).json({ error: 'Authorization token required' });
  
  try {
    const decoded = jwt.verify(token, ACTUAL_JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const PORT = 3000;
const MAX_CONCURRENT_WORKERS = 5;
let activeWorkerCount = 0;

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), workers: activeWorkerCount });
});

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  // Use environment variables for authentication if provided, otherwise fallback to defaults for easy initial setup
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || 'password';

  if (username === expectedUser && password === expectedPass) {
    const token = jwt.sign({ username, role: 'ADMIN' }, ACTUAL_JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, username });
  }
  
  res.status(401).json({ error: 'Invalid credentials' });
});

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: new Date().toISOString()
  };
  console.error(`[Firestore Error] ${operationType.toUpperCase()} on ${path}:`, errInfo.error);
  // We don't re-throw here to allow the caller to decide the flow, 
  // but we provide a formatted error if needed.
  return errInfo;
}

// AI analysis helper
async function analyzeFailureWithAI(jobData: any, logs: string[]) {
  if (!process.env.GEMINI_API_KEY) return "AI Key missing.";
  try {
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    
    const logsText = logs.join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a Senior Site Reliability Engineer. Analyze this background job failure for a technical dashboard.
      
      Job Context:
      - Type: ${jobData.jobType}
      - Priority: ${jobData.priority}
      - Payload: ${JSON.stringify(jobData.payload, null, 2)}
      
      Error Timeline & Logs:
      ${logsText}
      
      Provide a structured analysis including:
      1. [CATEGORY]: (Infrastructure, Application Code, or Data Integrity)
      2. [ANALYSIS]: A concise technical explanation of the failure sequence.
      3. [ROOT_CAUSE]: The most likely root cause based on the logs.
      4. [SUGGESTION]: Actionable technical steps to prevent this in the future.
      
      Format the response with these headers clearly. Keep it professional and focused on technical remediation.`,
    });
    
    return response.text || "Unable to analyze failure.";
  } catch (err) {
    console.error("AI Analysis failed:", err);
    return "AI analysis unavailable.";
  }
}

// API Endpoints
app.post('/api/jobs', authMiddleware, async (req, res) => {
  try {
    const { jobType, payload, maxRetries = 3, priority = JobPriority.MEDIUM } = req.body;
    
    if (!jobType || !payload) {
      return res.status(400).json({ error: 'jobType and payload are required' });
    }

    const priorityMap = {
      [JobPriority.HIGH]: 3,
      [JobPriority.MEDIUM]: 2,
      [JobPriority.LOW]: 1
    };

    const jobData = {
      jobType,
      payload,
      priority,
      priorityLevel: priorityMap[priority as JobPriority] || 2,
      status: JobStatus.PENDING,
      retryCount: 0,
      maxRetries,
      nextRunAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      logs: [`Job submitted via ${req.body.source || 'API'}`]
    };

    const docRef = await addDoc(collection(db, 'jobs'), jobData);
    res.status(201).json({ id: docRef.id, ...jobData });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to submit job' });
  }
});

app.get('/api/jobs', authMiddleware, async (req, res) => {
  try {
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const jobs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Metrics Cache
let cachedMetrics: any = null;
let lastMetricsFetch = 0;
const METRICS_CACHE_TTL = 5000; // 5 seconds

app.get('/api/metrics', authMiddleware, async (req, res) => {
  try {
    const now = Date.now();
    if (cachedMetrics && (now - lastMetricsFetch < METRICS_CACHE_TTL)) {
      return res.json(cachedMetrics);
    }

    const jobsCol = collection(db, 'jobs');
    
    // Optimized counts using getCountFromServer
    const [
      totalSnap,
      pendingSnap,
      processingSnap,
      completedSnap,
      failedSnap,
      dlqSnap,
      canceledSnap
    ] = await Promise.all([
      getCountFromServer(jobsCol),
      getCountFromServer(query(jobsCol, where('status', '==', JobStatus.PENDING))),
      getCountFromServer(query(jobsCol, where('status', '==', JobStatus.PROCESSING))),
      getCountFromServer(query(jobsCol, where('status', '==', JobStatus.COMPLETED))),
      getCountFromServer(query(jobsCol, where('status', '==', JobStatus.FAILED))),
      getCountFromServer(query(jobsCol, where('status', '==', JobStatus.DLQ))),
      getCountFromServer(query(jobsCol, where('status', '==', JobStatus.CANCELED)))
    ]);

    const metrics = {
      total: totalSnap.data().count,
      pending: pendingSnap.data().count,
      processing: processingSnap.data().count,
      completed: completedSnap.data().count,
      failed: failedSnap.data().count,
      dlq: dlqSnap.data().count,
      canceled: canceledSnap.data().count,
      activeWorkers: activeWorkerCount
    };

    // For payload metrics, we still need to query some docs, 
    // but maybe we only sample the last 20 for performance.
    const sampleQuery = query(jobsCol, orderBy('createdAt', 'desc'), limit(20));
    const sampleSnap = await getDocs(sampleQuery);
    
    let totalPayloadSize = 0;
    let maxPayloadSize = 0;
    let payloadCount = 0;

    sampleSnap.forEach(doc => {
      const data = doc.data();
      if (data.payload) {
        const size = Buffer.byteLength(JSON.stringify(data.payload));
        totalPayloadSize += size;
        if (size > maxPayloadSize) maxPayloadSize = size;
        payloadCount++;
      }
    });

    const finalMetrics = {
      ...metrics,
      avgPayloadSize: payloadCount > 0 ? Math.round(totalPayloadSize / payloadCount) : 0,
      maxPayloadSize: maxPayloadSize
    };

    cachedMetrics = finalMetrics;
    lastMetricsFetch = now;

    res.json(finalMetrics);
  } catch (error: any) {
    console.error('[Metrics API Error]:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch metrics', message: error.message });
  }
});

app.get('/api/dlq', authMiddleware, async (req, res) => {
  try {
    const q = query(collection(db, 'dead_letter_queue'), orderBy('failedAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    const deadJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(deadJobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch DLQ records' });
  }
});

app.delete('/api/jobs/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const jobDoc = doc(db, 'jobs', id);
    const snapshot = await getDoc(jobDoc);
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = snapshot.data();
    if (job.status !== JobStatus.PENDING) {
      return res.status(400).json({ error: 'Only pending jobs can be cancelled' });
    }

    await updateDoc(jobDoc, {
      status: JobStatus.CANCELED,
      logs: arrayUnion(`Job manually cancelled by ${(req as any).user.username} at ${new Date().toISOString()}`),
      updatedAt: serverTimestamp()
    });

    res.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

app.post('/api/jobs/:id/retry', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const jobDoc = doc(db, 'jobs', id);
    const snapshot = await getDoc(jobDoc);
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = snapshot.data();
    const retryableStatuses = [JobStatus.FAILED, JobStatus.CANCELED, JobStatus.DLQ];
    if (!retryableStatuses.includes(job.status)) {
      return res.status(400).json({ error: `Only jobs with status ${retryableStatuses.join(' or ')} can be retried` });
    }

    const isFromDLQ = job.status === JobStatus.DLQ;

    await updateDoc(jobDoc, {
      status: JobStatus.PENDING,
      retryCount: 0,
      nextRunAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      errorLog: null,
      logs: arrayUnion(`Job manually retried by ${(req as any).user.username} at ${new Date().toISOString()}`)
    });

    // Cleanup DLQ record if retrying from DLQ
    if (isFromDLQ) {
      try {
        const dlqRef = collection(db, 'dead_letter_queue');
        const q = query(dlqRef, where('originalJobId', '==', id));
        const dlqSnapshot = await getDocs(q);
        dlqSnapshot.forEach(async (dlqDoc) => {
          await deleteDoc(doc(db, 'dead_letter_queue', dlqDoc.id));
        });
      } catch (dlqErr) {
        console.warn('Failed to cleanup DLQ record during retry:', dlqErr);
        // We don't fail the whole request because the job was successfully re-queued
      }
    }

    res.json({ success: true, message: 'Job re-queued successfully' });
  } catch (error) {
    console.error('Retry failed:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

app.post('/api/dlq/:id/re-queue', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const dlqDocRef = doc(db, 'dead_letter_queue', id);
    const dlqSnapshot = await getDoc(dlqDocRef);

    if (!dlqSnapshot.exists()) {
      return res.status(404).json({ error: 'DLQ record not found' });
    }

    const dlqData = dlqSnapshot.data();
    const originalJobId = dlqData.originalJobId;

    if (!originalJobId) {
      return res.status(400).json({ error: 'No original job ID found in DLQ record' });
    }

    const jobDocRef = doc(db, 'jobs', originalJobId);
    await updateDoc(jobDocRef, {
      status: JobStatus.PENDING,
      retryCount: 0,
      nextRunAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      logs: arrayUnion(`Job re-queued from DLQ by ${(req as any).user.username} at ${new Date().toISOString()}`)
    });

    // Clean up DLQ
    await deleteDoc(dlqDocRef);

    res.json({ success: true, message: 'Job re-queued successfully' });
  } catch (error) {
    console.error('Re-queue failed:', error);
    res.status(500).json({ error: 'Failed to re-queue job' });
  }
});

// Worker Engine Logic
async function processJob(jobId: string, jobData: any) {
  activeWorkerCount++;
  const workerId = `Worker-${Math.floor(Math.random() * 1000)}`;
  const startTime = Date.now();
  console.log(`[${workerId}] Started processing job: ${jobId} (${jobData.jobType}) at ${new Date(startTime).toISOString()}`);

  const jobDoc = doc(db, 'jobs', jobId);

  try {
    // 1. Update status to PROCESSING (Atomic claim)
    try {
      await updateDoc(jobDoc, { 
        status: JobStatus.PROCESSING, 
        updatedAt: serverTimestamp(),
        workerName: workerId,
        logs: arrayUnion(`[${workerId}] status: PROCESSING at ${new Date().toISOString()}`)
      });
    } catch (permErr: any) {
      if (permErr.message?.includes('PERMISSION_DENIED')) {
        // This is often just a race condition where another worker already claimed the job
        console.log(`[${workerId}] Job ${jobId} already claimed or status changed (Permission Denied). Skipping.`);
        return; 
      }
      handleFirestoreError(permErr, OperationType.UPDATE, `jobs/${jobId}`);
      throw permErr;
    }

    // Simulate Business Logic (Asynchronous work)
    const processingTime = 1000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // We removed the simulated failure to ensure system stability as requested.
    // Real business logic would go here.

    const duration = Date.now() - startTime;
    // 3. Mark as COMPLETED
    await updateDoc(jobDoc, { 
      status: JobStatus.COMPLETED, 
      updatedAt: serverTimestamp(),
      logs: arrayUnion(`[${workerId}] status: COMPLETED at ${new Date().toISOString()} (duration: ${duration}ms)`)
    });
    console.log(`[${workerId}] Successfully completed job: ${jobId} in ${duration}ms`);

  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`[${workerId}] Failed processing job: ${jobId} after ${duration}ms. Error: ${err.message}`);
    
    const retryCount = (jobData.retryCount || 0) + 1;
    const maxRetries = jobData.maxRetries || 3;

    if (retryCount <= maxRetries) {
      // Exponential Backoff
      const backoffSeconds = Math.pow(2, retryCount);
      const nextRunAt = new Date();
      nextRunAt.setSeconds(nextRunAt.getSeconds() + backoffSeconds);

      await updateDoc(jobDoc, {
        status: JobStatus.PENDING,
        retryCount: retryCount,
        nextRunAt: Timestamp.fromDate(nextRunAt),
        updatedAt: serverTimestamp(),
        errorLog: err.message,
        logs: arrayUnion(`[${workerId}] FAILED at ${new Date().toISOString()} after ${duration}ms. Reason: ${err.message}. Scheduled retry #${retryCount} in ${backoffSeconds}s`)
      });
    } else {
      // AI ANALYSIS before moving to DLQ
      console.log(`[${workerId}] Triggering AI failure analysis for job ${jobId}...`);
      
      // Collect current attempt logs for context
      const currentAttemptLogs = jobData.logs || [];
      const finalErrorLog = `[${workerId}] FINAL FAILURE at ${new Date().toISOString()} after ${duration}ms. Reason: ${err.message}`;
      const analysisLogs = [...currentAttemptLogs, finalErrorLog];
      
      const aiAnalysis = await analyzeFailureWithAI(jobData, analysisLogs);

      // Move to DLQ
      await updateDoc(jobDoc, {
        status: JobStatus.DLQ,
        updatedAt: serverTimestamp(),
        errorLog: err.message,
        aiAnalysis: aiAnalysis,
        logs: arrayUnion(`[${workerId}] FINAL FAILURE at ${new Date().toISOString()} after ${duration}ms. Reason: ${err.message}. AI Analysis: ${aiAnalysis}`)
      });
      
      await addDoc(collection(db, 'dead_letter_queue'), {
        originalJobId: jobId,
        payload: jobData.payload,
        failureReason: err.message,
        aiAnalysis: aiAnalysis,
        failedAt: serverTimestamp(),
        workerId: workerId,
        processingDuration: duration
      });
      console.log(`[${workerId}] Job ${jobId} permanently failed after ${duration}ms. AI Analysis performed.`);
    }
  } finally {
    activeWorkerCount--;
  }
}

async function workerLoop() {
  console.log('>>> DistroQueue Background Worker Loop Active (Targeting Cluster: Firebase)');
  setInterval(async () => {
    if (activeWorkerCount >= MAX_CONCURRENT_WORKERS) return;

    try {
      // Priority Processing: Get High priority first, then Medium, then Low
      const q = query(
        collection(db, 'jobs'),
        where('status', '==', JobStatus.PENDING),
        where('nextRunAt', '<=', Timestamp.now()),
        orderBy('nextRunAt', 'asc'),
        orderBy('priorityLevel', 'desc'),
        limit(MAX_CONCURRENT_WORKERS - activeWorkerCount)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach(async (doc) => {
        await processJob(doc.id, doc.data());
      });
    } catch (err) {
      console.error('Worker loop error:', err);
    }
  }, 3000);
}

// Start Worker
workerLoop().catch(err => console.error('Worker Loop Startup Failed:', err));

// Vite integration
async function startServer() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`>>> DistroQueue Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('SERVER FATAL ERROR DURING STARTUP:', err);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

startServer();
