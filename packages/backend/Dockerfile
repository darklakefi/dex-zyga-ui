# Backend Dockerfile for Zyga Proof Generator
FROM node:20-slim

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libudev-dev \
    libusb-1.0-0-dev \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

# Set working directory for the monorepo
WORKDIR /workspace

# Copy workspace configuration and root lockfile
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy backend package.json
COPY packages/backend/package.json ./packages/backend/

# Install dependencies using workspace (frozen lockfile)
RUN pnpm install --frozen-lockfile --filter @dex-zyga-ui/backend...

# Copy proof-generation into image (used when host volume doesn't have it)
COPY packages/backend/proof-generation /opt/proof-generation
RUN chmod +x /opt/proof-generation/zyga

# Copy entrypoint and set working directory to backend
COPY packages/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /workspace/packages/backend

# Expose port
EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
# Start server in development mode
CMD ["pnpm", "run", "dev"]
