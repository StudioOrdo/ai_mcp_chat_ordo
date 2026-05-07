ARG NODE_VERSION=22.22.2

# ── Stage 1: install dependencies ────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

# ── Stage 1b: build Rust hard-state executors ────────────────────────
FROM rust:1-alpine AS rust-builder
WORKDIR /app
RUN apk add --no-cache musl-dev pkgconfig openssl-dev
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo build --release -p ordo-backup

# ── Stage 2: build the Next.js application ──────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

# ── Stage 3: production runner ───────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
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

# Copy the production build, runtime scripts, and source needed by supervised TypeScript workers.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/docs/_corpus ./docs/_corpus
COPY --from=builder --chown=nextjs:nodejs /app/release/manifest.json ./release/manifest.json
COPY --from=builder --chown=nextjs:nodejs /app/config ./config
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/mcp ./mcp
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=rust-builder --chown=nextjs:nodejs /app/target/release/ordo-backup ./bin/ordo-backup

RUN mkdir -p /app/.data /app/.runtime-logs /app/.next/cache/images \
 && chown -R nextjs:nodejs /app/.data /app/.runtime-logs /app/.next/cache /app/bin

VOLUME ["/app/.data"]

USER nextjs
EXPOSE 3000

CMD ["node", "scripts/start-server.mjs"]
