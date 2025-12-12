# VPS Deployment Guide

This guide explains how to set up automatic deployment to your VPS (36.255.70.236) when code is pushed to the `main` branch.

## 🎯 Overview

The deployment system uses GitHub Actions to automatically:

1. Detect pushes to the `main` branch
2. SSH into your VPS
3. Pull the latest code
4. Rebuild and restart Docker containers
5. Verify the deployment

## 📋 Prerequisites

- VPS with SSH access (ubuntu@36.255.70.236)
- SSH key file: `DU_RDANTO_KEYPAIR.pem`
- Docker and Docker Compose installed on VPS
- GitHub repository: https://github.com/mithunvoe/du_rdanto

## 🚀 Initial Setup

### Step 1: Set up GitHub Secrets

You need to add the SSH key to GitHub Secrets so the workflow can connect to your VPS.

1. Go to your GitHub repository: https://github.com/mithunvoe/du_rdanto
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

#### VPS_SSH_KEY

- **Name**: `VPS_SSH_KEY`
- **Value**: The contents of `DU_RDANTO_KEYPAIR.pem` (entire file)
  ```
  -----BEGIN RSA PRIVATE KEY-----
  [Your key content here]
  -----END RSA PRIVATE KEY-----
  ```

#### VPS_HOST

- **Name**: `VPS_HOST`
- **Value**: `36.255.70.236`

#### VPS_USER

- **Name**: `VPS_USER`
- **Value**: `ubuntu`

### Step 2: Initial VPS Setup

Run this command from your local machine to set up the VPS:

```bash
# Copy the setup script to VPS
scp -i DU_RDANTO_KEYPAIR.pem scripts/setup-vps.sh ubuntu@36.255.70.236:~/

# SSH into VPS
ssh -i DU_RDANTO_KEYPAIR.pem ubuntu@36.255.70.236

# Run the setup script
bash setup-vps.sh
```

This script will:

- Install Docker and Docker Compose
- Install Git
- Clone the repository
- Create `.env` file
- Set proper permissions

### Step 3: Configure Environment Variables (Optional)

If you need custom environment variables on the VPS:

```bash
# SSH into VPS
ssh -i DU_RDANTO_KEYPAIR.pem ubuntu@36.255.70.236

# Edit the .env file
cd ~/du_rdanto
nano .env

# Update any necessary variables, then save
```

## 🔄 Automatic Deployment

Once setup is complete, deployments happen automatically!

### How it Works

1. **Push to main branch**:

   ```bash
   git push origin main
   ```

2. **GitHub Actions triggers** the deployment workflow

3. **Workflow executes** these steps:
   - Connects to VPS via SSH
   - Pulls latest code from GitHub
   - Stops existing Docker containers
   - Rebuilds containers with new code
   - Starts containers
   - Verifies deployment

4. **Access your deployed app**:
   - API: http://36.255.70.236:3000
   - Docs: http://36.255.70.236:3000/docs
   - Health: http://36.255.70.236:3000/health

### Manual Deployment

You can also trigger deployment manually:

#### Option 1: Via GitHub Actions UI

1. Go to: https://github.com/mithunvoe/du_rdanto/actions
2. Click **Deploy to VPS** workflow
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

#### Option 2: Via SSH (Direct)

```bash
# SSH into VPS
ssh -i DU_RDANTO_KEYPAIR.pem ubuntu@36.255.70.236

# Run the deployment script
cd ~/du_rdanto
bash scripts/deploy-vps.sh
```

## 📊 Monitoring Deployment

### Via GitHub Actions

1. Go to: https://github.com/mithunvoe/du_rdanto/actions
2. Click on the latest workflow run
3. View logs for each step
4. Check deployment summary

### Via SSH

```bash
# SSH into VPS
ssh -i DU_RDANTO_KEYPAIR.pem ubuntu@36.255.70.236

# View running containers
docker compose -f ~/du_rdanto/docker/compose.prod.yml ps

# View logs
docker compose -f ~/du_rdanto/docker/compose.prod.yml logs -f

# Check API health
curl http://localhost:3000/health
```

