#!/bin/bash

# Pipeline Testing Script
# This script helps you test the CI/CD pipeline components

set -e

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║                    CI/CD Pipeline Testing Guide                              ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

echo "This script will guide you through testing the CI/CD pipeline."
echo ""

# Step 1: Check Git status
print_step "Step 1: Checking Git repository status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    print_success "Git repository detected"
    
    # Check if there are uncommitted changes
    if [[ -n $(git status -s) ]]; then
        print_warning "You have uncommitted changes"
        echo ""
        git status -s
        echo ""
    else
        print_success "Working directory is clean"
    fi
else
    print_error "Not a git repository"
    exit 1
fi
echo ""

# Step 2: Check remote
print_step "Step 2: Checking Git remote..."
if git remote -v | grep -q "origin"; then
    REMOTE_URL=$(git remote get-url origin)
    print_success "Remote origin found: $REMOTE_URL"
else
    print_warning "No remote 'origin' configured"
    echo "  To add remote: git remote add origin <your-repo-url>"
fi
echo ""

# Step 3: Check workflow files
print_step "Step 3: Checking workflow files..."
if [ -f ".github/workflows/ci.yml" ]; then
    print_success "CI workflow found: .github/workflows/ci.yml"
else
    print_error "CI workflow not found!"
    exit 1
fi

if [ -f ".github/workflows/manual-deploy.yml" ]; then
    print_success "Manual deploy workflow found: .github/workflows/manual-deploy.yml"
fi
echo ""

