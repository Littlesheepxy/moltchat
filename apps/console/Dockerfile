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

# Accept build arguments for Next.js public env vars
ARG NEXT_PUBLIC_GATEWAY_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ELEMENT_URL
ARG NEXT_PUBLIC_MATRIX_HOMESERVER_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Set env vars for build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV BETTER_AUTH_SECRET=build-time-placeholder-secret-change-in-production
ENV NEXT_PUBLIC_GATEWAY_URL=${NEXT_PUBLIC_GATEWAY_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_ELEMENT_URL=${NEXT_PUBLIC_ELEMENT_URL}
ENV NEXT_PUBLIC_MATRIX_HOMESERVER_URL=${NEXT_PUBLIC_MATRIX_HOMESERVER_URL}
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}

RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build from the correct path
COPY --from=builder /app/apps/console/public ./apps/console/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/console/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/console/.next/static ./apps/console/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The standalone output creates server.js in the app directory
CMD ["node", "apps/console/server.js"]
