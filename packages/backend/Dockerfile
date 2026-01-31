# Backend Dockerfile for Zyga Proof Generator
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

# Set working directory
WORKDIR /app

# Copy backend package files
COPY packages/backend/package.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy backend source (includes proof-generation folder)
COPY packages/backend ./

# Build backend
RUN pnpm run build

# Expose port
EXPOSE 4000

# Start server
CMD ["pnpm", "run", "start"]
