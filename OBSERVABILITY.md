# Observability Setup Guide

This guide explains how to set up and use the complete observability stack for the Delineate download service.

## Quick Start

### Start with Full Observability Stack

```bash
# Start all services including observability
docker compose -f docker/compose.prod.observability.yml up -d

# Or for development
docker compose -f docker/compose.dev.yml up -d
```

### Access Observability UIs

Once services are running, access:

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `admin`
  - Pre-configured data sources: Prometheus, Loki, Jaeger

- **Jaeger UI**: http://localhost:16686
  - View distributed traces
  - Search by service, operation, tags

- **Prometheus**: http://localhost:9090
  - Query metrics
  - View targets status

- **Loki**: http://localhost:3100
  - Log aggregation endpoint
  - Access via Grafana UI

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Application Services                        │
│  (API, Workers, etc.)                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ OTLP (OpenTelemetry Protocol)
                   ▼
┌─────────────────────────────────────────────────────────┐
│         OpenTelemetry Collector                         │
│  • Receives traces, metrics, logs                      │
│  • Processes and routes to exporters                    │
└──────┬──────────────┬──────────────┬───────────────────┘
       │              │              │
       ▼              ▼              ▼
  ┌─────────┐   ┌──────────────┐   ┌──────────────┐
  │Prometheus│   │Elasticsearch │   │Elasticsearch │
  │(Metrics) │   │   (Logs)     │   │  (Traces)    │
  └────┬────┘   └──────┬───────┘   └──────┬───────┘
       │               │                   │
       └───────────────┼───────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ Grafana │   │ Kibana  │   │ Sentry  │
    │(Metrics)│   │(Logs/Traces)│ │(Errors)│
    └─────────┘   └─────────┘   └─────────┘
```

## Components

### 1. OpenTelemetry Collector

**Purpose**: Central collection point for all telemetry data

**Configuration**: `docker/otel-collector-config.yml`

**Features**:
- Receives OTLP data from applications
- Processes and batches data**Features**:
- Receives OTLP data from applications
- Processes and batches data
- Routes to appropriate backends (Elasticsearch, Prometheus)
- Routes to appropriate backends (Elasticsearch, Prometheus)

**Ports**:
- `4317`: OTLP gRPC receiver
- `4318`: OTLP HTTP receiver

### 2. Prometheus (Metrics)

**Purpose**: Time-series database for metrics

**Configuration**: `docker/prometheus.yml`

**Key Metrics**:
- HTTP request rates and latencies
- Download job status and counts
- Queue sizes
- Worker activity
- System resources (CPU, memory)

**Access**: http://localhost:9090

**Example Queries**:
```promql
# Request rate
rate(http_requests_total[5m])

# Average response time
rate(http_request_duration_seconds_sum[5m]) / rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

### 3. Elasticsearch (Logs & Traces)

**Purpose**: Search and analytics engine for logs and traces

**Configuration**: Configured via Docker Compose

**Features**:
- Stores logs from Filebeat and OpenTelemetry
- Stores traces from OpenTelemetry
- Full-text search capabilities
- Index management

**Access**: http://localhost:9200

**Indexes**:
- `delineate-logs-*`: Application logs
- `delineate-traces-*`: Distributed traces

### 4. Filebeat (Log Shipper)

**Purpose**: Ships logs from Docker containers to Elasticsearch

**Configuration**: `docker/filebeat.yml`

**Features**:
- Automatically discovers Docker containers
- Parses container logs
- Ships to Elasticsearch with metadata

### 5. Kibana (Logs & Traces Visualization)

**Purpose**: Visualization and exploration of logs and traces

**Features**:
- Log exploration and analysis
- Trace visualization
- Index pattern management
- Dashboard creation
- Discover interface for ad-hoc queries

**Access**: http://localhost:5601

**Key Features**:
- Discover: Search and filter logs
- Dashboard: Create visualizations
- APM: View distributed traces (if APM enabled)
- Dev Tools: Query Elasticsearch directly

### 6. Grafana (Metrics Dashboards)

**Purpose**: Metrics visualization and dashboards

**Features**:
- Pre-built dashboards for metrics
- Alerting
- Data source integration

**Access**: http://localhost:3001

**Pre-configured Data Sources**:
1. Prometheus (metrics)

## Setting Up Grafana Dashboards

### 1. Add Data Sources

Grafana should auto-detect data sources, but you can verify:

1. Go to **Configuration** → **Data Sources**
2. Verify:
   - Prometheus: `http://prometheus:9090`
   - Loki: `http://loki:3100`
   - Jaeger: `http://jaeger:16686`

### 2. Import Dashboards

#### Grafana - API Metrics Dashboard

Create a new dashboard with these panels:

**Panel 1: Request Rate**
```promql
sum(rate(http_requests_total[5m])) by (method, endpoint)
```

**Panel 2: Error Rate**
```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) by (endpoint)
```

**Panel 3: Response Time (p95)**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Panel 4: Active Download Jobs**
```promql
download_jobs_total{status="processing"}
```

