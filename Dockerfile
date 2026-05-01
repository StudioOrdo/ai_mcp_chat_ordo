# ── Stage 1: install dependencies ────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

# ── Stage 2: build the Next.js application ──────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
ENV ANTHROPIC_API_KEY=docker-build-placeholder
ENV OPENAI_API_KEY=docker-build-placeholder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

# ── Stage 3: production runner ───────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/app/.data
ENV STUDIO_ORDO_DB_PATH=/app/.data/local.db
ENV STUDIO_ORDO_BLOG_ASSET_ROOT=/app/.data/blog-assets
ENV MEDIA_WORKER_PORT=3101

RUN apk add --no-cache ffmpeg

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the production build, runtime scripts, and source needed by the deferred worker.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/docs ./docs
COPY --from=builder --chown=nextjs:nodejs /app/release ./release
COPY --from=builder --chown=nextjs:nodejs /app/config ./config
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/mcp ./mcp
COPY --from=builder --chown=nextjs:nodejs /app/src ./src

RUN mkdir -p /app/.data /app/.runtime-logs /app/.next/cache/images \
 && chown -R nextjs:nodejs /app/.data /app/.runtime-logs /app/.next/cache

VOLUME ["/app/.data"]

USER nextjs
EXPOSE 3000

CMD ["node", "scripts/start-server.mjs"]
