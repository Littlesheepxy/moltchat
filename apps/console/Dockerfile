# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy root package files for monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy console package
COPY apps/console/package.json ./apps/console/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter console...

# Copy console source
COPY apps/console ./apps/console

# Build
WORKDIR /app/apps/console
ENV NEXT_TELEMETRY_DISABLED=1
# Set required env vars for build (will be overridden at runtime)
ENV BETTER_AUTH_SECRET=build-time-placeholder-secret-change-in-production
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build from the correct path
COPY --from=builder /app/apps/console/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/console/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/console/.next/static ./apps/console/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The standalone output creates server.js in the app directory
CMD ["node", "apps/console/server.js"]
