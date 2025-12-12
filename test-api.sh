#!/bin/bash

echo "🧪 Testing Long-Running Download API"
echo "===================================="

API_BASE="http://localhost:3000"

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s "$API_BASE/health" | jq '.' || echo "❌ Health check failed"
echo ""

# Test 2: Initiate download
echo "2. Initiating download job..."
RESPONSE=$(curl -s -X POST "$API_BASE/v1/download/initiate" \
  -H "Content-Type: application/json" \
  -d '{"file_ids": [70000, 70007]}')

echo "$RESPONSE" | jq '.'
JOB_ID=$(echo "$RESPONSE" | jq -r '.job_id')

if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
  echo "❌ Failed to get job ID"
  exit 1
fi

echo "✅ Job created: $JOB_ID"
echo ""

# Test 3: Check job status
echo "3. Checking job status..."
sleep 2
curl -s "$API_BASE/v1/download/status/$JOB_ID" | jq '.'
echo ""

# Test 4: Monitor progress (polling simulation)
echo "4. Monitoring progress for 30 seconds..."
for i in {1..6}; do
  echo "Check $i/6..."
  STATUS_RESPONSE=$(curl -s "$API_BASE/v1/download/status/$JOB_ID")
  echo "$STATUS_RESPONSE" | jq '.status, .progress'
  
  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    echo "✅ Job finished with status: $STATUS"
    echo "$STATUS_RESPONSE" | jq '.results'
    break
  fi
  
  sleep 5
done

echo ""
echo "🎉 API test completed!"
echo "💡 Try the frontend at http://localhost:5173 for the full experience"