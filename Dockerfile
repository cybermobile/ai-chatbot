# Dockerfile for AI Chatbot

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build MCP server
RUN npm run build:mcp

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

# Note: Database migration happens at runtime, not build time
# Skip next build for now due to Vercel Workflow issues
# We'll run in dev mode instead
# RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV development
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install cifs-utils for Windows share mounting
RUN apk add --no-cache cifs-utils

# Copy files
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

# Copy MCP server build
COPY --from=builder /app/lib/mcp-servers/dist ./lib/mcp-servers/dist

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Run migrations and start app
CMD ["sh", "-c", "npm run migrate:db 2>/dev/null || true && npm run dev"]
