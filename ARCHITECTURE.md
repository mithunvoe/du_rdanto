# Architecture Design & Observability Plan

## Executive Summary

This document outlines a comprehensive architecture design for the Delineate download microservice, addressing long-running download operations (10-120 seconds) and implementing a complete observability stack.

---

## 1. Current Architecture Analysis

### 1.1 Current State

```
┌─────────────────────────────────────────────────────────────┐
│                    Current Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client ──► API (Hono) ──► S3 (RustFS)                     │
│              │                                              │
│              ├─► OpenTelemetry ──► Jaeger (dev only)        │
│              └─► Sentry (error tracking)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Issues Identified:**
- ❌ Synchronous long-running operations (10-120s) cause timeouts
- ❌ No job queue or background processing
- ❌ Limited observability (traces only in dev, no metrics/logs aggregation)
- ❌ No progress tracking for users
- ❌ Resource exhaustion from holding HTTP connections open

---

## 2. Proposed Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Proposed Architecture                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────┐                                                             │
│  │   Client    │                                                             │
│  │ (Frontend)  │                                                             │
│  └──────┬──────┘                                                             │
│         │                                                                     │
│         │ HTTP/WebSocket                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │                    API Gateway / Load Balancer              │             │
│  │              (Cloudflare / nginx / AWS ALB)                 │             │
│  └──────────────────────┬──────────────────────────────────────┘             │
│                         │                                                     │
│                         │                                                     │
│         ┌───────────────┼───────────────┐                                     │
│         │               │               │                                     │
│         ▼               ▼               ▼                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                                 │
│  │   API    │   │   API    │   │   API    │  (Horizontal Scaling)            │
│  │ Instance │   │ Instance │   │ Instance │                                   │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                                   │
│       │              │               │                                         │
│       └──────────────┼───────────────┘                                         │
│                      │                                                         │
│                      ▼                                                         │
│            ┌─────────────────┐                                                │
│            │   Redis Queue   │  (Job Queue + Cache)                            │
│            │   (BullMQ)      │                                                │
│            └────────┬────────┘                                                │
│                     │                                                          │
│         ┌───────────┼───────────┐                                             │
│         │           │           │                                             │
│         ▼           ▼           ▼                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                                     │
│  │ Worker 1 │ │ Worker 2 │ │ Worker N │  (Background Workers)                │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                                     │
│       │            │            │                                             │
│       └────────────┼────────────┘                                             │
│                    │                                                           │
│                    ▼                                                           │
│            ┌──────────────┐                                                    │
│            │  S3 Storage  │                                                    │
│            │   (RustFS)   │                                                    │
│            └──────────────┘                                                    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │                    Observability Stack                       │             │
│  ├─────────────────────────────────────────────────────────────┤             │
│  │  • OpenTelemetry Collector ──► Jaeger (Traces)              │             │
│  │  • Prometheus (Metrics) ──► Grafana (Dashboards)             │             │
│  │  • Loki (Logs) ──► Grafana (Log Aggregation)                │             │
│  │  • Sentry (Error Tracking)                                   │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Architecture Pattern: Hybrid Approach

We recommend a **Hybrid Pattern** combining:
- **Polling Pattern** for status checks (simple, reliable)
- **WebSocket/SSE** for real-time progress updates (better UX)
- **Presigned URLs** for direct S3 downloads (scalable)

---

## 3. Detailed Component Design

### 3.1 API Layer (Hono Service)

**Responsibilities:**
- Request validation and authentication
- Job initiation (returns immediately)
- Status polling endpoints
- WebSocket/SSE connections for progress
- Health checks

**New Endpoints:**

```typescript
POST   /v1/download/initiate     → Returns jobId immediately
GET    /v1/download/status/:jobId → Poll job status
GET    /v1/download/progress/:jobId → SSE stream for progress
WS     /v1/download/stream/:jobId → WebSocket for real-time updates
GET    /v1/download/:jobId        → Get presigned URL when ready
DELETE /v1/download/:jobId        → Cancel job
```

**API Contract Changes:**

```typescript
// POST /v1/download/initiate
Request: {
  file_ids: number[],
  callback_url?: string  // Optional webhook
}

