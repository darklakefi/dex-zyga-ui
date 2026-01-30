#!/bin/bash
# Setup SSL certificates using certbot

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose-demo.yml"
DOMAIN=${1:-rejewski.vitorpy.com}
EMAIL=${2:-admin@${DOMAIN}}

if [ -z "$1" ]; then
    echo "Usage: $0 <domain> [email]"
    echo ""
    echo "Example:"
    echo "  $0 rejewski.vitorpy.com admin@rejewski.vitorpy.com"
    echo ""
    exit 1
fi

# Check if nginx container is running
if ! podman ps --format "{{.Names}}" | grep -q "zyga-ui-nginx"; then
    echo "❌ Nginx is not running. Start services first:"
    echo "   ./pscripts/start-web.sh"
    echo ""
    echo "💡 To check container status:"
    echo "   podman ps -a | grep nginx"
    exit 1
fi

echo "✅ Nginx container is running"

echo "🔐 Setting up SSL certificates for: $DOMAIN"
echo "   Email: $EMAIL"
echo ""

# Run certbot to obtain certificates using the running certbot service
echo "📝 Running certbot..."
podman exec zyga-ui-certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL certificates obtained successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Edit docker/nginx/conf.d/nginx.conf"
    echo "2. Uncomment the HTTPS server block (lines starting with #)"
    echo "3. Update server_name to: $DOMAIN"
    echo "4. Reload nginx:"
    echo "   podman-compose -f $COMPOSE_FILE exec nginx nginx -s reload"
    echo ""
    echo "🔄 Or restart all services:"
    echo "   ./pscripts/stop-web.sh && ./pscripts/start-web.sh"
else
    echo ""
    echo "❌ Failed to obtain SSL certificates"
    echo ""
    echo "Make sure:"
    echo "1. Domain $DOMAIN points to this server's IP address"
    echo "2. Port 80 is accessible from the internet"
    echo "3. No firewall is blocking the connection"
fi
