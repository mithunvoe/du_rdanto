# Branch Protection Rules Guide

## Overview

To ensure code quality and maintain a stable main branch, it's recommended to set up branch protection rules on GitHub. This document guides you through configuring these rules for the repository.

## Why Branch Protection?

Branch protection rules help enforce:

- ✅ All tests must pass before merging
- ✅ Code review requirements
- ✅ Prevent accidental direct commits to main
- ✅ Ensure CI/CD pipeline runs successfully
- ✅ Maintain code quality standards

## Setting Up Branch Protection

### Step 1: Navigate to Settings

1. Go to your repository on GitHub
2. Click on **Settings** (top right)
3. In the left sidebar, click **Branches** under "Code and automation"

### Step 2: Add Branch Protection Rule

1. Click **Add rule** or **Add branch protection rule**
2. In "Branch name pattern" enter: `main` (or `master` if that's your default branch)

### Step 3: Configure Protection Settings

#### Required Settings (Recommended)

**Require a pull request before merging**

- ✅ Enable this option
- Set "Required approvals" to at least **1**
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners (optional, if you have CODEOWNERS file)

**Require status checks to pass before merging**

- ✅ Enable this option
- ✅ Require branches to be up to date before merging
- Add required status checks:
  - `lint` - Lint & Format Check
  - `test` - E2E Tests
  - `build (dev)` - Build Docker Images (dev)
  - `build (prod)` - Build Docker Images (prod)
  - `security-scan` - Security Scanning

**Require conversation resolution before merging**

- ✅ Enable this to ensure all PR comments are resolved

**Include administrators**

- ✅ Enable to apply these rules to repository administrators too

**Restrict who can push to matching branches**

- Optional: Specify users/teams who can bypass restrictions
- Leave empty to apply to everyone

**Allow force pushes**

- ❌ Keep this disabled to prevent history rewriting

**Allow deletions**

- ❌ Keep this disabled to prevent accidental branch deletion

#### Optional but Recommended Settings

**Require linear history**

- ✅ Enable to prevent merge commits (requires rebase or squash)

**Require deployments to succeed before merging**

- Optional: If you have automated deployments to staging

**Lock branch**

- ❌ Keep disabled unless you want to make the branch read-only

**Do not allow bypassing the above settings**

- ✅ Enable for maximum protection

### Step 4: Save Changes

Click **Create** or **Save changes** at the bottom of the page.

## Testing Branch Protection

### Test 1: Direct Push to Main (Should Fail)

```bash
# Try to push directly to main
git checkout main
git commit --allow-empty -m "test: direct push"
git push origin main
# Expected: ❌ Remote rejected (protected branch)
```

### Test 2: Pull Request (Should Succeed)

```bash
# Create a feature branch
git checkout -b feature/test-protection
git commit --allow-empty -m "test: via pull request"
git push origin feature/test-protection

# Create PR on GitHub
# Expected: ✅ PR created, CI runs, requires approval and passing checks
```

## Current CI/CD Checks

The following checks will automatically run on every PR:

| Check                   | Description                         | Fail Conditions                           |
| ----------------------- | ----------------------------------- | ----------------------------------------- |
| **Lint & Format Check** | ESLint and Prettier checks          | Code style violations                     |
| **E2E Tests**           | End-to-end test suite               | Any test failures                         |
| **Build (dev)**         | Build development Docker image      | Build errors, missing dependencies        |
| **Build (prod)**        | Build production Docker image       | Build errors, optimization issues         |
| **Security Scanning**   | Trivy vulnerability scan            | CRITICAL or HIGH severity vulnerabilities |
| **Notify**              | Build status notification (summary) | N/A (informational)                       |

## Workflow for Contributors

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

```bash
# Make your code changes
git add .
git commit -m "feat: your feature description"
```

### 3. Run Local Checks

```bash
# Run all CI checks locally before pushing
npm run ci:local

# Or run individually
npm run lint
npm run format:check
npm run test:e2e
```

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
# Create PR on GitHub
```

### 5. Wait for CI and Review

- ✅ CI/CD pipeline runs automatically
- ✅ All checks must pass (green ✓)
- ✅ At least 1 reviewer approves
- ✅ All conversations resolved

### 6. Merge PR

- Use **Squash and merge** (recommended) for clean history
- Or **Rebase and merge** to maintain individual commits
- Avoid **Merge commit** unless specifically needed

## Bypassing Protection (Emergency Only)

If you absolutely need to bypass protection rules (e.g., hotfix):

### Option 1: Grant Temporary Bypass

1. Settings → Branches → Edit rule
2. Add yourself to "Allow specified actors to bypass required pull requests"
3. Push your changes
4. **Immediately remove yourself** from bypass list

### Option 2: Admin Override

GitHub repository admins can bypass protection rules, but this is **not recommended** except in emergencies.

## CODEOWNERS File (Optional Enhancement)

Create a `.github/CODEOWNERS` file to automatically request reviews from specific teams/users:

```
# Default owners for everything in the repo
* @mithunvoe

# CI/CD files require DevOps team review
/.github/workflows/ @mithunvoe
/docker/ @mithunvoe

# API code requires backend team review
/src/ @mithunvoe
```

## Troubleshooting

### "Required status check is expected but not present"

**Cause**: You added a status check name that doesn't match the actual job name in `.github/workflows/ci.yml`

**Solution**: Verify job names in the workflow file match exactly (case-sensitive)

### "This branch is out of date with the base branch"

**Cause**: Main branch has new commits since your branch was created

**Solution**:

```bash
git checkout main
git pull
git checkout your-feature-branch
git rebase main  # or: git merge main
git push --force-with-lease
```

### CI Fails Only on GitHub, Not Locally

**Cause**: Different environment or missing secrets

**Solution**:

- Check GitHub Actions logs for specific error
- Verify environment variables in workflow file
- Ensure all required secrets are set in repository settings

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [CODEOWNERS Documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub Actions Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)
