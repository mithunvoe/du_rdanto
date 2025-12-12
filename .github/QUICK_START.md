# Quick Start Guide - CI/CD Pipeline

This is a quick reference for using the CI/CD pipeline. For detailed information, see the full guides.

## 🚀 For First-Time Contributors

### 1. Setup Your Environment

```bash
# Clone the repository
git clone https://github.com/bongodev/cuet-micro-ops-hackthon-2025.git
cd cuet-micro-ops-hackthon-2025

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Verify setup
npm run ci:check
```

### 2. Make Your Changes

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... edit files ...

# Test locally
npm run ci:local
```

### 3. Submit Your Changes

```bash
# Stage and commit
git add .
git commit -m "feat: your feature description"

# Push to GitHub
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

## 🔍 Quick Commands

### Local Testing

```bash
# Run all CI checks locally
npm run ci:check

# Or run individually
npm run lint              # Check code quality
npm run format:check      # Check formatting
npm run test:e2e          # Run tests

# Fix issues automatically
npm run lint:fix          # Fix linting issues
npm run format            # Fix formatting
```

### Docker Testing

```bash
# Build and test locally
docker build -f docker/Dockerfile.prod -t test:prod .
docker run -p 3000:3000 test:prod

# Or use Docker Compose
npm run docker:dev        # Development mode
npm run docker:prod       # Production mode
```

## 📋 Pipeline Stages

When you push or create a PR, the pipeline runs:

1. **Lint** (1-2 min) - Code quality checks
2. **Test** (2-5 min) - E2E tests
3. **Build** (3-5 min) - Docker images
4. **Security** (2-3 min) - Vulnerability scan
5. **Deploy** (optional) - Only on main branch
6. **Notify** - Build status

**Total time**: ~8-15 minutes

## ✅ Checklist Before Pushing

- [ ] Code follows style guidelines
- [ ] All tests pass locally
- [ ] No linting errors
- [ ] Code is formatted
- [ ] Commit message follows conventions
- [ ] Branch is up to date with main

## 🐛 Common Issues

### Issue: Tests fail locally

```bash
# Check if server is already running
lsof -ti:3000 | xargs kill -9

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests again
npm run test:e2e
```

### Issue: Linting errors

```bash
# Auto-fix most issues
npm run lint:fix
npm run format

# Check what's left
npm run lint
```

### Issue: Docker build fails

```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -f docker/Dockerfile.prod .
```

## 📚 Documentation Links

- **Full CI/CD Guide**: `.github/CI_CD_GUIDE.md`
- **Contributing Guide**: `CONTRIBUTING.md`
- **Deployment Guide**: `.github/DEPLOYMENT_GUIDE.md`
- **Implementation Summary**: `CI_CD_IMPLEMENTATION.md`

## 🎯 Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code restructuring
- `test` - Tests
- `chore` - Maintenance

**Examples**:

```bash
git commit -m "feat(api): add webhook support"
git commit -m "fix(docker): resolve S3 connection issue"
git commit -m "docs(readme): update installation steps"
```

## 🔐 Security

- Never commit secrets or API keys
- Use environment variables
- Check `.gitignore` before committing
- Review changes before pushing

## 🆘 Getting Help

1. Check documentation in `.github/` folder
2. Search existing issues on GitHub
3. Ask in discussions
4. Create a new issue with details

## 🎉 Success Indicators

Your PR is ready to merge when:

- ✅ All pipeline checks pass (green checkmarks)
- ✅ No merge conflicts
- ✅ Code review approved
- ✅ All conversations resolved

## 📊 Pipeline Status

View pipeline status:

- **Actions tab**: `https://github.com/bongodev/cuet-micro-ops-hackthon-2025/actions`
- **Your PR**: Check status at the bottom of PR page
- **Badge**: ![CI/CD Status](https://github.com/bongodev/cuet-micro-ops-hackthon-2025/actions/workflows/ci.yml/badge.svg)

## 🚀 Manual Deployment

Trigger manual deployment:

1. Go to **Actions** tab
2. Select **Manual Deploy** workflow
3. Click **Run workflow**
4. Choose environment (development/staging/production)
5. Click **Run workflow** button

## 💡 Pro Tips

1. **Run checks before committing** to catch issues early
2. **Keep commits small** for easier review
3. **Write clear commit messages** for better history
4. **Update tests** when changing functionality
5. **Check pipeline logs** if something fails
6. **Ask for help** if stuck

## 🎓 Learning Resources

- [GitHub Actions Basics](https://docs.github.com/en/actions/learn-github-actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Testing](https://nodejs.org/en/docs/guides/testing/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Need more details?** Check the comprehensive guides in the `.github/` folder!