Response: {
  jobId: string,
  status: "queued",
  estimatedTimeMs: number,
  totalFiles: number
}

// GET /v1/download/status/:jobId
Response: {
  jobId: string,
  status: "queued" | "processing" | "completed" | "failed" | "cancelled",
  progress: {
    completed: number,
    total: number,
    percentage: number
  },
  files: Array<{
    file_id: number,
    status: "pending" | "processing" | "completed" | "failed",
    downloadUrl?: string,
    error?: string
  }>,
  startedAt: string,
  completedAt?: string,
  estimatedCompletionAt?: string
}
```

### 3.2 Job Queue System (Redis + BullMQ)

**Why BullMQ?**
- ✅ Built on Redis (fast, reliable)
- ✅ Job prioritization and retries
- ✅ Progress tracking built-in
- ✅ Rate limiting support
- ✅ Job scheduling and delays

**Queue Structure:**

```typescript
// Job Data Structure
interface DownloadJob {
  jobId: string;
  fileIds: number[];
  userId?: string;
  callbackUrl?: string;
  createdAt: Date;
  priority?: number;
}

// Job Progress
interface JobProgress {
  jobId: string;
  total: number;
  completed: number;
  failed: number;
  currentFile?: number;
  files: Map<number, FileStatus>;
}
```

**Redis Schema:**

```
downloads:job:{jobId} → Job metadata (JSON)
downloads:progress:{jobId} → Progress data (JSON)
downloads:queue → BullMQ queue
downloads:results:{jobId} → Completed file URLs (Hash)
```

### 3.3 Worker Processes

**Responsibilities:**
- Process download jobs from queue
- Update progress in Redis
- Handle retries and failures
- Generate presigned S3 URLs
- Emit progress events

**Worker Implementation:**

```typescript
// Worker processes jobs with concurrency control
const worker = new Worker('download-queue', async (job) => {
  const { jobId, fileIds } = job.data;
  
  for (const fileId of fileIds) {
    // Update progress
    await updateProgress(jobId, fileId, 'processing');
    
    try {
      // Simulate download delay
      const delay = getRandomDelay();
      await sleep(delay);
      
      // Check S3 availability
      const result = await checkS3Availability(fileId);
      
      if (result.available) {
        // Generate presigned URL
        const url = await generatePresignedUrl(result.s3Key);
        await markFileComplete(jobId, fileId, url);
      } else {
        await markFileFailed(jobId, fileId, 'File not found');
      }
    } catch (error) {
      await markFileFailed(jobId, fileId, error.message);
    }
  }
  
  await markJobComplete(jobId);
}, {
  concurrency: 5,  // Process 5 files concurrently
  limiter: {
    max: 10,
    duration: 1000  // Max 10 jobs per second
  }
});
```

### 3.4 Database/Cache Schema

**Redis Keys:**

```
# Job Metadata (TTL: 24 hours)
downloads:job:{jobId} → {
  jobId: string,
  fileIds: number[],
  status: string,
  createdAt: timestamp,
  userId?: string
}

# Progress Tracking (TTL: 24 hours)
downloads:progress:{jobId} → {
  total: number,
  completed: number,
  failed: number,
  percentage: number,
  currentFile?: number
}

# File Results (TTL: 7 days)
downloads:results:{jobId}:{fileId} → {
  status: "completed" | "failed",
  downloadUrl?: string,
  error?: string,
  completedAt: timestamp
}

# WebSocket Connections
downloads:ws:{jobId} → Set of WebSocket connection IDs
```

**Optional: PostgreSQL for Persistence**

If you need job history beyond Redis TTL:

```sql
CREATE TABLE download_jobs (
  job_id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  file_ids INTEGER[],
  status VARCHAR(50),
  progress JSONB,
  created_at TIMESTAMP,
  completed_at TIMESTAMP,
  callback_url TEXT
);

