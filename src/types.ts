
export enum JobType {
  EMAIL = 'EMAIL',
  NOTIFICATION = 'NOTIFICATION',
  PAYMENT = 'PAYMENT',
  REPORT = 'REPORT',
  FILE = 'FILE',
}

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DLQ = 'DLQ',
  CANCELED = 'CANCELED',
}

export enum JobPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface Job {
  id: string;
  jobType: JobType;
  priority: JobPriority;
  payload: any;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  nextRunAt: Date;
  createdAt: Date;
  updatedAt: Date;
  errorLog?: string;
  aiAnalysis?: string;
  workerName?: string;
  logs?: string[];
}

export interface DeadLetterJob {
  id: string;
  originalJobId: string;
  payload: any;
  failureReason: string;
  failedAt: Date;
}

export interface SystemMetrics {
  timestamp: Date;
  activeWorkers: number;
  queueSize: number;
  successCount: number;
  failureCount: number;
  throughput: number;
  avgPayloadSize?: number;
  maxPayloadSize?: number;
}
