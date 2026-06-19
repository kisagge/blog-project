# 설계: 4단계 — Lightsail Docker 배포 + GitHub Actions 자동배포

- 작성일: 2026-06-04
- 단계: 로드맵 4단계(마지막) (① DB+모델 → ② 공개 페이지 → ③ 관리자+인증 → ④ 배포)
- 전제: 2·3단계 완료·머지됨. Next.js 16 + Prisma 7 + SQLite(better-sqlite3 어댑터, 네이티브 모듈).

## 목표

앱을 AWS Lightsail VPS에 **Docker 컨테이너**로 배포하고, `main` push 시 **GitHub Actions로 자동 배포**한다. SQLite 파일은 호스트 볼륨으로 영속, HTTPS는 nginx+Let's Encrypt.

## 인프라 정보 (확정)

- Lightsail VPS: **Ubuntu 24.04**, x86_64.
- **Public IP(고정): `3.34.132.108`** — SSH/도메인 A레코드/외부 접속 대상.
- Private IP: `172.26.15.33` — AWS 내부 통신용(이번 배포 경로엔 직접 미사용, 참고).
- 도메인: 사용자 보유(문서에선 `your-domain.com` placeholder, 실제 값 직접 기입).
- GHCR 이미지: **public** (repo가 이미 public, 이미지에 시크릿 미포함 → 서버 레지스트리 인증 불필요).

## 1. 인프라 1회 수동 설정 (문서화: `docs/deploy/lightsail.md`)

- Lightsail 방화벽: 22(SSH), 80, 443 개방.
- 서버 설치: Docker Engine + Compose plugin, nginx, certbot(+python3-certbot-nginx).
- 도메인 A 레코드 → `3.34.132.108`.
- 디렉토리: `/srv/byjang/` (compose.yaml, .env), `/srv/byjang/data/` (SQLite 볼륨).
- 배포용 SSH 키 페어 생성 → 공개키는 서버 `authorized_keys`, 개인키는 GitHub Secret.

## 2. 앱 컨테이너화

- `next.config.ts`에 **`output: "standalone"`** 추가.
- 멀티스테이지 `Dockerfile`:
  - `deps`(node:22-slim + 빌드툴): `pnpm install` — better-sqlite3 네이티브 컴파일 + `prisma generate`.
  - `builder`: 소스 복사 + `next build`(standalone 산출).
  - `runner`(node:22-slim, 비루트): standalone 출력(`.next/standalone`, `.next/static`, `public`) + `app/generated/prisma` + better-sqlite3 네이티브 `.node` 포함 확인. `EXPOSE 3010`, entrypoint로 기동.
- `.dockerignore`: node_modules, .next, .git, \*.db, docs 등.

## 3. SQLite 영속 + 마이그레이션

- 호스트 `/srv/byjang/data` → 컨테이너 `/data` 볼륨 마운트.
- `DATABASE_URL=file:/data/prod.db`.
- 컨테이너 `docker-entrypoint.sh`: `prisma migrate deploy` 실행 → 성공 시 `node server.js`(standalone) 기동.
  - 배포마다 마이그레이션 자동 적용, DB는 볼륨에 영속.
  - Prisma CLI/스키마가 runner 이미지에 필요(migrate deploy용) → Dockerfile에서 prisma + schema + migrations 포함.

## 4. docker-compose (서버 `/srv/byjang/compose.yaml`)

- image: `ghcr.io/kisagge/blog-project:latest`
- `env_file: .env` (서버에만 존재)
- volumes: `/srv/byjang/data:/data`
- ports: `127.0.0.1:3010:3010` (외부 비노출, nginx만 접근)
- `restart: unless-stopped`

## 5. 환경변수 / 시크릿

- **서버 `/srv/byjang/.env`** (직접 작성, git 아님):
  - `ADMIN_PASSWORD=...`
  - `SESSION_SECRET=...` (`openssl rand -base64 32`)
  - `DATABASE_URL=file:/data/prod.db`
  - `NODE_ENV=production`
- **GitHub Secrets**: `SSH_HOST=3.34.132.108`, `SSH_USER`(예: ubuntu), `SSH_KEY`(배포용 개인키). 이미지가 public이라 GHCR pull 인증 불필요.

## 6. GitHub Actions (`.github/workflows/deploy.yml`)

- 트리거: `push` → `main`.
- **test job(게이트)**: pnpm install → `tsc --noEmit` → `eslint .` → `vitest run`. 실패 시 배포 중단.
- **build job**(test 통과 후): docker buildx → GHCR push (`:latest`, `:<sha>`). `permissions: packages: write`, `GITHUB_TOKEN` 로그인.
- **deploy job**(build 후): `appleboy/ssh-action` → 서버에서 `cd /srv/byjang && docker compose pull && docker compose up -d && docker image prune -f`.

## 7. nginx + HTTPS (호스트 1회, 문서화)

- nginx 서버블록: `server_name your-domain.com;` → `proxy_pass http://127.0.0.1:3010;` + `proxy_set_header X-Forwarded-Proto https;`, Host/Upgrade 헤더.
- `certbot --nginx -d your-domain.com` → Let's Encrypt 발급 + 자동 갱신(systemd timer).
- HTTPS 종단이므로 세션 쿠키 `secure: true`(prod) 정상 작동.

## 8. 산출물 (이번 PR로 레포 추가/수정)

```
next.config.ts             # output: "standalone" 추가
Dockerfile
.dockerignore
compose.yaml               # 서버 배포용(서버로 복사해 사용)
docker-entrypoint.sh       # migrate deploy + node server.js
.github/workflows/deploy.yml
docs/deploy/lightsail.md    # 인프라 1회 설정 + nginx/certbot/시크릿 단계별 가이드
```

## 9. 검증

- **로컬**: `docker build -t byjang-test .` 성공 → `docker run`(임시 볼륨, 테스트 env)로 기동 → `/feed` 200, 마이그레이션 적용, 로그인 동작(컨테이너 내) 확인.
- **워크플로**: YAML 문법 검증, push 후 Actions 로그.
- **실서버**: 사용자가 가이드대로 인프라 준비 → GitHub Secrets 등록 → push → Actions 성공 → `https://도메인` 확인. (제가 AWS에 직접 접속 불가, 가이드로 위임.)
- 핵심은 **빌드 가능성 + 문서 정확성**. Vitest 단위테스트 변경 없음.

## 범위 제외 (YAGNI)

- 다중 인스턴스/LB/오토스케일, 외부 DB(RDS), 블루그린, 컨테이너 내 nginx, 로그 수집 스택, private 레지스트리.