CREATE TABLE download_files (
  id SERIAL PRIMARY KEY,
  job_id UUID REFERENCES download_jobs(job_id),
  file_id INTEGER,
  status VARCHAR(50),
  download_url TEXT,
  error TEXT,
  completed_at TIMESTAMP
);

CREATE INDEX idx_job_status ON download_jobs(status);
CREATE INDEX idx_job_user ON download_jobs(user_id);
```

---

## 4. Observability Stack

### 4.1 Complete Observability Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Observability Stack                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Metrics    │  │    Logs      │  │   Traces     │      │
│  │  (Prometheus)│  │(Elasticsearch)│  │(Elasticsearch)│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                           ▼                                 │
│              ┌─────────────────────────┐                    │
│              │ OpenTelemetry Collector  │                    │
│              │   (OTEL Collector)       │                    │
│              └─────────────┬───────────┘                    │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │Prometheus│      │Elasticsearch │      │Elasticsearch │   │
│  └────┬─────┘      └──────┬───────┘      └──────┬───────┘   │
│       │                   │                     │            │
│       └───────────────────┼─────────────────────┘            │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐          │
│  │ Grafana  │      │  Kibana  │      │  Sentry  │          │
│  │(Metrics) │      │(Logs/Traces)│   │(Errors) │          │
│  └──────────┘      └──────────┘      └──────────┘          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Sentry (Error Tracking)                │    │
│  │  • Error aggregation                                │    │
│  │  • Performance monitoring                           │    │
│  │  • Release tracking                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Metrics (Prometheus)

**Key Metrics to Track:**

```typescript
// Application Metrics
download_jobs_total{status="queued|processing|completed|failed"}
download_jobs_duration_seconds{status="completed|failed"}
download_files_processed_total{status="success|failure"}
download_queue_size
download_worker_active_count
download_worker_idle_count

// API Metrics
http_requests_total{method, endpoint, status}
http_request_duration_seconds{method, endpoint}
http_request_size_bytes{method, endpoint}
http_response_size_bytes{method, endpoint}

// System Metrics
nodejs_heap_size_bytes
nodejs_heap_used_bytes
nodejs_eventloop_lag_seconds
nodejs_gc_duration_seconds

// S3 Metrics
s3_requests_total{operation, status}
s3_request_duration_seconds{operation}
s3_bytes_transferred_total{operation}
```

**Prometheus Configuration:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'delineate-api'
    static_configs:
      - targets: ['delineate-app:3000']
    metrics_path: '/metrics'
    
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

### 4.3 Logs (Elasticsearch + Kibana)

**Structured Logging:**

```typescript
// Use structured logging with correlation IDs
logger.info('Download job initiated', {
  jobId: 'abc123',
  fileIds: [70000, 70001],
  userId: 'user123',
  requestId: 'req-xyz',
  traceId: 'trace-abc'
});

logger.error('Download failed', {
  jobId: 'abc123',
  fileId: 70000,
  error: error.message,
  stack: error.stack,
  requestId: 'req-xyz',
  traceId: 'trace-abc'
});
```

**Elasticsearch Configuration:**

Elasticsearch is configured via Docker Compose with:
- Single-node setup for development
- Security disabled for local development
- Persistent volume for data storage
- Health checks enabled

**Filebeat Configuration:**

Filebeat ships logs from Docker containers to Elasticsearch:

```yaml
# filebeat.yml
filebeat.inputs:
  - type: container
    paths:
      - '/var/lib/docker/containers/*/*.log'

output.elasticsearch:
  hosts: ['elasticsearch:9200']
  indices:
    - index: "delineate-logs-%{+yyyy.MM.dd}"
