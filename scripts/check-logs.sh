#!/bin/bash

# Script to verify backend logs are being collected

echo "=== Checking Docker Containers ==="
docker ps --filter "name=delineate-app" --format "table {{.Names}}\t{{.Status}}" || docker ps --filter "name=delineate-delineate-app" --format "table {{.Names}}\t{{.Status}}"

echo -e "\n=== Checking Promtail Logs ==="
docker logs promtail --tail 20 2>&1 | grep -i "error\|warn\|targets\|scrape" || echo "No errors found in Promtail logs"

echo -e "\n=== Checking Loki Health ==="
curl -s http://localhost:3100/ready || echo "Loki not accessible"

echo -e "\n=== Checking if logs are in Loki ==="
echo "Querying Loki for backend logs..."
curl -s -G "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={container=~".*delineate.*app.*"}' \
  --data-urlencode 'limit=5' \
  --data-urlencode 'start='$(date -d '5 minutes ago' +%s)000000000 \
  --data-urlencode 'end='$(date +%s)000000000 | jq -r '.data.result[0].values[]?[1]' 2>/dev/null | head -5 || echo "No logs found or Loki not accessible (jq may not be installed)"

echo -e "\n=== Direct Docker Logs (for comparison) ==="
BACKEND_CONTAINER=$(docker ps --filter "name=delineate-app" --format "{{.Names}}" | head -1)
if [ -z "$BACKEND_CONTAINER" ]; then
  BACKEND_CONTAINER=$(docker ps --filter "name=delineate-delineate-app" --format "{{.Names}}" | head -1)
fi
if [ -n "$BACKEND_CONTAINER" ]; then
  echo "Found container: $BACKEND_CONTAINER"
  docker logs "$BACKEND_CONTAINER" --tail 5 2>&1
else
  echo "Backend container not found"
fi

echo -e "\n=== Grafana Access ==="
echo "Access Grafana at: http://localhost:3001"
echo "Username: admin"
echo "Password: admin"
echo "Go to: Explore -> Select 'Loki' -> Query: {container=~\"delineate-app\"}"

