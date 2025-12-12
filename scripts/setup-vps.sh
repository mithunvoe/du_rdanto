#!/bin/bash
#
# VPS Initial Setup Script
# Run this once on your VPS to set up Docker and the project
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up VPS for deployment...${NC}"

# Update system packages
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt-get update

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}🐳 Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Install Docker Compose if not installed
if ! command -v docker compose &> /dev/null; then
    echo -e "${YELLOW}🐳 Installing Docker Compose...${NC}"
    sudo apt-get install -y docker-compose-plugin
    echo -e "${GREEN}✅ Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

# Install Git if not installed
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}📚 Installing Git...${NC}"
    sudo apt-get install -y git
    echo -e "${GREEN}✅ Git installed successfully${NC}"
else
    echo -e "${GREEN}✅ Git already installed${NC}"
fi

# Clone repository if not exists
PROJECT_DIR="/home/ubuntu/du_rdanto"
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}📁 Cloning repository...${NC}"
    cd /home/ubuntu
    git clone https://github.com/mithunvoe/du_rdanto.git
    cd du_rdanto
    echo -e "${GREEN}✅ Repository cloned successfully${NC}"
else
    echo -e "${GREEN}✅ Repository already exists${NC}"
fi

# Create .env file if it doesn't exist
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo -e "${GREEN}✅ .env file created (you may need to update it)${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Set proper permissions
echo -e "${YELLOW}🔐 Setting permissions...${NC}"
sudo chown -R $USER:$USER $PROJECT_DIR

echo -e "${GREEN}✅ VPS setup complete!${NC}"
echo -e ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "1. Update the .env file if needed: ${PROJECT_DIR}/.env"
echo -e "2. Run the deployment script: bash ${PROJECT_DIR}/scripts/deploy-vps.sh"
echo -e "3. Or push to GitHub main branch to trigger automatic deployment"
echo -e ""
echo -e "${GREEN}🔗 Once deployed, access the API at: http://36.255.70.236:3000${NC}"
echo -e "${GREEN}📚 API Docs: http://36.255.70.236:3000/docs${NC}"