```

**Kibana Access:**
- URL: http://localhost:5601
- Create index patterns for log exploration
- Build dashboards for log analysis

### 4.4 Traces (Elasticsearch + Kibana via OpenTelemetry)

**Enhanced Tracing:**

Traces are sent to Elasticsearch via OpenTelemetry Collector and visualized in Kibana.

```typescript
// Add custom spans for business logic
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('delineate-service');

async function processDownload(jobId: string, fileId: number) {
  const span = tracer.startSpan('process_download', {
    attributes: {
      'job.id': jobId,
      'file.id': fileId,
      'download.type': 'async'
    }
  });
  
  try {
    // Child span for S3 check
    const s3Span = tracer.startSpan('s3_check', {
      parent: span
    });
    const result = await checkS3Availability(fileId);
    s3Span.setAttribute('s3.available', result.available);
    s3Span.end();
    
    // Child span for delay simulation
    const delaySpan = tracer.startSpan('download_delay');
    await sleep(getRandomDelay());
    delaySpan.end();
    
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({ 
      code: SpanStatusCode.ERROR,
      message: error.message 
    });
    span.recordException(error);
  } finally {
    span.end();
  }
}
```

**Kibana Trace Visualization:**
- Access Kibana: http://localhost:5601
- Navigate to APM or create index pattern for traces
- View distributed traces with service dependencies
- Analyze trace performance and bottlenecks

### 4.5 Error Tracking (Sentry)

**Enhanced Sentry Integration:**

```typescript
// Add context to errors
Sentry.setContext('download_job', {
  jobId: 'abc123',
  fileIds: [70000],
  userId: 'user123'
});

Sentry.setTag('download_type', 'async');
Sentry.setTag('file_count', fileIds.length);

// Performance monitoring
const transaction = Sentry.startTransaction({
  op: 'download.process',
  name: 'ProcessDownloadJob'
});

// ... process download ...

transaction.finish();
```

---

## 5. Docker Compose Enhancement

### 5.1 Updated Production Compose

```yaml
name: delineate

services:
  # API Service
  delineate-app:
    build:
      context: ..
      dockerfile: docker/Dockerfile.prod
    ports:
      - "3000:3000"
    env_file:
      - ../.env
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://delineate-redis:6379
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
    depends_on:
      - delineate-redis
      - delineate-rustfs-init
      - otel-collector
    restart: unless-stopped
    networks:
      - delineate-network

  # Worker Service (Horizontally Scalable)
  # Manual scaling: docker compose up --scale delineate-worker=3
  # Automatic scaling: Use scripts/auto-scale-workers.sh
  delineate-worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile.prod
    command: node --experimental-transform-types src/worker.ts
    env_file:
      - ../.env
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://delineate-redis:6379
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
    depends_on:
      - delineate-redis
      - delineate-rustfs
      - otel-collector
    restart: unless-stopped
    networks:
      - delineate-network

  # Redis (Queue + Cache)
  delineate-redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    networks:
      - delineate-network

  # S3 Storage
  delineate-rustfs:
    image: rustfs/rustfs:latest
    container_name: delineate-rustfs
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - rustfs-data:/data
      - rustfs-logs:/logs
    environment:
      - RUSTFS_ROOT_USER=rustfsadmin
      - RUSTFS_ROOT_PASSWORD=rustfsadmin
    user: "10001:10001"
    restart: unless-stopped
    networks:
      - delineate-network

  delineate-rustfs-init:
    image: amazon/aws-cli:latest
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        until curl -s http://delineate-rustfs:9000 | grep -qE "^(200|403|404)"; do
          sleep 2
        done
        aws --endpoint-url=http://delineate-rustfs:9000 \
          --region=us-east-1 \
          s3 mb s3://downloads || echo "Bucket exists"
    depends_on:
      - delineate-rustfs
    environment:
      - AWS_ACCESS_KEY_ID=rustfsadmin
      - AWS_SECRET_ACCESS_KEY=rustfsadmin
      - AWS_DEFAULT_REGION=us-east-1
    networks:
      - delineate-network

  # OpenTelemetry Collector
  otel-collector:
    image: otel/opentelemetry-collector:latest
    command: ["--config=/etc/otel-collector-config.yml"]
    volumes:
      - ./otel-collector-config.yml:/etc/otel-collector-config.yml
    ports:
      - "4317:4317"  # OTLP gRPC
      - "4318:4318"  # OTLP HTTP
    depends_on:
      - prometheus
      - loki
      - jaeger
    networks:
      - delineate-network

  # Prometheus (Metrics)
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - delineate-network

  # Loki (Logs)
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - delineate-network

  # Promtail (Log Shipper)
  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
    command: -config.file=/etc/promtail/config.yml
    depends_on:
      - loki
    networks:
      - delineate-network

  # Jaeger (Traces)
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    networks:
      - delineate-network

  # Grafana (Dashboards)
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_AUTH_ANONYMOUS_ENABLED=true
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    depends_on:
      - prometheus
      - loki
      - jaeger
    networks:
      - delineate-network

