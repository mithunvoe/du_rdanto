# CI/CD Pipeline Testing Guide

This guide shows you exactly how to test the CI/CD pipeline to verify it's working correctly.

## 🎯 Quick Test (Recommended)

The easiest way to test the pipeline is to push a small change to GitHub:

### Step 1: Commit Your Changes

```bash
# Add all the new CI/CD files
git add .

# Commit with a descriptive message
git commit -m "feat: implement CI/CD pipeline for Challenge 3"

# Push to GitHub
git push origin main
```

### Step 2: Watch the Pipeline Run

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. You'll see the "CI/CD Pipeline" workflow running
4. Click on it to see detailed logs

**Your repository**: https://github.com/mithunvoe/du_rdanto/actions

### Step 3: Verify Results

Check that all stages complete successfully:

- ✅ Lint & Format Check
- ✅ E2E Tests
- ✅ Build Docker Images (dev + prod)
- ✅ Security Scanning
- ⏭️ Deploy (skipped - only runs on main branch after merge)
- ✅ Notify

## 📋 Detailed Testing Options

### Option 1: Test with a Feature Branch (Safest)

This is the safest way to test without affecting your main branch:

```bash
# 1. Create a test branch
git checkout -b test/ci-pipeline

# 2. Make sure all files are committed
git add .
git commit -m "test: verify CI/CD pipeline"

# 3. Push to GitHub
git push origin test/ci-pipeline

# 4. Watch the pipeline run
# Go to: https://github.com/mithunvoe/du_rdanto/actions
```

**What happens:**

- Pipeline runs automatically on push
- All 6 stages execute
- You can see detailed logs for each step
- No changes to main branch

### Option 2: Test with a Pull Request

This tests the PR workflow:

```bash
# 1. Push your test branch (from Option 1)
git push origin test/ci-pipeline

# 2. Go to GitHub and create a Pull Request
# Visit: https://github.com/mithunvoe/du_rdanto/compare

# 3. Select: base: main <- compare: test/ci-pipeline

# 4. Click "Create Pull Request"
```

**What happens:**

- Pipeline runs on the PR
- Status checks appear at the bottom of the PR
- You can see which checks passed/failed
- Merge is blocked if checks fail (with branch protection)

### Option 3: Test Manual Deployment Workflow

Test the manual deployment feature:

```bash
# 1. Go to Actions tab on GitHub
# Visit: https://github.com/mithunvoe/du_rdanto/actions

# 2. Click "Manual Deploy" in the left sidebar

# 3. Click "Run workflow" button (top right)

# 4. Select options:
#    - Environment: development
#    - Skip tests: false (recommended)

# 5. Click "Run workflow"
```

**What happens:**

- Workflow runs with your selected options
- You can deploy to different environments
- Useful for testing deployment configurations

### Option 4: Use GitHub CLI (Advanced)

If you have GitHub CLI installed:

```bash
# List all workflows
gh workflow list

# View the CI workflow
gh workflow view ci.yml

# List recent workflow runs
gh run list

# Watch the latest run in real-time
gh run watch

# View logs of a specific run
gh run view <run-id> --log
```

## 🔍 What to Check During Testing

### 1. Lint & Format Check Stage

**Expected**: ✅ Pass
**Duration**: ~1-2 minutes

**Checks**:

- ESLint runs without errors
- Prettier formatting is correct
- Dependencies install successfully

**If it fails**:

```bash
# Fix locally
npm run lint:fix
npm run format
git add .
git commit -m "fix: resolve linting issues"
git push
```

### 2. E2E Tests Stage

**Expected**: ✅ Pass
**Duration**: ~2-5 minutes

**Checks**:

- All E2E tests pass
- Server starts correctly
- API endpoints respond

**If it fails**:

```bash
# Test locally
npm run test:e2e

# Check logs for specific errors
# Fix the issues and push again
```

### 3. Build Docker Images Stage

**Expected**: ✅ Pass (both dev and prod)
**Duration**: ~3-5 minutes (first run), ~1-2 minutes (cached)

**Checks**:

- Dev Dockerfile builds successfully
- Prod Dockerfile builds successfully
- Images are saved as artifacts

**If it fails**:

```bash
# Test locally
docker build -f docker/Dockerfile.prod -t test:prod .
docker build -f docker/Dockerfile.dev -t test:dev .

# Check for syntax errors in Dockerfiles
```

### 4. Security Scanning Stage

**Expected**: ✅ Pass (or warnings for non-critical issues)
**Duration**: ~2-3 minutes

**Checks**:

- Trivy scans Docker images
- Vulnerabilities are reported
- SARIF report uploaded to Security tab

**View results**:

- Go to: https://github.com/mithunvoe/du_rdanto/security
- Click "Code scanning alerts"

**If it fails**:

- Check severity levels (CRITICAL, HIGH)
- Update base images or dependencies
- Some warnings are acceptable

### 5. Deploy Stage

**Expected**: ⏭️ Skipped (unless on main branch)
**Duration**: N/A (placeholder)

**Note**: This stage only runs when pushing to main/master branch. It's currently a placeholder - you need to configure your deployment target.

