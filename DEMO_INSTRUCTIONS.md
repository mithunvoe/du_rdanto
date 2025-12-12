# Long-Running Download Architecture Demo

This demo showcases a complete solution for handling long-running downloads with real-time progress updates, WebSocket communication, and polling fallback.

## Quick Start

### Prerequisites
- Node.js 24.10.0+
- Redis server running on localhost:6379

### Setup
```bash
# Run the setup script
./setup-demo.sh

# Or manual setup:
pnpm install
cd frontend && pnpm install && cd ..
```

### Running the Demo

**Terminal 1 - Backend API Server:**
```bash
npm run start
```

**Terminal 2 - Background Worker:**
```bash
npm run worker
```

**Terminal 3 - Frontend:**
```bash
cd frontend
pnpm run dev
```

Open http://localhost:5174 in your browser.

## Demo Features

### 🔄 Real-time Updates
- WebSocket connection for instant progress updates
- Automatic fallback to polling if WebSocket fails
- Connection status indicator

### 📊 Progress Tracking
- Overall progress bar
- Individual file status
- Processing time simulation (10-30 seconds per file)

### 🎯 Test Scenarios

**Available Files (divisible by 7):**
```
70000,70007,70014,70021
```

**Unavailable Files:**
```
70001,70002,70003,70004
```

**Mixed Scenario:**
```
70000,70001,70007,70008
```

### 🔧 Architecture Components

1. **Frontend (React + TypeScript)**
   - Real-time progress UI
   - WebSocket integration with fallback
   - Error handling and retry logic

2. **Backend API (Hono + TypeScript)**
   - Job management system
   - WebSocket server for real-time updates
   - RESTful polling endpoints

3. **Background Worker**
   - Redis-based job queue
   - Simulated long-running processing
   - Progress updates via Redis pub/sub

4. **Redis**
   - Job state storage
   - Queue management
   - Real-time communication

## API Endpoints

### Start Download Job
```bash
curl -X POST http://localhost:3000/v1/download/initiate \
  -H "Content-Type: application/json" \
  -d '{"file_ids": [70000, 70007]}'
```

### Check Job Status (Polling)
```bash
curl http://localhost:3000/v1/download/status/{jobId}
```

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/download/{jobId}');
```

## Testing Proxy Timeouts

To test how this handles proxy timeouts, you can:

1. **Simulate Network Issues:**
   ```bash
   # Kill WebSocket connection
   sudo iptables -A OUTPUT -p tcp --dport 3000 -j DROP
   # Restore after testing
   sudo iptables -D OUTPUT -p tcp --dport 3000 -j DROP
   ```

2. **Test with nginx Proxy:**
   ```nginx
   location / {
     proxy_pass http://localhost:5174;
     proxy_timeout 30s;  # Short timeout to test fallback
   }
   ```

## Architecture Benefits

✅ **No Blocking Connections** - Immediate response with job ID  
✅ **Real-time Updates** - WebSocket with polling fallback  
✅ **Proxy Compatible** - Works behind Cloudflare, nginx, ALB  
✅ **Scalable** - Background processing with Redis queue  
✅ **Resilient** - Multiple communication channels  
✅ **User-Friendly** - Progress bars and status updates  

## Troubleshooting

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping

# Start Redis (Ubuntu/Debian)
sudo systemctl start redis

# Start Redis (macOS)
brew services start redis

# Docker Redis
docker run -d -p 6379:6379 redis:alpine
```

### Port Conflicts
- Backend: http://localhost:3000
- Frontend: http://localhost:5174
- Redis: localhost:6379

### WebSocket Issues
- Check browser console for connection errors
- Verify proxy configuration allows WebSocket upgrades
- Polling fallback should activate automatically

## Production Considerations

1. **Redis Clustering** for high availability
2. **Load Balancer** with sticky sessions for WebSocket
3. **Monitoring** job queue depth and processing times
4. **Rate Limiting** on job creation endpoints
5. **Authentication** and authorization
6. **File Storage** integration (S3, etc.)
7. **Webhook Callbacks** for external integrations