**Panel 5: Queue Size**
```promql
download_queue_size
```

#### Kibana - Logs Dashboard

1. Go to **Discover** in Kibana
2. Create index pattern: `delineate-logs-*`
3. Search logs:
   ```
   service: "delineate-app" AND level: "error"
   ```
4. Create visualizations and dashboards

#### Kibana - Traces Dashboard

1. Create index pattern: `delineate-traces-*`
2. Use **Discover** to explore traces
3. Filter by trace ID, service name, or operation
4. Create visualizations for trace metrics

## Application Integration

### Environment Variables

Ensure your application has:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

### Code Instrumentation

The application already includes:
- OpenTelemetry SDK initialization
- HTTP instrumentation middleware
- Sentry error tracking

### Adding Custom Metrics

```typescript
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('delineate-service');
const downloadCounter = meter.createCounter('download_jobs_total', {
  description: 'Total number of download jobs',
});

// Increment counter
downloadCounter.add(1, { status: 'completed' });
```

### Adding Custom Spans

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('delineate-service');

async function processDownload(fileId: number) {
  const span = tracer.startSpan('process_download', {
    attributes: {
      'file.id': fileId,
    },
  });
  
  try {
    // Your code here
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

## Monitoring Best Practices

### 1. Key Metrics to Monitor

**Application Health**:
- Request rate and latency
- Error rates
- Queue backlog
- Worker activity

**System Health**:
- CPU and memory usage
- Disk I/O
- Network throughput

**Business Metrics**:
- Downloads completed per hour
- Average download time
- User satisfaction (if tracked)

### 2. Alerting Rules

Create alerts for:

```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m

# Queue backlog
- alert: QueueBacklog
  expr: download_queue_size > 1000
  for: 10m

# Service down
- alert: ServiceDown
  expr: up{job="delineate-api"} == 0
  for: 1m
```

### 3. Logging Best Practices

**Structured Logging**:
```typescript
logger.info('Download initiated', {
  jobId: 'abc123',
  fileIds: [70000],
  userId: 'user123',
  requestId: 'req-xyz',
  traceId: 'trace-abc',  // Link to trace
});
```

**Log Levels**:
- `ERROR`: Errors requiring attention
- `WARN`: Warnings that might need investigation
- `INFO`: Important business events
- `DEBUG`: Detailed debugging information

## Troubleshooting

### Collector Not Receiving Data

1. Check collector logs:
   ```bash
   docker logs otel-collector
   ```

2. Verify endpoint configuration:
   ```bash
   curl http://localhost:4318/v1/traces
   ```

3. Check application environment:
   ```bash
   docker exec delineate-app env | grep OTEL
   ```

### Metrics Not Appearing

1. Check Prometheus targets:
   - http://localhost:9090/targets

2. Verify scrape configuration in `prometheus.yml`

3. Check application exposes `/metrics` endpoint

### Logs Not Showing

1. Check Filebeat logs:
   ```bash
   docker logs filebeat
   ```

2. Verify Elasticsearch is receiving data:
   ```bash
   curl http://localhost:9200/delineate-logs-*/_search?size=1
   ```

3. Check Filebeat configuration paths

4. Verify index exists in Kibana:
   - Go to Kibana → Management → Index Patterns
   - Create pattern: `delineate-logs-*`

### Traces Not Visible

1. Verify Elasticsearch has trace data:
   ```bash
   curl http://localhost:9200/delineate-traces-*/_search?size=1
   ```

2. Check OpenTelemetry Collector logs:
   ```bash
   docker logs otel-collector
   ```

3. Verify OTLP endpoint in collector config

4. Create trace index pattern in Kibana: `delineate-traces-*`

## Performance Considerations

### Resource Usage

Approximate resource requirements:

| Service | CPU | Memory | Disk |
|---------|-----|--------|------|
| Prometheus | 0.5 cores | 2GB | 10GB |
| Elasticsearch | 1 core | 1GB | 20GB |
| Kibana | 0.5 cores | 512MB | 1GB |
| Filebeat | 0.25 cores | 256MB | - |
| Grafana | 0.25 cores | 512MB | 1GB |
| OTEL Collector | 0.25 cores | 512MB | - |
| **Total** | **~2.75 cores** | **~4.8GB** | **~32GB** |

### Retention Policies

- **Prometheus**: 15 days (configurable)
- **Elasticsearch**: 7 days (configurable via index lifecycle management)

Adjust based on your needs and storage capacity.

## Production Recommendations

1. **Separate Networks**: Use separate Docker networks for security
2. **Persistent Volumes**: Ensure all data volumes are persistent
3. **Backup Strategy**: Regular backups of Prometheus and Loki data
4. **Resource Limits**: Set CPU and memory limits for each service
5. **Monitoring**: Monitor the monitoring stack itself
6. **Scaling**: Consider external Prometheus/Loki for high-volume production

## Next Steps

1. Create custom Grafana dashboards for your use case
2. Set up alerting rules in Prometheus
3. Configure log retention policies
4. Add custom metrics for business KPIs
5. Set up trace sampling for high-volume production
