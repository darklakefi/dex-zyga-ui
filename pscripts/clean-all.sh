#!/bin/bash
# Remove all containers, volumes and images for this project (fresh slate).
# Uses podman-compose. Run from repo root or pscripts/.

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

echo "🧹 This will remove for this project:"
echo "   - All containers (demo-web, backend, nginx, certbot)"
echo "   - All volumes (demo-web-node-modules, backend-node-modules, certbot-www, certbot-conf)"
echo "   - All images built or used by the compose file"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[yY]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo "🛑 Stopping and removing containers..."
podman-compose -f "$COMPOSE_FILE" down -v --rmi all

echo "✅ All project containers, volumes and images have been removed."
echo ""
echo "💡 Start fresh with: ./pscripts/start-web.sh"
echo "   (Images will be rebuilt on first start.)"
echo ""
