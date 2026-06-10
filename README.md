# BY Playground

생각과 기록을 남기는 개인 블로그. 공개 피드(목록·상세)와 관리자 화면을 갖춘 Next.js 앱이며, Docker로 AWS Lightsail에 배포되고 `main` push 시 GitHub Actions로 자동 배포된다.

## 주요 기능

- **공개 피드**: 글 목록 + 상세(마크다운 렌더), **제목·내용·요약 검색**, **무한스크롤(10개 단위)**
- **관리자**: 비밀번호 로그인(JWT 세션), 글 작성/수정/삭제(확인 모달), 공개/비공개 토글, **본문 이미지 업로드**(검증 + 토스트)
- **점검 모드**: 관리자가 공개 사이트를 외부 방문자에게 on/off (비어드민은 `/maintenance`로)

## 기술 스택

- **Next.js 16** (App Router, Server Actions, `proxy.ts` 미들웨어) · **React 19**
- **Prisma 7** + **SQLite** (드라이버 어댑터 `@prisma/adapter-better-sqlite3` — 런타임 쿼리 엔진 바이너리 불필요)
- **Tailwind CSS v4**
- 인증: **jose**(JWT) · 마크다운: react-markdown + remark-gfm · 검증: zod
- 테스트: **Vitest**
- 배포: **Docker** + **AWS Lightsail** + **GitHub Actions** + nginx

## 개발 시작

```bash
pnpm install
pnpm prisma migrate dev      # 로컬 SQLite(dev.db) 스키마 적용
pnpm dev                     # http://localhost:3010
```

### 환경 변수 (`.env`, 예시는 `.env.example`)

| 변수             | 설명                                         |
| ---------------- | -------------------------------------------- |
| `DATABASE_URL`   | SQLite 경로 (예: `file:./dev.db`)            |
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호(평문)                 |
| `SESSION_SECRET` | 세션 JWT 서명 키 (`openssl rand -base64 32`) |
| `UPLOAD_DIR`     | 업로드 저장 디렉토리 (기본 `data/uploads`)   |

## 스크립트

| 명령                            | 설명                        |
| ------------------------------- | --------------------------- |
| `pnpm dev`                      | 개발 서버(:3010, turbopack) |
| `pnpm build` / `pnpm start`     | 프로덕션 빌드 / 기동(:3010) |
| `pnpm test` / `pnpm test:watch` | Vitest 실행 / 워치          |
| `pnpm lint` / `pnpm format`     | ESLint / Prettier           |
| `pnpm studio`                   | Prisma Studio               |

## 테스트

Vitest. 순수 로직과 함께 DB 로직은 임시 SQLite로 실제 쿼리를 검증한다(헬퍼: `lib/test-db.ts`).

```bash
pnpm test
```

## 배포

Docker 이미지를 GHCR에 푸시하고 Lightsail에서 `docker compose`로 기동한다. nginx가 `/`를 앱(:3010)으로, `/uploads/`를 볼륨에서 직접 서빙한다. 절차·서버 설정은 **[docs/deploy/lightsail.md](docs/deploy/lightsail.md)** 참고.

```
GitHub Actions: test → build-and-push(GHCR) → deploy(SSH: pull & up)
```

## 프로젝트 구조

```
app/          라우트 (feed/ 공개, admin/ 관리자, maintenance/, uploads/)
lib/          도메인 로직 (feeds, dal, jwt, site-config, upload …)
prisma/       schema.prisma + migrations
docs/deploy/  배포 런북
docs/plans/   구현 계획 (완료분은 archive/)
```

## 버전 규칙

pre-1.0 semver: **feat → minor**(0.x.0), **fix → patch**(0.0.x). 기능 추가 시 `package.json` 버전을 올린다.
