# syntax=docker/dockerfile:1

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 1) 의존성 설치 (better-sqlite3 네이티브 컴파일)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 2) 빌드 (prisma generate → next build)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# 3) 런너 (standalone + 런타임 prisma migrate deploy)
FROM base AS runner
ENV NODE_ENV=production PORT=3010 HOSTNAME=0.0.0.0
RUN groupadd -r nodejs && useradd -r -g nodejs -m nextjs

# standalone 산출물
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 런타임 prisma migrate deploy에 필요한 파일/모듈
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /data && chown -R nextjs:nodejs /data /app

USER nextjs
EXPOSE 3010
ENTRYPOINT ["./docker-entrypoint.sh"]
