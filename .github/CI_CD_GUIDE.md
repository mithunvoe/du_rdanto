# CI/CD Pipeline Guide

This document provides detailed information about the CI/CD pipeline setup for the Delineate Hackathon Challenge project.

## Overview

The project uses **GitHub Actions** for continuous integration and deployment. The pipeline automatically runs on every push and pull request to ensure code quality, functionality, and security.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CI/CD Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                              │
│  │   Trigger    │  Push to main/master or Pull Request         │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │  Lint Check  │  ESLint + Prettier                           │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │  E2E Tests   │  Full test suite                             │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │ Build Images │  Docker (dev + prod) in parallel             │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │Security Scan │  Trivy vulnerability scanning                │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │    Deploy    │  Optional deployment (main branch only)      │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │    Notify    │  Build status notifications                  │
│  └──────────────┘                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Pipeline Stages

### 1. Lint & Format Check

**Purpose**: Ensure code quality and consistent formatting

**Steps**:

- Checkout code
- Cache npm dependencies
- Install dependencies
- Run ESLint
- Check Prettier formatting

**Duration**: ~1-2 minutes

**Failure Reasons**:

- ESLint errors (code quality issues)
- Formatting violations
- Dependency installation failures

**How to Fix**:

```bash
# Fix linting issues
npm run lint:fix

# Fix formatting issues
npm run format

# Verify locally
npm run lint
npm run format:check
```

### 2. E2E Tests

**Purpose**: Validate API functionality and business logic

**Steps**:

- Checkout code
- Cache npm dependencies
- Install dependencies
- Run E2E test suite
- Upload test results as artifacts

**Duration**: ~2-5 minutes

**Environment Variables**:

- `NODE_ENV=development`
- `PORT=3000`
- `DOWNLOAD_DELAY_MIN_MS=5000`
- `DOWNLOAD_DELAY_MAX_MS=15000`
- Other configuration variables

**Failure Reasons**:

- Test failures
- API errors
- Timeout issues
- Environment configuration problems

**How to Fix**:

```bash
# Run tests locally
npm run test:e2e

# Run with verbose output
NODE_ENV=development npm run test:e2e

# Check server logs for errors
```

### 3. Build Docker Images

**Purpose**: Verify Docker images build successfully

**Steps**:

- Checkout code
- Set up Docker Buildx
- Build dev and prod images in parallel
- Use layer caching for faster builds
- Save images as artifacts

**Duration**: ~3-5 minutes (with cache)

**Matrix Strategy**:

- Builds both `Dockerfile.dev` and `Dockerfile.prod`
- Runs in parallel for efficiency

**Failure Reasons**:

- Dockerfile syntax errors
- Missing dependencies
- Build context issues
- Layer caching problems

**How to Fix**:

```bash
# Build locally
docker build -f docker/Dockerfile.prod -t test:prod .
docker build -f docker/Dockerfile.dev -t test:dev .

# Check for errors
docker build --no-cache -f docker/Dockerfile.prod .
```

### 4. Security Scanning

**Purpose**: Detect vulnerabilities in Docker images

**Steps**:

- Download built Docker image
- Load image into Docker
- Run Trivy vulnerability scanner
- Upload results to GitHub Security
- Display table output

**Duration**: ~2-3 minutes

**Severity Levels**:

- CRITICAL - Must fix immediately
- HIGH - Should fix soon
- MEDIUM - Fix when possible
- LOW - Optional fix

**Failure Reasons**:

- Critical or high severity vulnerabilities
- Scanner configuration issues
- Image loading problems

**How to Fix**:

```bash
# Install Trivy locally
# Ubuntu/Debian
sudo apt-get install trivy

# macOS
brew install trivy

# Scan image locally
trivy image delineate-hackathon-challenge:prod

# Update base image or dependencies to fix vulnerabilities
```

### 5. Deploy (Optional)

**Purpose**: Automatically deploy to cloud platform

**Trigger**: Only on push to main/master branch

**Supported Platforms**:

- Railway
- Render
- Fly.io
- Custom deployment

**Configuration Required**:

1. Uncomment deployment section in `.github/workflows/ci.yml`
2. Add required secrets to GitHub repository
3. Configure deployment target

**Duration**: ~2-10 minutes (depends on platform)

### 6. Notify

**Purpose**: Send build status notifications

**Steps**:

- Check all job statuses
- Aggregate results
- Send notifications (if configured)

**Supported Platforms**:

- Slack
- Discord
- Email
- Custom webhooks

## Performance Optimizations

### Dependency Caching

The pipeline caches npm dependencies to speed up builds:

```yaml
- name: Cache node modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

**Benefits**:

- Reduces build time by 30-50%
- Saves bandwidth
- Improves reliability

### Docker Layer Caching

Docker builds use GitHub Actions cache:

```yaml
cache-from: type=gha,scope=${{ matrix.dockerfile }}
cache-to: type=gha,mode=max,scope=${{ matrix.dockerfile }}
```

**Benefits**:

- Faster Docker builds (2-3x speedup)
- Reduced build time
- Lower resource usage

### Parallel Execution

Docker images build in parallel using matrix strategy:

```yaml
strategy:
  matrix:
    dockerfile: [dev, prod]
