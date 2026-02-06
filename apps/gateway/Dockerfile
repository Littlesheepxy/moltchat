# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy root package files for monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy gateway package
COPY apps/gateway/package.json ./apps/gateway/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter gateway...

# Copy gateway source
COPY apps/gateway ./apps/gateway

# Build
WORKDIR /app/apps/gateway
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy gateway package.json
COPY apps/gateway/package.json ./apps/gateway/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter gateway --prod

# Copy built files
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist

# Set environment
ENV NODE_ENV=production

WORKDIR /app/apps/gateway

# Expose port
EXPOSE 3002

# Start
CMD ["node", "dist/index.js"]
