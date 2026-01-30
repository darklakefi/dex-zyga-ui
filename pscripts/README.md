# Podman Scripts for DEX UI

Helper scripts to manage the DEX UI using podman-compose.

## Prerequisites

- **Podman**: Container runtime
- **Podman Compose**: Compose support for Podman
  ```bash
  pip install podman-compose
  ```

## Scripts

### `start-web.sh`
Start all services (Next.js, Nginx, Certbot)

```bash
./pscripts/start-web.sh
```

**Features:**
- Loads environment from `.env.local` if present
- Defaults to devnet network
- Starts demo-web, nginx, and certbot services
- Checks service health
- Shows access points and helpful commands

**Access points after starting:**
- Direct Next.js: http://localhost:3000
- Via Nginx (HTTP): http://localhost:80
- Via Nginx (HTTPS): https://localhost:443 (requires SSL setup)

### `stop-web.sh`
Stop all services

```bash
./pscripts/stop-web.sh
```

**To also remove volumes:**
```bash
podman-compose -f docker-compose-demo.yml down -v
```

### `logs-web.sh`
View logs for services

```bash
# View demo-web logs (default)
./pscripts/logs-web.sh

# View nginx logs
./pscripts/logs-web.sh nginx

# View certbot logs
./pscripts/logs-web.sh certbot
```

### `setup-ssl.sh`
Setup SSL certificates using Let's Encrypt

```bash
./pscripts/setup-ssl.sh <domain> [email]
```

**Example:**
```bash
./pscripts/setup-ssl.sh rejewski.vitorpy.com admin@rejewski.vitorpy.com
```

**Requirements:**
- Services must be running
- Domain must point to your server's IP
- Port 80 must be accessible from the internet

**After obtaining certificates:**
1. Edit `docker/nginx/conf.d/nginx.conf`
2. Uncomment the HTTPS server block
3. Reload nginx or restart services

## Network Configuration

The scripts use the network configured in `.env.local`:

```bash
# .env.local
NEXT_PUBLIC_NETWORK=devnet  # or mainnet
NEXT_PUBLIC_HELIUS_API_KEY=your_key_here  # required for mainnet
```

## Troubleshooting

### Services won't start
```bash
# Check if ports are in use
podman ps -a

# Remove old containers
podman-compose -f docker-compose-demo.yml down
```

### SSL certificate errors
If you see SSL errors and don't have certificates yet:
- The app works fine on HTTP (port 80)
- HTTPS is optional and only needed for production
- Follow the setup-ssl.sh instructions to obtain certificates

### View detailed logs
```bash
# All services
podman-compose -f docker-compose-demo.yml logs -f

# Specific service
podman-compose -f docker-compose-demo.yml logs -f demo-web
```

### Rebuild containers
```bash
podman-compose -f docker-compose-demo.yml up -d --build
```

## Manual Commands

If you prefer manual control:

```bash
# Start services
podman-compose -f docker-compose-demo.yml up -d

# Stop services
podman-compose -f docker-compose-demo.yml down

# View status
podman-compose -f docker-compose-demo.yml ps

# View logs
podman-compose -f docker-compose-demo.yml logs -f

# Restart a service
podman-compose -f docker-compose-demo.yml restart demo-web

# Execute command in container
podman-compose -f docker-compose-demo.yml exec demo-web sh
```