# Step 4: Validate YAML syntax
print_step "Step 4: Validating YAML syntax..."
if command -v yamllint &> /dev/null; then
    yamllint .github/workflows/*.yml && print_success "YAML syntax is valid"
elif command -v python3 &> /dev/null; then
    python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && print_success "YAML syntax is valid"
else
    print_warning "YAML validator not found - skipping syntax check"
    echo "  Install yamllint: pip install yamllint"
fi
echo ""

# Step 5: Check if on GitHub
print_step "Step 5: Checking GitHub integration..."
if git remote get-url origin 2>/dev/null | grep -q "github.com"; then
    print_success "Repository is on GitHub"
    REPO_URL=$(git remote get-url origin | sed 's/\.git$//')
    if [[ $REPO_URL == git@github.com:* ]]; then
        REPO_URL=$(echo $REPO_URL | sed 's/git@github.com:/https:\/\/github.com\//')
    fi
    echo ""
    echo "  📊 View Actions: ${REPO_URL}/actions"
    echo "  🔒 View Security: ${REPO_URL}/security"
    echo "  📝 View Workflows: ${REPO_URL}/tree/main/.github/workflows"
else
    print_warning "Repository is not on GitHub"
    echo "  The CI/CD pipeline requires GitHub Actions"
fi
echo ""

# Step 6: Test instructions
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║                        How to Test the Pipeline                              ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

echo "📋 OPTION 1: Test by Creating a Test Branch"
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "1. Create a test branch:"
echo "   git checkout -b test/ci-pipeline"
echo ""
echo "2. Make a small change (e.g., update README):"
echo "   echo '<!-- CI/CD Test -->' >> README.md"
echo ""
echo "3. Commit and push:"
echo "   git add README.md"
echo "   git commit -m 'test: verify CI/CD pipeline'"
echo "   git push origin test/ci-pipeline"
echo ""
echo "4. Watch the pipeline run:"
if git remote get-url origin 2>/dev/null | grep -q "github.com"; then
    echo "   ${REPO_URL}/actions"
fi
echo ""

echo "📋 OPTION 2: Test by Creating a Pull Request"
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "1. Push your test branch (from Option 1)"
echo ""
echo "2. Go to GitHub and create a Pull Request:"
if git remote get-url origin 2>/dev/null | grep -q "github.com"; then
    echo "   ${REPO_URL}/compare"
fi
echo ""
echo "3. The pipeline will automatically run on the PR"
echo ""
echo "4. Check the status at the bottom of the PR page"
echo ""

echo "📋 OPTION 3: Test Manual Deployment Workflow"
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "1. Go to Actions tab on GitHub:"
if git remote get-url origin 2>/dev/null | grep -q "github.com"; then
    echo "   ${REPO_URL}/actions"
fi
echo ""
echo "2. Select 'Manual Deploy' workflow"
echo ""
echo "3. Click 'Run workflow' button"
echo ""
echo "4. Choose environment and options"
echo ""
echo "5. Click 'Run workflow' to start"
echo ""

echo "📋 OPTION 4: Validate Workflow Locally (GitHub CLI)"
echo "────────────────────────────────────────────────────────────────"
echo ""
if command -v gh &> /dev/null; then
    print_success "GitHub CLI (gh) is installed"
    echo ""
    echo "Run these commands:"
    echo "  gh workflow list                    # List all workflows"
    echo "  gh workflow view ci.yml             # View CI workflow"
    echo "  gh run list                         # List recent runs"
    echo "  gh run watch                        # Watch latest run"
else
    print_warning "GitHub CLI (gh) not installed"
    echo ""
    echo "Install GitHub CLI:"
    echo "  • Ubuntu/Debian: sudo apt install gh"
    echo "  • macOS: brew install gh"
    echo "  • Other: https://cli.github.com/"
    echo ""
    echo "After installation, authenticate:"
    echo "  gh auth login"
fi
echo ""

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║                     What to Check When Testing                               ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

echo "✅ Pipeline Stages to Verify:"
echo "   1. Lint & Format Check - Should pass if code is formatted"
echo "   2. E2E Tests - Should pass if tests are working"
echo "   3. Build Docker Images - Should build dev and prod images"
echo "   4. Security Scanning - Should scan for vulnerabilities"
echo "   5. Deploy (optional) - Only runs on main branch"
echo "   6. Notify - Should aggregate results"
echo ""

echo "✅ Expected Results:"
echo "   • All jobs should show green checkmarks ✓"
echo "   • Build time: ~8-15 minutes (first run)"
echo "   • Build time: ~5-10 minutes (with cache)"
echo "   • Artifacts should be uploaded (test results, Docker images)"
echo "   • Security scan results in Security tab"
echo ""

echo "❌ Common Issues:"
echo "   • Lint failures: Run 'npm run lint:fix' locally"
echo "   • Test failures: Run 'npm run test:e2e' locally"
echo "   • Build failures: Check Dockerfile syntax"
echo "   • Permission errors: Check repository settings"
echo ""

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║                            Quick Test                                        ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

read -p "Do you want to create a test commit now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Creating test branch..."
    
    # Get current branch
    CURRENT_BRANCH=$(git branch --show-current)
    
    # Create test branch
    git checkout -b test/ci-pipeline-$(date +%s) 2>/dev/null || git checkout test/ci-pipeline-$(date +%s)
    
    print_step "Adding test marker to README..."
    echo "" >> README.md
    echo "<!-- CI/CD Pipeline Test - $(date) -->" >> README.md
    
    print_step "Committing changes..."
    git add README.md
    git commit -m "test: verify CI/CD pipeline functionality"
    
    print_success "Test commit created!"
    echo ""
    echo "Next steps:"
    echo "1. Push to GitHub: git push origin $(git branch --show-current)"
    echo "2. View pipeline: ${REPO_URL}/actions"
    echo "3. Create PR if needed: ${REPO_URL}/compare"
    echo ""
    echo "To return to your original branch:"
    echo "  git checkout $CURRENT_BRANCH"
else
    echo ""
    print_success "Test preparation complete!"
    echo ""
    echo "When you're ready, follow the options above to test the pipeline."
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║                     📚 Documentation References                              ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  • Quick Start: .github/QUICK_START.md"
echo "  • Full Guide: .github/CI_CD_GUIDE.md"
echo "  • Deployment: .github/DEPLOYMENT_GUIDE.md"
echo "  • Contributing: CONTRIBUTING.md"
echo ""
echo "✅ Pipeline testing guide complete!"
