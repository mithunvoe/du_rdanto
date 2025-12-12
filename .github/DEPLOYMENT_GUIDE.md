# Deployment Guide

This guide covers deploying the Delineate Hackathon Challenge microservice to various cloud platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Railway Deployment](#railway-deployment)
- [Render Deployment](#render-deployment)
- [Fly.io Deployment](#flyio-deployment)
- [AWS Deployment](#aws-deployment)
- [Manual Deployment](#manual-deployment)
- [Environment Configuration](#environment-configuration)
- [Health Checks](#health-checks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

- [ ] All tests passing locally (`npm run test:e2e`)
- [ ] Docker image builds successfully
- [ ] Environment variables configured
- [ ] S3-compatible storage setup (MinIO, AWS S3, etc.)
- [ ] Cloud platform account created
- [ ] CI/CD pipeline passing

## Deployment Options

| Platform | Difficulty | Cost | Best For |
|----------|-----------|------|----------|
| Railway | Easy | Free tier available | Quick prototypes |
| Render | Easy | Free tier available | Small projects |
| Fly.io | Medium | Pay-as-you-go | Production apps |
| AWS | Hard | Pay-as-you-go | Enterprise scale |
| Self-hosted | Hard | Infrastructure cost | Full control |

## Railway Deployment

### Step 1: Install Railway CLI

```bash
# macOS
brew install railway

# npm
npm install -g @railway/cli

# Login
railway login
```

### Step 2: Initialize Project

```bash
# Create new project
railway init

# Link to existing project
railway link
```

### Step 3: Configure Environment Variables

```bash
# Set variables
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set S3_ENDPOINT=your_s3_endpoint
railway variables set S3_ACCESS_KEY_ID=your_access_key
railway variables set S3_SECRET_ACCESS_KEY=your_secret_key
railway variables set S3_BUCKET_NAME=downloads
railway variables set S3_FORCE_PATH_STYLE=true
```

### Step 4: Deploy

```bash
# Deploy from local
railway up

# Or configure GitHub integration for automatic deployments
```

### Step 5: Configure CI/CD

1. Get Railway token from dashboard
2. Add to GitHub secrets as `RAILWAY_TOKEN`
3. Uncomment Railway deployment in `.github/workflows/ci.yml`

```yaml
- name: Deploy to Railway
  uses: bervProject/railway-deploy@main
  with:
    railway_token: ${{ secrets.RAILWAY_TOKEN }}
    service: delineate-hackathon-challenge
```

## Render Deployment

### Step 1: Create render.yaml

Create `render.yaml` in project root:

```yaml
services:
  - type: web
    name: delineate-hackathon-challenge
    env: docker
    dockerfilePath: ./docker/Dockerfile.prod
    plan: free
    region: oregon
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: S3_ENDPOINT
        sync: false
      - key: S3_ACCESS_KEY_ID
        sync: false
      - key: S3_SECRET_ACCESS_KEY
        sync: false
      - key: S3_BUCKET_NAME
        value: downloads
      - key: S3_FORCE_PATH_STYLE
        value: true
      - key: REQUEST_TIMEOUT_MS
        value: 30000
      - key: RATE_LIMIT_WINDOW_MS
        value: 60000
      - key: RATE_LIMIT_MAX_REQUESTS
        value: 100
      - key: CORS_ORIGINS
        value: "*"
```

### Step 2: Deploy via Dashboard

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will detect `render.yaml` and configure services
5. Set sensitive environment variables in dashboard
6. Click "Apply"

### Step 3: Configure CI/CD

1. Get deploy hook URL from Render dashboard
2. Add to GitHub secrets as `RENDER_DEPLOY_HOOK_URL`
3. Uncomment Render deployment in `.github/workflows/ci.yml`

```yaml
- name: Deploy to Render
  run: |
    curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
```

## Fly.io Deployment

### Step 1: Install Fly CLI

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Login
fly auth login
```

### Step 2: Create fly.toml

Create `fly.toml` in project root:

```toml
app = "delineate-hackathon-challenge"
primary_region = "iad"

[build]
  dockerfile = "docker/Dockerfile.prod"

[env]
  NODE_ENV = "production"
  PORT = "8080"
  S3_FORCE_PATH_STYLE = "true"
  REQUEST_TIMEOUT_MS = "30000"
  RATE_LIMIT_WINDOW_MS = "60000"
  RATE_LIMIT_MAX_REQUESTS = "100"
  CORS_ORIGINS = "*"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  timeout = "5s"
  path = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

### Step 3: Set Secrets

```bash
fly secrets set S3_ENDPOINT=your_s3_endpoint
fly secrets set S3_ACCESS_KEY_ID=your_access_key
fly secrets set S3_SECRET_ACCESS_KEY=your_secret_key
fly secrets set S3_BUCKET_NAME=downloads
fly secrets set SENTRY_DSN=your_sentry_dsn
```

### Step 4: Deploy

```bash
# Launch app
fly launch

# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs
```

### Step 5: Configure CI/CD

1. Get Fly.io API token: `fly auth token`
2. Add to GitHub secrets as `FLY_API_TOKEN`
3. Uncomment Fly.io deployment in `.github/workflows/ci.yml`

```yaml
- name: Deploy to Fly.io
  uses: superfly/flyctl-actions/setup-flyctl@master
- run: flyctl deploy --remote-only
  env:
    FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## AWS Deployment

### Option 1: AWS App Runner

1. Build and push Docker image to ECR
2. Create App Runner service
3. Configure environment variables
4. Set up auto-scaling

### Option 2: ECS Fargate

1. Create ECS cluster
2. Define task definition
3. Create service with load balancer
4. Configure auto-scaling

### Option 3: Elastic Beanstalk

1. Create application
2. Upload Docker configuration
3. Configure environment
4. Deploy

### Example: Deploy to ECR + ECS

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -f docker/Dockerfile.prod -t delineate-hackathon-challenge .
docker tag delineate-hackathon-challenge:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/delineate-hackathon-challenge:latest

# Push
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/delineate-hackathon-challenge:latest

# Update ECS service
aws ecs update-service --cluster your-cluster --service your-service --force-new-deployment
```

## Manual Deployment

### Using Docker Compose

1. Copy `docker/compose.prod.yml` to your server
2. Set environment variables
3. Run:

```bash
docker compose -f docker/compose.prod.yml up -d
```

### Using Docker

```bash
# Build
docker build -f docker/Dockerfile.prod -t delineate-hackathon-challenge .

# Run
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e S3_ENDPOINT=your_endpoint \
  -e S3_ACCESS_KEY_ID=your_key \
  -e S3_SECRET_ACCESS_KEY=your_secret \
  -e S3_BUCKET_NAME=downloads \
  -e S3_FORCE_PATH_STYLE=true \
  --name delineate-api \
  delineate-hackathon-challenge
```

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "delineate-api" -- start

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

## Environment Configuration

### Required Variables

```env
NODE_ENV=production
PORT=3000
S3_REGION=us-east-1
S3_ENDPOINT=http://your-s3-endpoint:9000
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=downloads
S3_FORCE_PATH_STYLE=true
```

### Optional Variables

```env
# Observability
SENTRY_DSN=your_sentry_dsn
OTEL_EXPORTER_OTLP_ENDPOINT=http://your-otel-collector:4318

# Rate Limiting
REQUEST_TIMEOUT_MS=30000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGINS=https://your-frontend.com

# Download Delays (for testing)
DOWNLOAD_DELAY_ENABLED=true
DOWNLOAD_DELAY_MIN_MS=10000
DOWNLOAD_DELAY_MAX_MS=120000
```

## Health Checks

### Endpoint

```bash
curl http://your-domain.com/health
```

### Expected Response

```json
{
  "status": "healthy",
  "checks": {
    "storage": "ok"
  }
}
```

### Configure Health Checks

Most platforms support health checks:

**Railway**: Automatic via `/health` endpoint

**Render**: Configure in `render.yaml`:
```yaml
healthCheckPath: /health
```

**Fly.io**: Configure in `fly.toml`:
```toml
[[http_service.checks]]
  path = "/health"
  interval = "30s"
  timeout = "5s"
```

**AWS ALB**: Configure target group health check:
- Path: `/health`
- Interval: 30 seconds
- Timeout: 5 seconds
- Healthy threshold: 2
- Unhealthy threshold: 3

## Troubleshooting

### Issue: Health check fails

**Symptoms**: Service marked as unhealthy

**Solutions**:
1. Check S3 connectivity
2. Verify environment variables
3. Check application logs
4. Test endpoint manually

```bash
# Check logs
docker logs container-name

# Test health endpoint
curl -v http://localhost:3000/health
```

### Issue: Connection timeout

**Symptoms**: Requests timeout after 30 seconds

**Solutions**:
1. Increase `REQUEST_TIMEOUT_MS`
2. Implement async processing (see Challenge 2)
3. Use polling or webhooks
4. Configure proxy timeouts

### Issue: S3 connection fails

**Symptoms**: Storage check returns error

**Solutions**:
1. Verify S3 endpoint is accessible
2. Check credentials
3. Ensure bucket exists
4. Verify network connectivity

```bash
# Test S3 connection
aws s3 ls s3://downloads --endpoint-url http://your-endpoint
```

### Issue: Out of memory

**Symptoms**: Container crashes or restarts

**Solutions**:
1. Increase memory allocation
2. Check for memory leaks
3. Optimize application code
4. Enable memory limits

```bash
# Check memory usage
docker stats container-name
```

### Issue: High CPU usage

**Symptoms**: Slow response times

**Solutions**:
1. Enable auto-scaling
2. Optimize code
3. Add caching
4. Use CDN for static assets

## Monitoring

### Recommended Tools

- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry
- **Logging**: Papertrail, Logtail
- **Metrics**: Prometheus + Grafana
- **Tracing**: Jaeger, Zipkin

### Key Metrics to Monitor

- Response time (p50, p95, p99)
- Error rate
- Request rate
- CPU usage
- Memory usage
- Disk usage
- S3 operation latency

## Rollback Strategy

### Quick Rollback

**Railway**:
```bash
railway rollback
```

**Render**:
- Go to dashboard
- Select previous deployment
- Click "Rollback"

**Fly.io**:
```bash
fly releases
fly releases rollback <version>
```

**Docker**:
```bash
# Pull previous version
docker pull your-registry/app:previous-tag

# Stop current
docker stop container-name

# Start previous
docker run -d --name container-name your-registry/app:previous-tag
```

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Set secure environment variables
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Use secrets management
- [ ] Enable security headers
- [ ] Keep dependencies updated
- [ ] Monitor for vulnerabilities
- [ ] Use least privilege access
- [ ] Enable audit logging

## Cost Optimization

1. **Use free tiers** for development/testing
2. **Enable auto-scaling** to scale down during low traffic
3. **Use spot instances** for non-critical workloads
4. **Optimize Docker images** to reduce build/deploy time
5. **Enable caching** to reduce compute costs
6. **Monitor usage** to identify optimization opportunities

## Next Steps

After deployment:

1. [ ] Verify health endpoint
2. [ ] Test API endpoints
3. [ ] Configure monitoring
4. [ ] Set up alerts
5. [ ] Document deployment process
6. [ ] Train team on rollback procedures
7. [ ] Plan for scaling
8. [ ] Schedule regular updates