```

**Benefits**:

- 50% faster than sequential builds
- Better resource utilization
- Faster feedback

### Concurrency Control

Cancels in-progress runs for the same branch:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Benefits**:

- Saves CI/CD minutes
- Faster feedback on latest changes
- Reduced queue times

## Configuration

### Environment Variables

Set these in GitHub repository settings under **Settings > Secrets and variables > Actions**:

#### Deployment Secrets

**Railway**:

```
RAILWAY_TOKEN=your_railway_token
```

**Render**:

```
RENDER_DEPLOY_HOOK_URL=your_render_deploy_hook_url
```

**Fly.io**:

```
FLY_API_TOKEN=your_fly_api_token
```

#### Notification Secrets

**Slack**:

```
SLACK_WEBHOOK=your_slack_webhook_url
```

**Discord**:

```
DISCORD_WEBHOOK=your_discord_webhook_url
```

### Branch Protection Rules

Recommended settings for main/master branch:

1. **Require pull request reviews before merging**
   - Required approvals: 1
   - Dismiss stale reviews: Yes

2. **Require status checks to pass before merging**
   - Required checks:
     - Lint & Format Check
     - E2E Tests
     - Build Docker Images
     - Security Scanning

3. **Require branches to be up to date before merging**
   - Yes

4. **Require conversation resolution before merging**
   - Yes

5. **Do not allow bypassing the above settings**
   - Yes (except for administrators if needed)

### Setting Up Branch Protection

1. Go to repository **Settings > Branches**
2. Click **Add rule**
3. Branch name pattern: `main` (or `master`)
4. Configure settings as above
5. Click **Create** or **Save changes**

## Monitoring and Debugging

### Viewing Pipeline Results

**Actions Tab**:

- URL: `https://github.com/bongodev/cuet-micro-ops-hackthon-2025/actions`
- View all workflow runs
- See detailed logs for each step
- Download artifacts

**Security Tab**:

- URL: `https://github.com/bongodev/cuet-micro-ops-hackthon-2025/security`
- View vulnerability scan results
- See security advisories
- Track security issues

**Pull Requests**:

- See check status directly on PR pages
- View detailed check results
- Re-run failed checks

**Commit History**:

- See check status badges next to each commit
- Quick status overview

### Debugging Failed Builds

1. **Check the logs**:
   - Click on the failed job
   - Expand the failed step
   - Read error messages

2. **Reproduce locally**:

   ```bash
   # Run the same commands locally
   npm ci
   npm run lint
   npm run format:check
   npm run test:e2e
   docker build -f docker/Dockerfile.prod .
   ```

3. **Check environment**:
   - Verify Node.js version (>= 24.10.0)
   - Check npm version (>= 10.x)
   - Ensure Docker is running

4. **Review recent changes**:
   - Check what changed in the failing commit
   - Compare with previous successful builds
   - Look for configuration changes

### Common Issues and Solutions

#### Issue: npm ci fails

**Cause**: package-lock.json out of sync

**Solution**:

```bash
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "chore: update package-lock.json"
```

#### Issue: Tests timeout

**Cause**: Long-running operations or server not starting

**Solution**:

- Check server startup logs
- Increase timeout values
- Verify environment variables
- Check for port conflicts

#### Issue: Docker build fails

**Cause**: Missing files or incorrect context

**Solution**:

```bash
# Check .dockerignore
cat .dockerignore

# Verify files are included
docker build --no-cache -f docker/Dockerfile.prod .

# Check build context
docker build --progress=plain -f docker/Dockerfile.prod .
```

#### Issue: Security scan fails

**Cause**: Critical vulnerabilities detected

**Solution**:

- Update base image version
- Update npm dependencies
- Apply security patches
- Review Trivy output for specific CVEs

## Best Practices

### For Developers

1. **Run checks locally before pushing**

   ```bash
   npm run lint && npm run format:check && npm run test:e2e
   ```

2. **Keep commits small and focused**
   - One feature or fix per commit
   - Clear commit messages
   - Easy to review and revert

3. **Update tests with code changes**
   - Add tests for new features
   - Update tests for bug fixes
   - Maintain test coverage

4. **Monitor pipeline results**
   - Check status after pushing
   - Fix failures quickly
   - Don't ignore warnings

### For Maintainers

1. **Review pipeline regularly**
   - Check for slow steps
   - Optimize caching
   - Update dependencies

2. **Keep secrets secure**
   - Rotate tokens regularly
   - Use least privilege access
   - Don't log sensitive data

3. **Monitor costs**
   - Track CI/CD minutes usage
   - Optimize build times
   - Use caching effectively

4. **Update documentation**
   - Keep this guide current
   - Document new steps
   - Share knowledge

## Extending the Pipeline

### Adding New Jobs

1. Edit `.github/workflows/ci.yml`
2. Add new job definition:
   ```yaml
   new-job:
     name: New Job Name
     runs-on: ubuntu-24.04
     needs: [previous-job]
     steps:
       - name: Checkout
         uses: actions/checkout@v4
       - name: Run task
         run: echo "Task here"
   ```

### Adding New Checks

1. Add script to `package.json`:

   ```json
   "scripts": {
     "check:new": "your-command-here"
   }
   ```

2. Add step to workflow:
   ```yaml
   - name: Run new check
     run: npm run check:new
   ```

### Adding Deployment Targets

1. Choose deployment platform
2. Get API token or webhook URL
3. Add secret to GitHub repository
4. Uncomment and configure deployment step
5. Test deployment

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy)
- [GitHub Actions Cache](https://github.com/actions/cache)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Support

If you encounter issues with the CI/CD pipeline:

1. Check this documentation
2. Review GitHub Actions logs
3. Search existing issues
4. Create a new issue with:
   - Pipeline run URL
   - Error messages
   - Steps to reproduce
   - Environment details
