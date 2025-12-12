# Long-Running Download Architecture

## Problem Statement

The current download microservice faces critical challenges when integrated with frontend applications and reverse proxies:

- **Connection Timeouts**: Downloads taking 10-120 seconds exceed proxy timeouts (Cloudflare: 100s, nginx: 60s default)
- **Poor UX**: Users wait 2+ minutes without feedback
- **Resource Exhaustion**: Long-held HTTP connections consume server resources
- **Retry Storms**: Dropped connections lead to duplicate work

## Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Frontend      │    │    Proxy     │    │   Backend API   │
│   (React)       │    │ (Cloudflare) │    │    (Hono)       │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │                    │
         │ 1. POST /initiate     │                    │
         ├──────────────────────────────────────────→ │
         │ ← jobId (immediate)   │                    │
         │                       │                    │
         │ 2. WebSocket /ws/:jobId                    │
         ├──────────────────────────────────────────→ │
         │ ← real-time updates   │                    │
         │                       │                    │
         │ 3. GET /result/:jobId │                    │
         ├──────────────────────────────────────────→ │
         │ ← download URL        │                    │
         │                       │                    │
         │                       │    ┌─────────────┐ │
         │                       │    │   Redis     │ │
         │                       │    │   Queue     │ │
         │                       │    └─────────────┘ │
```

## Technical Approach: Hybrid Pattern (WebSocket + Polling Fallback)

### Why Hybrid?

1. **WebSocket Primary**: Real-time updates, excellent UX
2. **Polling Fallback**: Handles WebSocket failures, works behind restrictive proxies
3. **Immediate Response**: No blocking HTTP connections
4. **Scalable**: Background job processing with Redis

### Core Components

#### 1. Job Management System
- **Redis**: Job state storage and pub/sub for real-time updates
- **Job States**: `queued` → `processing` → `completed`/`failed`
- **Progress Tracking**: Percentage completion for multi-file downloads

#### 2. Background Processing
- **Worker Process**: Separate from HTTP server
- **Queue System**: Redis-based job queue
- **Retry Logic**: Exponential backoff for failed jobs

#### 3. Real-time Communication
- **WebSocket**: Primary communication channel
- **Server-Sent Events**: Alternative for simpler clients
- **Polling API**: Fallback for restricted environments

## API Contract Changes

### New Endpoints

```typescript
// 1. Initiate Download (Modified)
POST /v1/download/initiate
{
  "file_ids": [70000, 70001],
  "callback_url": "https://client.com/webhook" // optional
}
→ {
  "job_id": "uuid",
  "status": "queued",
  "total_files": 2,
  "websocket_url": "ws://localhost:3000/ws/download/uuid"
}

// 2. WebSocket Connection
WS /ws/download/:jobId
→ Real-time updates:
{
  "type": "progress",
  "job_id": "uuid",
  "completed": 1,
  "total": 2,
  "current_file": 70001,
  "progress_percent": 50
}

// 3. Job Status (Polling Fallback)
GET /v1/download/status/:jobId
→ {
  "job_id": "uuid",
  "status": "processing",
  "progress": {
    "completed": 1,
    "total": 2,
    "percent": 50
  },
  "results": [
    {
      "file_id": 70000,
      "status": "completed",
      "download_url": "https://...",
      "size": 1024000
    }
  ]
}

// 4. Download Result
GET /v1/download/result/:jobId
→ {
  "job_id": "uuid",
  "status": "completed",
  "download_urls": ["https://..."],
  "expires_at": "2024-01-01T12:00:00Z"
}
```

### Database Schema (Redis)

```typescript
// Job metadata
job:{jobId} = {
  id: string,
  status: 'queued' | 'processing' | 'completed' | 'failed',
  file_ids: number[],
  created_at: timestamp,
  started_at?: timestamp,
  completed_at?: timestamp,
  callback_url?: string,
  progress: {
    completed: number,
    total: number,
    current_file?: number
  },
  results: Array<{
    file_id: number,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    download_url?: string,
    size?: number,
    error?: string
  }>
}

// Job queue
queue:downloads = [jobId1, jobId2, ...]

// Active connections (for WebSocket cleanup)
connections:{jobId} = Set<connectionId>
```

## Proxy Configuration

### Cloudflare
```javascript
// cloudflare-worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return fetch(request); // Pass through to origin
    }
    
    // API requests - set reasonable timeouts
    if (url.pathname.startsWith('/v1/download/initiate')) {
      return fetch(request, {
        timeout: 10000 // 10s max for initiate
      });
    }
    
    return fetch(request);
  }
}
```

### nginx
```nginx
server {
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
    
    location /v1/download/ {
        proxy_pass http://backend;
        proxy_timeout 30s;
        proxy_connect_timeout 10s;
    }
}
```

## Frontend Integration Strategy

### React Hook Implementation
```typescript
const useDownload = (fileIds: number[]) => {
  const [status, setStatus] = useState<'idle' | 'initiating' | 'processing' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [results, setResults] = useState<DownloadResult[]>([]);
  
  const startDownload = async () => {
    // 1. Initiate job
    const { job_id, websocket_url } = await initiateDownload(fileIds);
    
    // 2. Connect WebSocket with fallback
    const ws = new WebSocket(websocket_url);
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setProgress(update.progress);
      setResults(update.results);
    };
    
    // 3. Polling fallback
    ws.onerror = () => {
      startPolling(job_id);
    };
  };
  
  return { status, progress, results, startDownload };
};
```

### Error Handling & Retry Logic
- **Connection Failures**: Automatic WebSocket reconnection with exponential backoff
- **Job Failures**: Retry individual files up to 3 times
- **Timeout Handling**: Client-side timeout detection and graceful degradation
- **Browser Refresh**: Job recovery using localStorage persistence

### User Experience Features
- **Progress Indicators**: Real-time progress bars and file-by-file status
- **Background Processing**: Downloads continue when user navigates away
- **Notifications**: Browser notifications for completion
- **Download Management**: Cancel, pause, and resume capabilities

## Implementation Benefits

1. **Scalability**: Background processing handles concurrent downloads
2. **Reliability**: Multiple communication channels ensure delivery
3. **Performance**: Non-blocking architecture prevents resource exhaustion
4. **User Experience**: Real-time feedback and progress tracking
5. **Proxy Compatibility**: Works with all major reverse proxies
6. **Cost Efficiency**: Redis-based queue system is cost-effective

## Monitoring & Observability

- **Metrics**: Job completion rates, processing times, WebSocket connection health
- **Logging**: Structured logs for job lifecycle and error tracking
- **Alerting**: Failed job thresholds and queue depth monitoring
- **Tracing**: OpenTelemetry integration for end-to-end request tracking