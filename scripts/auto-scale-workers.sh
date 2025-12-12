#!/bin/bash

# Auto-scaling script for download workers
# Monitors Redis queue size and scales workers up/down automatically
#
# Usage:
#   chmod +x scripts/auto-scale-workers.sh
#   ./scripts/auto-scale-workers.sh [compose-file] [options]
#
# Options:
#   --min-workers N    Minimum number of workers (default: 1)
#   --max-workers N    Maximum number of workers (default: 10)
#   --queue-threshold N  Queue size threshold for scaling up (default: 50)
#   --scale-down-threshold N  Queue size threshold for scaling down (default: 10)
#   --check-interval N  Check interval in seconds (default: 30)

set -euo pipefail

# Default configuration
COMPOSE_FILE="${1:-docker/compose.prod.yml}"
MIN_WORKERS=1
MAX_WORKERS=10
QUEUE_THRESHOLD=50
SCALE_DOWN_THRESHOLD=10
CHECK_INTERVAL=30

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --min-workers)
      MIN_WORKERS="$2"
      shift 2
      ;;
    --max-workers)
      MAX_WORKERS="$2"
      shift 2
      ;;
    --queue-threshold)
      QUEUE_THRESHOLD="$2"
      shift 2
      ;;
    --scale-down-threshold)
      SCALE_DOWN_THRESHOLD="$2"
      shift 2
      ;;
    --check-interval)
      CHECK_INTERVAL="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Validate inputs
if [ "$MIN_WORKERS" -lt 1 ] || [ "$MAX_WORKERS" -lt "$MIN_WORKERS" ]; then
  echo "Error: Invalid worker count configuration"
  exit 1
fi

echo "========================================="
echo "Download Worker Auto-Scaler"
echo "========================================="
echo "Compose file: $COMPOSE_FILE"
echo "Min workers: $MIN_WORKERS"
echo "Max workers: $MAX_WORKERS"
echo "Scale up threshold: $QUEUE_THRESHOLD jobs"
echo "Scale down threshold: $SCALE_DOWN_THRESHOLD jobs"
echo "Check interval: ${CHECK_INTERVAL}s"
echo "========================================="
echo ""

# Function to get current queue size
get_queue_size() {
  docker exec delineate-redis redis-cli LLEN queue:downloads 2>/dev/null || echo "0"
}

# Function to get current worker count
get_current_workers() {
  docker ps --filter "name=delineate-worker" --format "{{.Names}}" 2>/dev/null | wc -l || echo "0"
}

# Function to scale workers
scale_workers() {
  local target_count=$1
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Scaling workers to $target_count..."
  docker compose -f "$COMPOSE_FILE" up --scale delineate-worker=$target_count -d
  sleep 5  # Wait for containers to start/stop
}

# Main loop
while true; do
  QUEUE_SIZE=$(get_queue_size)
  CURRENT_WORKERS=$(get_current_workers)
  
  # Remove leading/trailing whitespace
  QUEUE_SIZE=$(echo "$QUEUE_SIZE" | tr -d '[:space:]')
  CURRENT_WORKERS=$(echo "$CURRENT_WORKERS" | tr -d '[:space:]')
  
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Queue: $QUEUE_SIZE jobs | Workers: $CURRENT_WORKERS"
  
  # Scale up logic
  if [ "$QUEUE_SIZE" -gt "$QUEUE_THRESHOLD" ] && [ "$CURRENT_WORKERS" -lt "$MAX_WORKERS" ]; then
    NEW_WORKERS=$((CURRENT_WORKERS + 1))
    echo "  ⬆️  Scaling UP: Queue size ($QUEUE_SIZE) > threshold ($QUEUE_THRESHOLD)"
    scale_workers "$NEW_WORKERS"
  
  # Scale down logic
  elif [ "$QUEUE_SIZE" -lt "$SCALE_DOWN_THRESHOLD" ] && [ "$CURRENT_WORKERS" -gt "$MIN_WORKERS" ]; then
    NEW_WORKERS=$((CURRENT_WORKERS - 1))
    echo "  ⬇️  Scaling DOWN: Queue size ($QUEUE_SIZE) < threshold ($SCALE_DOWN_THRESHOLD)"
    scale_workers "$NEW_WORKERS"
  
  else
    echo "  ✓ No scaling needed"
  fi
  
  echo ""
  sleep "$CHECK_INTERVAL"
done

