#!/bin/bash
# Stop DEX UI using podman-compose

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

echo "🛑 Stopping DEX UI services..."
podman-compose -f "$COMPOSE_FILE" down

echo "✅ All services stopped"
echo ""
echo "💡 To remove volumes as well, run:"
echo "   podman-compose -f $COMPOSE_FILE down -v"
