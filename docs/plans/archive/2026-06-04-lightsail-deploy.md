# Lightsail Docker 배포 + GitHub Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 앱을 Docker(멀티스테이지 + Next standalone)로 패키징하고, `main` push 시 GitHub Actions가 GHCR로 이미지를 푸시한 뒤 Lightsail VPS에 SSH로 자동 배포한다.

**Architecture:** Next `output:"standalone"` 런너 이미지에 prisma CLI/schema/migrations와 better-sqlite3 네이티브 모듈을 포함해, 컨테이너 시작 시 `prisma migrate deploy` 후 `node server.js`를 띄운다. SQLite는 호스트 볼륨에 영속. CI는 test→build/push→ssh deploy 3-job.

**Tech Stack:** Docker, Next 16 standalone, Prisma 7 + better-sqlite3, GHCR, GitHub Actions, nginx + certbot

> **검증 제약:** 로컬에 Docker 데몬이 없을 수 있다. 그 경우 `docker build` 로컬 검증을 건너뛰고 **GitHub Actions build job 로그로 검증**한다(실서버 deploy는 인프라 준비 후). Docker가 로컬에서 가능하면 우선 로컬 빌드로 빠르게 잡는다.
> **설계 문서:** `docs/plans/2026-06-04-lightsail-deploy-design.md`
> **인프라 정보:** Ubuntu 24.04, public IP `3.34.132.108`, GHCR public 이미지 `ghcr.io/kisagge/blog-project`.

---

## Task 1: standalone 출력 + .dockerignore

**Files:**
- Modify: `next.config.ts`
- Create: `.dockerignore`

**Step 1: `next.config.ts`에 standalone 추가**
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

**Step 2: `.dockerignore`**
```
node_modules
.next
.git
.github
*.db
*.db-journal
*.db-wal
*.db-shm
.env*
!.env.example
docs
coverage
README.md
**/*.test.ts
**/*.test.tsx
```

**Step 3: standalone 빌드 확인**
Run: `rm -rf .next && npx next build && ls .next/standalone/server.js && ls .next/standalone/node_modules/better-sqlite3/build/Release/*.node 2>/dev/null || echo "better-sqlite3 native가 standalone에 없으면 Dockerfile에서 보완 필요"`
Expected: `.next/standalone/server.js` 존재. better-sqlite3 `.node` 포함 여부 기록(Dockerfile 설계 입력).

**Step 4: Commit**
```bash
git add next.config.ts .dockerignore
git commit -m "build: Next standalone 출력 + .dockerignore"
```

---

## Task 2: Dockerfile + entrypoint

**Files:**
- Create: `Dockerfile`
- Create: `docker-entrypoint.sh`

**Step 1: `Dockerfile`** (멀티스테이지; better-sqlite3 컴파일, prisma generate, standalone, runner에 prisma CLI/schema/migrations + dotenv 포함)
```dockerfile
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

# 3) 런너 (standalone + prisma migrate 런타임)
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
```

> **검증으로 잡을 것:** standalone의 `node_modules`에 better-sqlite3 네이티브와 `@prisma/adapter-better-sqlite3`가 포함되는지. 누락 시 runner에 명시 COPY 추가:
> `COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3`
> `COPY --from=builder /app/node_modules/@prisma/adapter-better-sqlite3 ./node_modules/@prisma/adapter-better-sqlite3`
> (pnpm은 `.pnpm` 심볼릭이므로, standalone 트레이싱이 실제 파일을 복사했는지 build/run 검증으로 확인.)

**Step 2: `docker-entrypoint.sh`**
```sh
#!/bin/sh
set -e
echo "[entrypoint] prisma migrate deploy..."
./node_modules/.bin/prisma migrate deploy
echo "[entrypoint] starting Next.js standalone server..."
exec node server.js
```

**Step 3: Commit**
```bash
git add Dockerfile docker-entrypoint.sh
git commit -m "build: 멀티스테이지 Dockerfile + migrate deploy entrypoint"
```

---

## Task 3: compose.yaml (서버용)

**Files:**
- Create: `compose.yaml`

**Step 1: 작성**
```yaml
services:
  web:
    image: ghcr.io/kisagge/blog-project:latest
    env_file: .env
    environment:
      DATABASE_URL: "file:/data/prod.db"
      NODE_ENV: "production"
    volumes:
      - ./data:/data
    ports:
      - "127.0.0.1:3010:3010"
    restart: unless-stopped
```
> 서버 `/srv/byjang/.env`에 `ADMIN_PASSWORD`, `SESSION_SECRET`만 둔다(DATABASE_URL/NODE_ENV는 compose가 지정). `ports`를 loopback에 바인딩해 외부 비노출(nginx만 접근).

**Step 2: Commit**
```bash
git add compose.yaml
git commit -m "build: 서버 배포용 compose.yaml(SQLite 볼륨, loopback 바인딩)"
```

---

## Task 4: GitHub Actions 워크플로

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: 작성**
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: npx tsc --noEmit
      - run: npx eslint .
      - run: pnpm test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/kisagge/blog-project:latest
            ghcr.io/kisagge/blog-project:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /srv/byjang
            docker compose pull
            docker compose up -d
            docker image prune -f
```
> `secrets.GITHUB_TOKEN`은 자동 제공(GHCR push용). 서버 pull은 이미지가 public이라 인증 불필요. `SSH_HOST/SSH_USER/SSH_KEY`는 사용자가 등록.

**Step 2: YAML 문법 점검**
Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML OK')"`
Expected: `YAML OK`

