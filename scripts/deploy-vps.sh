#!/bin/bash
#
# VPS Deployment Script
# This script is run on the VPS to deploy the application
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Project directory
PROJECT_DIR="/home/ubuntu/du_rdanto"

# Navigate to project directory or clone if it doesn't exist
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}📁 Project directory exists, updating...${NC}"
    cd "$PROJECT_DIR"
else
    echo -e "${YELLOW}📁 Cloning repository...${NC}"
    cd /home/ubuntu
    git clone https://github.com/mithunvoe/du_rdanto.git
    cd du_rdanto
fi

# Pull latest changes
echo -e "${YELLOW}📥 Pulling latest code from GitHub...${NC}"
git fetch origin main
git reset --hard origin/main

# Check if user is in docker group, add sudo if needed
if groups | grep -q docker; then
    DOCKER_CMD="docker"
else
    echo -e "${YELLOW}⚠️  User not in docker group, using sudo${NC}"
    DOCKER_CMD="sudo docker"
fi

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
$DOCKER_CMD compose -f docker/compose.prod.yml down || true

# Remove old images to save space (optional)
echo -e "${YELLOW}🧹 Cleaning up old Docker images...${NC}"
$DOCKER_CMD image prune -f || true

# Build and start containers
echo -e "${YELLOW}🏗️  Building and starting containers...${NC}"
$DOCKER_CMD compose -f docker/compose.prod.yml up --build -d

# Wait for containers to start
echo -e "${YELLOW}⏳ Waiting for containers to start...${NC}"
sleep 5

# Show running containers
echo -e "${GREEN}✅ Deployment complete! Running containers:${NC}"
$DOCKER_CMD compose -f docker/compose.prod.yml ps

# Show logs (last 30 lines)
echo -e "${GREEN}📋 Recent logs:${NC}"
$DOCKER_CMD compose -f docker/compose.prod.yml logs --tail=30

# Health check
echo -e "${YELLOW}🔍 Checking API health...${NC}"
sleep 3
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")

if [ "$response" = "200" ] || [ "$response" = "503" ]; then
    echo -e "${GREEN}✅ API is responding (HTTP $response)${NC}"
    echo -e "${GREEN}🎉 Deployment successful!${NC}"
    echo -e "${GREEN}🔗 Access the API at: http://36.255.70.236:3000${NC}"
    echo -e "${GREEN}📚 API Docs at: http://36.255.70.236:3000/docs${NC}"
else
    echo -e "${RED}⚠️  Warning: API health check failed (HTTP $response)${NC}"
    echo -e "${YELLOW}Check the logs above for more details${NC}"
    exit 1
fi
