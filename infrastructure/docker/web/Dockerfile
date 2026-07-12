# syntax=docker/dockerfile:1
# Build context PHẢI là root monorepo (không phải apps/web) vì cần packages/shared.
#
# Dùng Next.js `output: standalone` (xem apps/web/next.config.ts) — build ra server.js
# tự chứa (tracing tối thiểu node_modules cần thiết), gọn hơn nhiều so với copy cả
# node_modules của workspace. Kết hợp turbo prune để bước cài đặt cũng chỉ tải đúng
# phần phụ thuộc của app "web".

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# ---------- 1. Prune: chỉ lấy phần liên quan tới "web" ----------
FROM base AS pruner
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY . .
RUN npx --yes turbo@2 prune web --docker

# ---------- 2. Cài dependencies & build ----------
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS builder
WORKDIR /app
COPY --from=pruner /app/out/full/ .

ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* được inline lúc build — truyền qua --build-arg khi docker compose build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN pnpm turbo build --filter=web...

# ---------- 3. Runtime image: chỉ copy output standalone ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN chown -R nextjs:nodejs /app
USER nextjs

ENV PORT=1112
ENV HOSTNAME=0.0.0.0
EXPOSE 1112

CMD ["node", "apps/web/server.js"]