## 🔍 Troubleshooting

### Deployment Failed

**Check GitHub Actions logs**:

1. Go to Actions tab
2. Click on failed workflow run
3. Read error messages in logs

**Check VPS logs**:

```bash
ssh -i DU_RDANTO_KEYPAIR.pem ubuntu@36.255.70.236
cd ~/du_rdanto
docker compose -f docker/compose.prod.yml logs --tail=100
```

### API Not Responding

```bash
# Check if containers are running
docker compose -f docker/compose.prod.yml ps

# Restart containers
docker compose -f docker/compose.prod.yml restart

# Rebuild from scratch
docker compose -f docker/compose.prod.yml down
docker compose -f docker/compose.prod.yml up --build -d
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process (if needed)
sudo kill -9 <PID>

# Restart containers
docker compose -f docker/compose.prod.yml up -d
```

### Disk Space Issues

```bash
# Clean up Docker
docker system prune -a -f

# Remove old images
docker image prune -a -f

# Check disk usage
df -h
```

## 🔐 Security Best Practices

1. **Never commit the .pem file** - It's in `.gitignore`
2. **Keep GitHub Secrets secure** - Only repo admins can view them
3. **Use environment protection** - The workflow uses `production` environment
4. **Regular updates**: Keep VPS packages updated
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```

## 📁 File Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy-vps.yml          # Deployment workflow
├── scripts/
│   ├── deploy-vps.sh               # Deployment script for VPS
│   └── setup-vps.sh                # Initial VPS setup script
├── docker/
│   └── compose.prod.yml            # Production Docker Compose
└── DU_RDANTO_KEYPAIR.pem          # SSH key (DO NOT COMMIT)
```

## 🎓 Deployment Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Deployment Process                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Developer pushes to main                                    │
│     └─→ git push origin main                                    │
│                                                                 │
│  2. GitHub Actions triggered                                    │
│     └─→ deploy-vps.yml workflow starts                          │
│                                                                 │
│  3. SSH connection to VPS                                       │
│     └─→ Using VPS_SSH_KEY secret                                │
│                                                                 │
│  4. Pull latest code                                            │
│     └─→ git fetch && git reset --hard origin/main               │
│                                                                 │
│  5. Stop containers                                             │
│     └─→ docker compose down                                     │
│                                                                 │
│  6. Rebuild & start                                             │
│     └─→ docker compose up --build -d                            │
│                                                                 │
│  7. Verify deployment                                           │
│     └─→ Health check on port 3000                               │
│                                                                 │
│  8. Deployment complete                                         │
│     └─→ API accessible at http://36.255.70.236:3000            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔗 Quick Links

- **VPS IP**: 36.255.70.236
- **API URL**: http://36.255.70.236:3000
- **API Docs**: http://36.255.70.236:3000/docs
- **GitHub Actions**: https://github.com/mithunvoe/du_rdanto/actions
- **Repository**: https://github.com/mithunvoe/du_rdanto

## 📝 Common Commands

```bash
# SSH into VPS
ssh -i DU_RDANTO_KEYPAIR.pem ubuntu@36.255.70.236

# View deployment status
cd ~/du_rdanto && docker compose -f docker/compose.prod.yml ps

# View logs (follow mode)
docker compose -f docker/compose.prod.yml logs -f

# Restart application
docker compose -f docker/compose.prod.yml restart

# Stop application
docker compose -f docker/compose.prod.yml down

# Start application
docker compose -f docker/compose.prod.yml up -d

# Rebuild and restart
docker compose -f docker/compose.prod.yml up --build -d

# Manual deployment
bash ~/du_rdanto/scripts/deploy-vps.sh
```

## 🎉 That's It!

Your VPS is now set up for automatic deployment. Every push to `main` will automatically update your production server!

For questions or issues, check the troubleshooting section or review the GitHub Actions logs.
