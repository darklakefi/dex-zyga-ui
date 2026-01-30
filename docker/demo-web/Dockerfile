# Dockerfile for Next.js DEX UI
FROM node:20-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Expose Next.js default port
EXPOSE 3000

# Start development server
CMD ["pnpm", "run", "dev"]
