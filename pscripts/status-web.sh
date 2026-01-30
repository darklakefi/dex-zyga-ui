#!/bin/bash
# Check status of DEX UI services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose-demo.yml"

echo "🔍 Checking DEX UI Services Status"
echo "===================================="
echo ""

# Check if podman is available
if ! command -v podman &> /dev/null; then
    echo "❌ podman not found"
    exit 1
fi

# Check containers using podman ps
echo "📦 Container Status:"
echo "-------------------"
podman ps -a --filter "name=zyga-ui" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check individual services
echo "🔍 Service Details:"
echo "-------------------"

# Check demo-web
if podman ps --format "{{.Names}}" | grep -q "zyga-ui-demo-web"; then
    echo "✅ demo-web (Next.js) - Running"
    # Check if port 3000 is responding
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "   ✓ Responding on port 3000"
    else
        echo "   ⚠️  Not responding on port 3000 (may still be starting)"
    fi
else
    echo "❌ demo-web - Not running"
fi
echo ""

# Check nginx
if podman ps --format "{{.Names}}" | grep -q "zyga-ui-nginx"; then
    echo "✅ nginx - Running"
    # Check if port 80 is responding
    if curl -s http://localhost:80 > /dev/null 2>&1; then
        echo "   ✓ Responding on port 80 (HTTP)"
    else
        echo "   ⚠️  Not responding on port 80"
    fi
    # Check if port 443 is open
    if nc -z localhost 443 2>/dev/null; then
        echo "   ✓ Port 443 open (HTTPS)"
    else
        echo "   ⚠️  Port 443 not accessible"
    fi
else
    echo "❌ nginx - Not running"
fi
echo ""

# Check certbot
if podman ps --format "{{.Names}}" | grep -q "zyga-ui-certbot"; then
    echo "✅ certbot - Running"
else
    echo "❌ certbot - Not running"
fi
echo ""

# Check if compose file is being used
echo "📋 Compose Status:"
echo "-------------------"
if command -v podman-compose &> /dev/null; then
    podman-compose -f "$COMPOSE_FILE" ps 2>/dev/null || echo "⚠️  No compose services found"
else
    echo "⚠️  podman-compose not installed"
fi
echo ""

# Check volumes
echo "💾 Volumes:"
echo "-------------------"
podman volume ls --filter "name=dex-zyga-ui" --format "table {{.Name}}\t{{.Driver}}\t{{.Mountpoint}}" 2>/dev/null || \
    echo "No volumes found with 'dex-zyga-ui' prefix"
echo ""

# Check logs for errors
echo "📝 Recent Logs (last 10 lines):"
echo "-------------------"
if podman ps --format "{{.Names}}" | grep -q "zyga-ui-nginx"; then
    echo "Nginx logs:"
    podman logs --tail 10 zyga-ui-nginx 2>&1 | tail -10
else
    echo "⚠️  Nginx not running"
fi
echo ""

# Access points
echo "🌐 Access Points:"
echo "-------------------"
echo "- Direct Next.js:    http://localhost:3000"
echo "- Via Nginx (HTTP):  http://localhost:80"
echo "- Via Nginx (HTTPS): https://localhost:443 (if SSL configured)"
echo ""

# Helpful commands
echo "💡 Helpful Commands:"
echo "-------------------"
echo "View logs:          ./pscripts/logs-web.sh [service]"
echo "Restart services:   podman-compose -f $COMPOSE_FILE restart"
echo "Stop services:      ./pscripts/stop-web.sh"
echo "Start services:     ./pscripts/start-web.sh"
