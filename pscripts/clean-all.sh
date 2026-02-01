#!/bin/bash
# Remove all containers, non-cert volumes and images for this project (fresh slate).
# Keeps cert volumes (certbot-www, certbot-conf). Uses podman-compose.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose-demo.yml"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"

# Check if podman-compose is installed
if ! command -v podman-compose &> /dev/null; then
    echo "❌ podman-compose not found. Install it with: pip install podman-compose"
    exit 1
fi

echo "🧹 This will remove for this project:"
echo "   - All containers (demo-web, backend, nginx, certbot)"
echo "   - Non-cert volumes (demo-web-node-modules, backend-node-modules)"
echo "   - All images built or used by the compose file"
echo "   (Cert volumes certbot-www, certbot-conf are kept.)"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[yY]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo "🛑 Stopping and removing containers and images..."
podman-compose -f "$COMPOSE_FILE" down --rmi all

echo "🗑️  Removing non-cert volumes (node_modules caches only)..."
for v in "${PROJECT_NAME}_demo-web-node-modules" "${PROJECT_NAME}_backend-node-modules" \
         "demo-web-node-modules" "backend-node-modules"; do
    podman volume rm "$v" 2>/dev/null && echo "   removed $v" || true
done

echo "✅ Containers, non-cert volumes and images removed. Cert volumes kept."
echo ""
echo "💡 Start fresh with: ./pscripts/start-web.sh"
echo "   (Images will be rebuilt on first start.)"
echo ""