### 6. Notify Stage

**Expected**: ✅ Pass
**Duration**: ~10 seconds

**Checks**:

- Aggregates all job results
- Reports overall status
- (Notifications disabled by default)

## 📊 Expected Results

### First Run (No Cache)

- **Total time**: ~8-15 minutes
- **Stages**: All 6 stages run
- **Artifacts**: Test results + Docker images uploaded
- **Cache**: Created for future runs

### Subsequent Runs (With Cache)

- **Total time**: ~5-10 minutes
- **Speedup**: 30-50% faster
- **Cache hit**: Dependencies and Docker layers reused

### Success Indicators

- ✅ All jobs show green checkmarks
- ✅ No red X marks
- ✅ Artifacts are uploaded
- ✅ Security scan completes
- ✅ Build time is reasonable

## ❌ Troubleshooting Common Issues

### Issue: "Lint & Format Check" fails

**Cause**: Code style violations

**Solution**:

```bash
npm run lint:fix
npm run format
git add .
git commit -m "fix: resolve linting issues"
git push
```

### Issue: "E2E Tests" fail

**Cause**: Test failures or environment issues

**Solution**:

```bash
# Run tests locally to see errors
npm run test:e2e

# Check specific test failures
# Fix the code causing failures
# Push again
```

### Issue: "Build Docker Images" fails

**Cause**: Dockerfile syntax errors or missing files

**Solution**:

```bash
# Test build locally
docker build -f docker/Dockerfile.prod .

# Check error messages
# Fix Dockerfile issues
# Ensure all required files are included
```

### Issue: "Security Scanning" fails

**Cause**: Critical vulnerabilities detected

**Solution**:

```bash
# Install Trivy locally
# Ubuntu: sudo apt install trivy
# macOS: brew install trivy

# Scan locally
trivy image your-image:tag

# Update dependencies or base images
# Push again
```

### Issue: "Permission denied" errors

**Cause**: GitHub Actions permissions

**Solution**:

1. Go to repository Settings
2. Click "Actions" → "General"
3. Under "Workflow permissions"
4. Select "Read and write permissions"
5. Click "Save"

### Issue: Workflow doesn't trigger

**Cause**: Workflow file not in correct location or syntax error

**Solution**:

```bash
# Verify file location
ls -la .github/workflows/ci.yml

# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"

# Ensure file is committed and pushed
git status
git add .github/workflows/ci.yml
git commit -m "fix: add CI workflow"
git push
```

## 🎓 Using the Test Script

We've created a helper script to guide you through testing:

```bash
# Run the test script
bash scripts/test-pipeline.sh

# Or make it executable and run
chmod +x scripts/test-pipeline.sh
./scripts/test-pipeline.sh
```

**The script will**:

- Check your Git repository status
- Verify workflow files exist
- Validate YAML syntax
- Show you testing options
- Optionally create a test commit

## 📸 What Success Looks Like

### In GitHub Actions Tab

```
✅ CI/CD Pipeline #1
   ✅ Lint & Format Check (1m 23s)
   ✅ E2E Tests (3m 45s)
   ✅ Build Docker Images (4m 12s)
      ✅ dev (2m 05s)
      ✅ prod (2m 07s)
   ✅ Security Scanning (2m 34s)
   ⏭️ Deploy (skipped)
   ✅ Notify (8s)

Total time: 11m 54s
```

### In Pull Request

```
All checks have passed
✅ Lint & Format Check
✅ E2E Tests
✅ Build Docker Images
✅ Security Scanning

This branch has no conflicts with the base branch
Merging can be performed automatically
```

## 🚀 Next Steps After Testing

Once the pipeline passes:

1. **Merge your changes** (if using a test branch)

   ```bash
   # Via GitHub UI or command line
   gh pr merge --squash
   ```

2. **Set up branch protection** (recommended)
   - Go to Settings → Branches
   - Add rule for `main` branch
   - Require status checks to pass

3. **Configure deployment** (optional)
   - Choose a platform (Railway, Render, Fly.io)
   - Add secrets to GitHub
   - Uncomment deployment section in workflow

4. **Set up notifications** (optional)
   - Get Slack/Discord webhook URL
   - Add to GitHub secrets
   - Uncomment notification section

## 📚 Additional Resources

- **Quick Start**: `.github/QUICK_START.md`
- **Full CI/CD Guide**: `.github/CI_CD_GUIDE.md`
- **Deployment Guide**: `.github/DEPLOYMENT_GUIDE.md`
- **Contributing**: `CONTRIBUTING.md`

## ✅ Testing Checklist

Before considering testing complete:

- [ ] Pipeline runs automatically on push
- [ ] All stages complete successfully
- [ ] Artifacts are uploaded
- [ ] Security scan results appear in Security tab
- [ ] Build time is reasonable (5-15 minutes)
- [ ] Cache is working (subsequent runs faster)
- [ ] PR checks work correctly
- [ ] Manual deployment workflow is accessible

---

**Need help?** Check the troubleshooting section above or review the detailed guides in `.github/` folder.