volumes:
  redis-data:
  rustfs-data:
  rustfs-logs:
  prometheus-data:
  loki-data:
  grafana-data:

networks:
  delineate-network:
    driver: bridge
```

### 5.2 OpenTelemetry Collector Configuration

```yaml
# otel-collector-config.yml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024
  memory_limiter:
    limit_mib: 512

exporters:
  # Prometheus metrics
  prometheus:
    endpoint: "0.0.0.0:8889"
  
  # Elasticsearch (logs and traces)
  elasticsearch:
    endpoints:
      - http://elasticsearch:9200
    logs_index: delineate-logs
    traces_index: delineate-traces
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [elasticsearch]
    
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
    
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [elasticsearch]
```

---

## 6. Proxy Configuration

### 6.1 Cloudflare Configuration

```javascript
// Cloudflare Workers or Page Rules
// Increase timeout for download endpoints
{
  "timeout": 300,  // 5 minutes
  "patterns": [
    {
      "url": "*/v1/download/status/*",
      "timeout": 30
    },
    {
      "url": "*/v1/download/progress/*",
      "timeout": 600  // 10 minutes for SSE
    }
  ]
}
```

### 6.2 Nginx Configuration

```nginx
# nginx.conf
upstream api_backend {
    least_conn;
    server delineate-app:3000;
    # Add more instances for load balancing
}

