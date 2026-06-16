# BY Playground

생각과 기록을 남기는 개인 블로그. 공개 피드·던파 캐릭터 쇼케이스와 회원 커뮤니티(댓글·좋아요·알림), 관리자 CMS를 갖춘 Next.js 앱이며, Docker로 AWS Lightsail에 배포되고 `main` push 시 GitHub Actions로 자동 배포된다.

> 아키텍처·엔지니어링 결정·성과는 **[기술 개요(docs/tech-spec.md)](docs/tech-spec.md)** · [English](docs/tech-spec.en.md) 참고.

## 주요 기능

- **공개 피드**(`/feed`): 관리자 글 목록 + 상세(마크다운 렌더), **제목·내용·요약 검색**, **무한스크롤(10개 단위)**, 조회수 집계
- **커뮤니티**(`/community`): 회원이 작성한 글 목록(회원 전용 — 비회원은 안내 페이지). 회원은 **임시저장(동시 ≤3) → 회원공개**로 글을 작성(`/account`에서 관리), 본문은 마크다운+외부 이미지 URL. 작성 화면에 **작성/미리보기 탭 + 마크다운 문법 도움말** 제공
- **공개 범위 3단계**: 전체공개 / 회원공개 / 비공개(초안). 피드·던파 공용, 단건·목록 모두 접근 제어. 관리자는 비공개 초안도 열람
- **던파 쇼케이스**: Neople OpenAPI로 캐릭터 정보(스탯·장비 등) 표시, 관리자 등록·정렬(드래그)
- **회원**: 가입 신청 → 관리자 승인 → 로그인(JWT 세션), 비밀번호 재설정(이메일 6자리 코드), **내 정보(닉네임 수정·중복검사)**
- **댓글·좋아요**: 2뎁스 댓글(답글) + 댓글/피드 좋아요, 비회원은 로그인 유도 모달
- **신고·모더레이션**: 회원이 댓글·회원 글을 사유와 함께 신고 → 관리자 큐(`/admin/reports`)에서 **숨김(복구 가능)·기각**. 숨김 콘텐츠는 목록·상세·프로필에서 가려지고 관리자만 검토 열람
- **알림**: 인앱 알림 센터(읽음 처리·딥링크 하이라이트) + **웹 푸시**(댓글/답글·신고 접수)
- **PWA**: 설치형 + 오프라인(서비스 워커·manifest·아이콘)
- **SNS 공유**: X · 카카오톡 · 네이티브 공유 · URL 복사 (og:image 포함)
- **관리자 CMS**: 글·던파 캐릭터 CRUD, 회원 승인/거절·차단, 신고 처리(숨김/기각), 본문 이미지 업로드, 공개 범위 모달, 점검 모드
- **어뷰징 방지**: `proxy`에서 IP당 전역 요청 속도 제한(429)
- **점검 모드**: 관리자가 공개 사이트를 외부 방문자에게 on/off (비어드민은 `/maintenance`로)

## 기술 스택

- **Next.js 16** (App Router, Server Actions, `proxy.ts` 미들웨어) · **React 19**
- **Prisma 7** + **SQLite** (드라이버 어댑터 `@prisma/adapter-better-sqlite3` — 런타임 쿼리 엔진 바이너리 불필요)
- **Tailwind CSS v4**
- 인증: **jose**(JWT) · 마크다운: react-markdown + remark-gfm · 검증: zod · 드래그 정렬: @dnd-kit
- 알림: **web-push**(VAPID) · 메일: **nodemailer**(SMTP)
- 테스트: **Vitest**
- 배포: **Docker** + **AWS Lightsail** + **GitHub Actions** + nginx

## 개발 시작

```bash
pnpm install
cp .env.example .env          # 값 채우기(아래 표 참고)
pnpm prisma migrate dev       # 로컬 SQLite(dev.db) 스키마 적용
pnpm dev                      # http://localhost:3010
```

### 환경 변수 (`.env`, 전체 예시는 `.env.example`)

| 변수                                                            | 필수 | 설명                                                 |
| --------------------------------------------------------------- | :--: | ---------------------------------------------------- |
| `DATABASE_URL`                                                  |  ✓   | SQLite 경로 (예: `file:./dev.db`)                    |
| `ADMIN_PASSWORD`                                                |  ✓   | 관리자 로그인 비밀번호(평문)                         |
| `SESSION_SECRET`                                                |  ✓   | 세션 JWT 서명 키 (`openssl rand -base64 32`)         |
| `UPLOAD_DIR`                                                    |      | 업로드 저장 디렉토리 (기본 `data/uploads`)           |
| `NEOPLE_API_KEY`                                                |      | 던파 OpenAPI 키 (없으면 `/df` 비활성)                |
| `KAKAO_JS_KEY`                                                  |      | 카카오 JS 키 (없으면 카카오 공유 버튼 비노출)        |
| `VAPID_PUBLIC_KEY` / `_PRIVATE_KEY` / `_SUBJECT`                |      | 웹 푸시 알림 키 (`npx web-push generate-vapid-keys`) |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `_FROM` / `_SECURE` |      | 비밀번호 재설정 메일 발송(미설정 시 콘솔 로그)       |

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
GitHub Actions: test → build-and-push(GHCR) → deploy(SSH: pull & up + migrate deploy)
```

## 프로젝트 구조

```
app/          라우트
  (list)/feed, feed/[slug]     공개 피드(목록·상세·댓글)
  df, df/[server]/[id]         던파 쇼케이스
  signup, signin, account      회원 가입·로그인·내 정보
  forgot-password/*            비밀번호 재설정(이메일 코드)
  notifications                인앱 알림 센터
  admin/*                      관리자 CMS(글·던파·회원·설정)
  maintenance, uploads/[name]  점검 안내, 업로드 서빙
lib/          도메인 로직 (feeds, df-characters, users, comments, likes,
              notifications, push, mailer, visibility, rate-limit, dal, jwt …)
prisma/       schema.prisma + migrations
public/       manifest·service worker·아이콘
docs/deploy/  배포 런북   ·   docs/plans/  구현 계획(완료분은 archive/)
```

## 버전 규칙

pre-1.0 semver: **feat → minor**(0.x.0), **fix → patch**(0.0.x). 기능 추가 시 `package.json` 버전을 올린다.
