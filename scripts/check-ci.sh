#!/bin/bash

# CI Pre-flight Check Script
# Run this before pushing to catch issues early

set -e

echo "🚀 Running CI pre-flight checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        exit 1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 24 ]; then
    print_status 0 "Node.js version: $(node -v)"
else
    print_status 1 "Node.js version must be >= 24.10.0 (current: $(node -v))"
fi
echo ""

# Check npm version
echo "Checking npm version..."
NPM_VERSION=$(npm -v | cut -d'.' -f1)
if [ "$NPM_VERSION" -ge 10 ]; then
    print_status 0 "npm version: $(npm -v)"
else
    print_status 1 "npm version must be >= 10.x (current: $(npm -v))"
fi
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm ci
    print_status $? "Dependencies installed"
    echo ""
fi

# Run linting
echo "Running ESLint..."
npm run lint > /dev/null 2>&1
print_status $? "ESLint passed"
echo ""

# Check formatting
echo "Checking code formatting..."
npm run format:check > /dev/null 2>&1
print_status $? "Prettier formatting check passed"
echo ""

# Run tests
echo "Running E2E tests..."
npm run test:e2e > /dev/null 2>&1
TEST_RESULT=$?
if [ $TEST_RESULT -eq 0 ]; then
    print_status 0 "E2E tests passed"
else
    print_status 1 "E2E tests failed - run 'npm run test:e2e' for details"
fi
echo ""

# Check Docker (optional)
if command -v docker &> /dev/null; then
    echo "Checking Docker build..."
    docker build -f docker/Dockerfile.prod -t ci-check:test . > /dev/null 2>&1
    DOCKER_RESULT=$?
    if [ $DOCKER_RESULT -eq 0 ]; then
        print_status 0 "Docker build successful"
        docker rmi ci-check:test > /dev/null 2>&1
    else
        print_warning "Docker build failed - check Dockerfile.prod"
    fi
else
    print_warning "Docker not found - skipping Docker build check"
fi
echo ""

# Check for common issues
echo "Checking for common issues..."

# Check for console.log statements
if grep -r "console\.log" src/ --exclude-dir=node_modules > /dev/null 2>&1; then
    print_warning "Found console.log statements in src/ - consider using proper logging"
else
    print_status 0 "No console.log statements found"
fi

# Check for TODO comments
TODO_COUNT=$(grep -r "TODO" src/ --exclude-dir=node_modules | wc -l)
if [ "$TODO_COUNT" -gt 0 ]; then
    print_warning "Found $TODO_COUNT TODO comments"
else
    print_status 0 "No TODO comments found"
fi

# Check for .env file
if [ ! -f ".env" ]; then
    print_warning ".env file not found - copy from .env.example"
else
    print_status 0 ".env file exists"
fi

echo ""
echo -e "${GREEN}✅ All checks passed! Ready to push.${NC}"
echo ""
echo "Next steps:"
echo "  1. git add ."
echo "  2. git commit -m 'your message'"
echo "  3. git push"