server {
    listen 80;
    server_name api.example.com;

    # Increase timeouts for long-running requests
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
    proxy_send_timeout 300s;

    # WebSocket support
    location /v1/download/stream/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 600s;
    }

    # SSE support
    location /v1/download/progress/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        chunked_transfer_encoding on;
    }

    # Regular API endpoints
    location / {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 7. Frontend Integration

### 7.1 React/Next.js Implementation

```typescript
// hooks/useDownload.ts
import { useState, useEffect, useCallback } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';

interface DownloadJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

export function useDownload() {
  const [job, setJob] = useState<DownloadJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initiateDownload = useCallback(async (fileIds: number[]) => {
    try {
      const response = await fetch('/api/v1/download/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_ids: fileIds }),
      });
      
      const data = await response.json();
      setJob(data);
      return data.jobId;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const subscribeToProgress = useCallback((jobId: string) => {
    const eventSource = new EventSourcePolyfill(
      `/api/v1/download/progress/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      }
    );

    eventSource.onmessage = (event) => {
      const progress = JSON.parse(event.data);
      setJob(prev => ({ ...prev, ...progress }));
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  return {
    job,
    error,
    initiateDownload,
    subscribeToProgress,
  };
}
```

### 7.2 Progress UI Component

```tsx
// components/DownloadProgress.tsx
export function DownloadProgress({ jobId }: { jobId: string }) {
  const { job, subscribeToProgress } = useDownload();
  
  useEffect(() => {
    if (jobId) {
      const cleanup = subscribeToProgress(jobId);
      return cleanup;
    }
  }, [jobId, subscribeToProgress]);

  if (!job) return null;

  return (
    <div className="download-progress">
      <h3>Download Progress</h3>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${job.progress.percentage}%` }}
        />
      </div>
      <p>
        {job.progress.completed} / {job.progress.total} files completed
      </p>
      <p>Status: {job.status}</p>
    </div>
  );
}
```

---

## 8. Implementation Roadmap

### Phase 1: Core Architecture (Week 1)
- [ ] Set up Redis + BullMQ
- [ ] Implement job queue system
- [ ] Create worker processes
- [ ] Update API endpoints for async pattern
- [ ] Add progress tracking

### Phase 2: Observability (Week 2)
- [ ] Set up OpenTelemetry Collector
- [ ] Configure Prometheus metrics
- [ ] Set up Loki for logs
- [ ] Enhance Jaeger tracing
- [ ] Create Grafana dashboards

### Phase 3: Frontend & UX (Week 3)
- [ ] Implement SSE/WebSocket endpoints
- [ ] Build React progress UI
- [ ] Add error handling and retries
- [ ] Implement presigned URL generation

### Phase 4: Production Hardening (Week 4)
- [ ] Load testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation
- [ ] Monitoring alerts

---

## 9. Cost Considerations

| Component | Estimated Cost (Monthly) |
|-----------|-------------------------|
| Redis (Cloud) | $15-50 (depending on size) |
| Prometheus | Free (self-hosted) |
| Elasticsearch | Free (self-hosted) |
| Kibana | Free (self-hosted) |
| Grafana | Free (self-hosted) |
| Sentry | $26-99 (depending on plan) |
| **Total** | **$41-149/month** |

**Self-hosted option:** All observability tools can run on a single server (~$20/month VPS).

---

## 10. Monitoring & Alerts

### Key Metrics to Alert On

```yaml
# Alert Rules (Prometheus)
groups:
  - name: delineate_alerts
    rules:
      - alert: HighJobFailureRate
        expr: rate(download_jobs_total{status="failed"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High download job failure rate"
      
      - alert: QueueBacklog
        expr: download_queue_size > 1000
        for: 10m
        annotations:
          summary: "Download queue backlog is high"
      
      - alert: WorkerDown
        expr: download_worker_active_count == 0
        for: 2m
        annotations:
          summary: "No active download workers"
      
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High API error rate"
```

---

## 11. Security Considerations

1. **Job Isolation**: Each job should be scoped to a user/session
2. **Rate Limiting**: Per-user rate limits on job creation
3. **Presigned URLs**: Time-limited, signed URLs for S3 access
4. **Input Validation**: Strict validation on file IDs
5. **Authentication**: JWT tokens for API access
6. **CORS**: Restrict origins in production

---

## 12. Testing Strategy

### Unit Tests
- Job queue operations
- Worker logic
- Progress tracking

### Integration Tests
- API → Queue → Worker → S3 flow
- Progress updates
- Error handling

### E2E Tests
- Full download workflow
- Timeout scenarios
- Concurrent downloads

### Load Tests
- 1000 concurrent jobs
- Queue saturation
- Worker scaling

---

## Conclusion

This architecture provides:

✅ **Scalability**: Horizontal scaling of API and workers  
✅ **Reliability**: Job queue with retries and persistence  
✅ **Observability**: Complete metrics (Prometheus), logs (Elasticsearch), and traces (Elasticsearch)  
✅ **User Experience**: Real-time progress updates  
✅ **Cost Efficiency**: Self-hosted observability stack  
✅ **Production Ready**: Error handling, monitoring, alerts  
✅ **Tech Stack Compliance**: Follows suggested stack (Prometheus, Grafana, Kibana, Elasticsearch, Sentry, RustFS, Docker, GitHub Actions)

The hybrid approach (polling + SSE/WebSocket) balances simplicity with user experience, while the comprehensive observability stack using the suggested technologies ensures you can monitor and debug issues in production.
