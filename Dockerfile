# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

# Copy manifests for dependency install
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN npm ci

# Copy source
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/web packages/web

# Build all packages
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:24-slim
WORKDIR /app

# Copy compiled server
COPY --from=builder /app/packages/server/dist ./dist

# Copy compiled frontend (served as static files by Express)
COPY --from=builder /app/packages/web/dist ./public

# Copy only production node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/package.json .

# Data volume for SQLite DB
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
