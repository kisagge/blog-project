# syntax=docker/dockerfile:1

# 공통 베이스 — 런타임/빌드 모두가 쓰는 최소 구성(빌드 툴 없음)
FROM node:26-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# 네이티브 컴파일용 베이스 — better-sqlite3 빌드에 필요한 python3/make/g++.
# 이 툴들은 "설치 시"에만 필요하고 런타임엔 불필요하므로 runner에는 포함하지 않는다.
FROM base AS build-base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# 1) 의존성 설치 (better-sqlite3 네이티브 컴파일)
FROM build-base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# 2) 빌드 (prisma generate → next build)
FROM build-base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# 2.5) 런타임 의존성만 설치 — devDependencies(eslint/vitest/tailwind/typescript 등) 제외.
#      Prisma 7은 드라이버 어댑터(better-sqlite3)를 쓰므로 런타임 쿼리에 엔진 바이너리 불필요.
#      prisma CLI(migrate)·dotenv(prisma.config)는 dependencies로 옮겨 여기 포함됨.
FROM build-base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

# 3) 런너 — 빌드 툴 없는 깨끗한 베이스 + 런타임 의존성만.
#    컴파일된 better-sqlite3 .node는 prod-deps에서 복사돼 그대로 동작(런타임은 libstdc++만 필요, node 베이스에 포함).
#    next start로 기동하고, entrypoint에서 prisma migrate deploy를 먼저 실행한다.
FROM base AS runner
ENV NODE_ENV=production PORT=3010 HOSTNAME=0.0.0.0
# prisma 마이그레이트 엔진이 libssl을 요구 → openssl 설치. sqlite3는 DB 백업 스크립트용(작음).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates sqlite3 && rm -rf /var/lib/apt/lists/*
RUN groupadd -r nodejs && useradd -r -g nodejs -m nextjs

# --chown으로 복사 시점에 소유권을 지정한다. 별도 `chown -R`을 돌리면 overlay FS가
# node_modules 전체를 새 레이어에 복제해 이미지가 ~600MB 비대해지므로 반드시 COPY에서 처리.
# prisma migrate가 @prisma/engines에 쓰기를 하므로 node_modules는 nextjs 소유여야 한다.
COPY --chown=nextjs:nodejs --from=prod-deps /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/app/generated ./app/generated
# DB 백업 스크립트를 이미지에 베이크(self-contained 셸 — lib/ 미복사라 호스트 파일 의존 없음).
COPY --chown=nextjs:nodejs --from=builder /app/scripts ./scripts

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /data && chown nextjs:nodejs /data

USER nextjs
EXPOSE 3010
ENTRYPOINT ["./docker-entrypoint.sh"]
