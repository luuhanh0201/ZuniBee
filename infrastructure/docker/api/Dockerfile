# syntax=docker/dockerfile:1
# Build context PHẢI là root monorepo (không phải apps/api) vì cần packages/shared.
#
# Dùng `turbo prune` để chỉ giữ lại phần package.json/lockfile/source cần cho app "api"
# trong monorepo pnpm — giảm hẳn thời gian cài đặt và cache layer tốt hơn so với copy
# nguyên repo rồi `pnpm install` toàn bộ workspace.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# ---------- 1. Prune: chỉ lấy phần liên quan tới "api" ----------
FROM base AS pruner
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY . .
RUN npx --yes turbo@2 prune api --docker

# ---------- 2. Cài dependencies đầy đủ (có devDependencies) để build ----------
FROM base AS installer
WORKDIR /app
# bcrypt cần build native module trên musl (Alpine) nếu không có prebuilt binary
RUN apk add --no-cache python3 make g++
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS builder
WORKDIR /app
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=api...

# ---------- 3. Cài lại chỉ production dependencies (image gọn hơn) ----------
FROM base AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --frozen-lockfile

# ---------- 4. Runtime image ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache \
      poppler-utils \
      tesseract-ocr \
      tesseract-ocr-data-eng \
      tesseract-ocr-data-vie \
  && addgroup -S nodejs \
  && adduser -S nestjs -G nodejs

# node_modules production (giữ nguyên cấu trúc symlink workspace của pnpm)
COPY --from=prod-deps /app .
# Overlay code đã build
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

RUN mkdir -p /app/apps/api/uploads/avatars /app/apps/api/protected-uploads/classroom-materials /app/apps/api/secrets \
  && chown -R nestjs:nodejs /app/apps/api/uploads /app/apps/api/protected-uploads /app/apps/api/secrets

USER nestjs
WORKDIR /app/apps/api
EXPOSE 2223

CMD ["node", "dist/main.js"]