**Step 3: Commit**
```bash
git add .github/workflows/deploy.yml
git commit -m "ci: test→GHCR build/push→SSH 배포 워크플로"
```

---

## Task 5: 배포 가이드 문서

**Files:**
- Create: `docs/deploy/lightsail.md`

**Step 1: 작성** — 아래 내용(서버 1회 설정 전 과정):
- Lightsail 인스턴스(Ubuntu 24.04, x86_64) 생성, 고정 IP `3.34.132.108` 연결, 방화벽 22/80/443.
- 서버 패키지 설치:
  ```bash
  sudo apt update && sudo apt install -y nginx
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER   # 재로그인
  sudo apt install -y certbot python3-certbot-nginx
  ```
- 앱 디렉토리/시크릿:
  ```bash
  sudo mkdir -p /srv/byjang/data && sudo chown -R $USER /srv/byjang
  cd /srv/byjang
  # compose.yaml을 레포에서 복사(scp 또는 붙여넣기)
  cat > .env <<EOF
  ADMIN_PASSWORD=<원하는 비번>
  SESSION_SECRET=$(openssl rand -base64 32)
  EOF
  ```
- 배포용 SSH 키:
  ```bash
  ssh-keygen -t ed25519 -f deploy_key -N ""
  cat deploy_key.pub >> ~/.ssh/authorized_keys
  # deploy_key(개인키) 내용을 GitHub Secret SSH_KEY로 등록
  ```
- GitHub Secrets: `SSH_HOST=3.34.132.108`, `SSH_USER=ubuntu`, `SSH_KEY=<deploy_key 개인키>`.
- 첫 배포: GitHub에서 이미지 패키지를 **public**으로 전환(Packages → 패키지 설정 → Change visibility). main에 push 또는 Actions 수동 실행 → 서버에서 `docker compose up -d` 자동.
- nginx 리버스 프록시 `/etc/nginx/sites-available/byjang`:
  ```nginx
  server {
    server_name your-domain.com;
    location / {
      proxy_pass http://127.0.0.1:3010;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }
  ```
  ```bash
  sudo ln -s /etc/nginx/sites-available/byjang /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot --nginx -d your-domain.com   # HTTPS 발급 + 자동 갱신
  ```
- 확인: `https://your-domain.com/feed` 200, `/admin` 로그인 동작(HTTPS라 secure 쿠키 OK).
- 롤백: `docker compose pull` 대신 특정 태그 `ghcr.io/...:<sha>`로 `compose.yaml` 수정 후 `up -d`.

**Step 2: Commit**
```bash
git add docs/deploy/lightsail.md
git commit -m "docs: Lightsail 인프라 설정 + nginx/certbot/시크릿 배포 가이드"
```

---

## Task 6: 검증

**Step 1: 로컬 Docker 가용 여부 확인**
Run: `docker version --format '{{.Server.Version}}' 2>/dev/null && echo HAS_DOCKER || echo NO_DOCKER`

**분기 A — 로컬 Docker 있음:**
```bash
docker build -t byjang-test .
# 임시 볼륨으로 기동 (테스트 env)
docker run -d --name byjang-test -p 3010:3010 \
  -e ADMIN_PASSWORD=admin1234 -e SESSION_SECRET="$(openssl rand -base64 32)" \
  -e DATABASE_URL="file:/data/prod.db" -v "$(pwd)/.docker-data:/data" byjang-test
sleep 4
curl -s -o /dev/null -w "/feed=%{http_code}\n" http://localhost:3010/feed   # 200 기대(빈 DB라 목록 비어도 200)
docker logs byjang-test | grep -i "migrate\|started\|error" | head
docker rm -f byjang-test && rm -rf .docker-data
```
빌드 실패 시(better-sqlite3 native/dotenv/prisma 누락) Dockerfile의 보완 COPY를 추가하고 재빌드.

**분기 B — 로컬 Docker 없음:**
- Docker 빌드 검증은 push 후 GitHub Actions `build-and-push` job 로그로 수행한다(서버 시크릿 없이도 build/push까지 검증됨; `deploy` job은 SSH 시크릿 없으면 실패하지만 그 전 단계까지 통과로 이미지 빌드 가능성 확인).
- 로컬에서는 정적 점검만: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"`, Dockerfile 린트(가능하면 `hadolint` 없으면 생략).

**Step 2: 전체 게이트(앱 자체)**
Run: `npx tsc --noEmit && npx eslint . && pnpm test && rm -rf .next && npx next build`
Expected: 모두 통과(standalone 빌드 포함).

**Step 3: 커밋(수정 있었으면)**

---

## Task 7: 푸시 + PR

**Step 1: 푸시**
```bash
git push -u origin feature/lightsail-deploy
```
> push 시 워크플로가 도는데, 서버 시크릿(SSH_*)이 아직 없으면 `deploy` job만 실패한다(정상). `test`·`build-and-push` 통과로 이미지 빌드 가능성·CI 게이트 검증.

**Step 2: PR 생성**
```bash
gh pr create --base main --head feature/lightsail-deploy --title "Lightsail Docker 배포 + GitHub Actions (4단계)" --body "..."
```

**Step 3: 사용자 안내**
- 서버 1회 설정(`docs/deploy/lightsail.md`) → GitHub Secrets 등록 → 이미지 public 전환 → 재실행 시 deploy까지 성공.

---

## 작업 순서 요약
1 standalone+dockerignore → 2 Dockerfile+entrypoint → 3 compose → 4 workflow → 5 배포 가이드 → 6 검증(로컬 docker 또는 CI) → 7 push+PR
