# Branch Protection Rules Guide

## Quick Setup

To enable branch protection for your repository:

1. Go to **Settings** → **Branches** on GitHub
2. Click **Add rule** under "Branch protection rules"
3. Branch name pattern: `main` or `master`
4. Enable these settings:

### Required Settings

- ✅ **Require a pull request before merging**
  - Required approvals: 1
  - Dismiss stale reviews when new commits are pushed

- ✅ **Require status checks to pass before merging**
  - Require branches to be up to date
  - Add required status checks:
    - `lint` (Lint & Format Check)
    - `test` (E2E Tests)
    - `build (dev)` (Build Docker dev)
    - `build (prod)` (Build Docker prod)
    - `security-scan` (Security Scanning)

- ✅ **Require conversation resolution before merging**

- ✅ **Include administrators** (applies rules to admins too)

- ❌ **Allow force pushes** (keep disabled)

- ❌ **Allow deletions** (keep disabled)

## Testing Branch Protection

### Test 1: Direct Push (Should Fail)

```bash
git checkout main
git commit --allow-empty -m "test: direct push"
git push origin main
# Expected: ❌ Remote rejected (protected branch)
```

### Test 2: Pull Request (Should Work)

```bash
git checkout -b feature/test
git commit --allow-empty -m "test: via PR"
git push origin feature/test
# Create PR on GitHub
# Expected: ✅ CI runs, requires approval
```

## Workflow for Contributors

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit
3. Run local checks: `npm run ci:local`
4. Push and create PR
5. Wait for CI to pass + get approval
6. Merge (squash recommended)

## More Information

For detailed setup instructions, troubleshooting, and CODEOWNERS configuration, see the complete guide in the repository documentation.
