# Backend Dockerfile for Zyga Proof Generator
FROM node:20-alpine

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

# Set working directory to backend
WORKDIR /workspace/packages/backend

# Expose port
EXPOSE 4000

# Start server in development mode
CMD ["pnpm", "run", "dev"]
