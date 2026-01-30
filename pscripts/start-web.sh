#!/bin/bash
# Start DEX UI using podman-compose

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose-demo.yml"

# Check if podman-compose is installed
if ! command -v podman-compose &> /dev/null; then
    echo "❌ podman-compose not found. Install it with: pip install podman-compose"
    exit 1
fi

# Check if podman is installed
if ! command -v podman &> /dev/null; then
    echo "❌ podman not found. Install podman first"
    exit 1
fi

# Check if already running
if podman-compose -f "$COMPOSE_FILE" ps | grep -q "zyga-ui-demo-web.*Up"; then
    echo "⚠️  DEX UI is already running"
    echo "📊 Status:"
    podman-compose -f "$COMPOSE_FILE" ps
    exit 0
fi

# Load environment variables if .env.local exists
if [ -f ".env.local" ]; then
    echo "📋 Loading environment from .env.local"
    export $(grep -v '^#' .env.local | xargs)
fi

# Set default environment variables for devnet
export NEXT_PUBLIC_NETWORK=${NEXT_PUBLIC_NETWORK:-devnet}
export HELIUS_API_KEY=${NEXT_PUBLIC_HELIUS_API_KEY:-}

echo "🚀 Starting DEX UI with podman-compose..."
echo "   Network: $NEXT_PUBLIC_NETWORK"
echo "   Compose file: $COMPOSE_FILE"
echo ""

# Start services
podman-compose -f "$COMPOSE_FILE" up -d

echo ""
echo "✅ Services started!"
echo ""
echo "📊 Container status:"
podman-compose -f "$COMPOSE_FILE" ps
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if Next.js is responding
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Next.js dev server is responding on port 3000"
else
    echo "⚠️  Next.js may still be starting up..."
fi

# Check if nginx is responding
if curl -s http://localhost:80 > /dev/null 2>&1; then
    echo "✅ Nginx is responding on port 80"
else
    echo "⚠️  Nginx may still be starting up..."
fi

echo ""
echo "🌐 Access points:"
echo "   - Direct Next.js: http://localhost:3000"
echo "   - Via Nginx (HTTP): http://localhost:80"
echo "   - Via Nginx (HTTPS): https://localhost:443 (if SSL configured)"
echo ""
echo "📝 View logs:"
echo "   podman-compose -f $COMPOSE_FILE logs -f"
echo ""
echo "🛑 Stop services:"
echo "   podman-compose -f $COMPOSE_FILE down"
echo ""
