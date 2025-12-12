#!/bin/bash

echo "🚀 Setting up Long-Running Download Architecture Demo"
echo "=================================================="

# Check if Redis is running
if ! command -v redis-cli &> /dev/null; then
    echo "❌ Redis is not installed. Please install Redis first:"
    echo "   - Ubuntu/Debian: sudo apt install redis-server"
    echo "   - macOS: brew install redis"
    echo "   - Or use Docker: docker run -d -p 6379:6379 redis:alpine"
    exit 1
fi

# Check Redis connection
if ! redis-cli ping &> /dev/null; then
    echo "❌ Redis is not running. Please start Redis:"
    echo "   - Service: sudo systemctl start redis"
    echo "   - Direct: redis-server"
    echo "   - Docker: docker run -d -p 6379:6379 redis:alpine"
    exit 1
fi

echo "✅ Redis is running"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
pnpm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
pnpm install
cd ..

echo ""
echo "🎉 Setup complete! Now you can run the demo:"
echo ""
echo "Terminal 1 - Start Backend:"
echo "  npm run start"
echo ""
echo "Terminal 2 - Start Worker:"
echo "  npm run worker"
echo ""
echo "Terminal 3 - Start Frontend:"
echo "  cd frontend && pnpm run dev"
echo ""
echo "Then open: http://localhost:5173"
echo ""
echo "📋 Test with these file IDs:"
echo "  Available: 70000,70007,70014,70021"
echo "  Unavailable: 70001,70002,70003"