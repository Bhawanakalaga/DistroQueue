# DISTROQUEUE: Enterprise Distributed Job Processor

High-throughput distributed background job processing system with concurrent workers, exponential backoff retries, and AI-powered failure analysis.

## 📋 Project Overview

### Project Problem Statement
Large-scale applications often encounter performance bottlenecks when executing intensive tasks (such as bulk email dispatching, payment processing, or heavy data transformations) within the main request-response cycle. Synchronous execution leads to poor user experience, frequent timeouts, and potential data loss when systems fail under load or encounter transient network issues.

### Proposed Solution
**DISTROQUEUE** provides a resilient, event-driven architecture that decouples heavy workloads from the user interface. By utilizing a distributed ledger (Firebase Firestore), it coordinates a fleet of workers to handle tasks asynchronously. The system guarantees delivery through smart retry mechanisms and provides operational clarity via an AI-enhanced monitoring terminal.

### Target Users
- **Backend Engineers** looking for a reliable way to offload long-running tasks.
- **DevOps/SRE Teams** requiring deep visibility into background processing health.
- **FinTech & SaaS Platforms** that demand high reliability for critical transactional workflows.

---

## 🚀 Key Features

- **Priority-Aware Queueing**: Smart scheduling that ensures `CRITICAL` and `HIGH` priority jobs bypass lower-priority tasks.
- **Distributed Worker Cluster**: Multi-node support with atomic state transitions to prevent duplicate processing.
- **Intelligent Retry Logic**: Implements **Exponential Backoff** (Wait Time = 2^RetryCount seconds) to gracefully handle temporary outages.
- **AI Analytical Engine**: Leverages Google Gemini to automatically diagnose root causes for jobs that enter the Dead-Letter Queue.
- **Hardened Security**: JWT-based authentication and individual security signatures for all administrative operations.
- **Real-time Metrics Dashboard**: Visualization of throughput, latency, and system health using Recharts.

---

## 🛠 Technology Stack & Methodology

### Technologies
- **Frontend**: React 19, Tailwind CSS 4, Lucide Icons, Recharts (Data Viz)
- **Backend**: Node.js, Express, TypeScript (Strict Mode)
- **Database/Coordination**: Firebase Firestore
- **AI/ML**: Google Gemini Pro API (`@google/genai`)
- **Animations**: Motion (formerly Framer Motion)
- **Security**: JWT (JsonWebToken), Bcrypt-style env-based auth

### Methodology
- **Asynchronous Task Offloading**: Moving blocking logic away from the API entry points.
- **Distributed Locking/State**: Using Firestore atomic transactions to ensure "Exactly Once" (or At-Least-Once) delivery.
- **Observability-Driven Design**: Detailed logging and state tracking for every job lifecycle event.

---

## 📝 Requirements

### Functional Requirements
1. **Job Submission**: API and UI interfaces to enqueue jobs with custom JSON payloads.
2. **Priority Control**: Support for HIGH, MEDIUM, and LOW priority tiers.
3. **Worker Management**: Dynamic scaling and tracking of active worker nodes.
4. **Failure Management**: Automatic transition of failing jobs to `FAILED` and eventually `DLQ` (Dead Letter Queue).
5. **AI Report Generation**: Automated generation of root-cause analysis for any job failing permanently.

### Non-Functional Requirements
1. **Resilience**: The system must recover from worker crashes without losing job data.
2. **Scalability**: Capable of handling thousands of concurrent jobs across multiple worker processes.
3. **Security**: Sensitive administrative routes must be protected via encrypted tokens. No secrets are exposed to the client-side.
4. **Latency**: Dashboard metrics must reflect system state changes with less than 5 seconds of delay.

---

## 📈 Expected Outcome & Objectives

### Objectives
- **Automate Recovery**: Reduce manual SRE intervention for transient network or service failures.
- **Enhance Visibility**: Provide a single "Source of Truth" for all background task statuses.
- **Speed Up Debugging**: Use AI to cut down "Time to Resolution" for failed jobs.

### Expected Outcome
A robust, production-grade infrastructure that provides 99.9% reliability for background operations, featuring a "Zero-Trust" administrative terminal that empowers developers to monitor and manage distributed workloads with ease.

---

## 🔐 Configuration & Security 

To maintain security, **never commit your `.env` file to GitHub**. Use environment variables for all secrets.

### Required Environment Variables
| Variable | Purpose | Placeholder / Example |
|----------|---------|-----------------------|
| `GEMINI_API_KEY` | AI Failure Diagnosis | `AIza... (get from Google AI Studio)` |
| `JWT_SECRET` | Auth Token Signing | `random_long_secure_string_here` |
| `ADMIN_USERNAME` | Terminal Login | `admin` |
| `ADMIN_PASSWORD` | Terminal Login | `secure_password_here` |

### Setup Instructions
1. **Install**: `npm install`
2. **Configure**: Create a `.env` file based on `.env.example`.
3. **Firebase**: Include your `firebase-applet-config.json` in the root.
4. **Build**: `npm run build`
5. **Start**: `npm start`

---

