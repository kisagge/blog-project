# 설계: 3단계 — 관리자 + 인증 (+ Vitest 테스트 도입)

- 작성일: 2026-06-04
- 단계: 로드맵 4단계 중 **3단계** (① DB+모델 → ② 공개 페이지 → ③ 관리자+인증 → ④ Lightsail 배포)
- 전제: 2단계(공개 피드 페이지) 완료·머지됨. `Feed`(id uuid PK, slug unique, title, summary?, content, published, createdAt, updatedAt).

## 목표

단일 관리자가 로그인해 글(Feed)을 **작성·수정·삭제·공개토글**한다. 구현 완료 후 **Vitest로 단위 테스트**를 도입한다.

## 결정 사항 (브레인스토밍 합의)

- 사용자 범위: **단일 관리자(본인)** — User 테이블·회원가입 없음. 비번은 환경변수.
- 인증 방식: **직접 구현(A) + zod** — `jose` JWT + httpOnly 쿠키. Auth.js/iron-session 미사용.
- 관리 기능: 작성·수정·삭제·공개/비공개 토글 전부.

## 기술 스택 / 전제

- Next.js 16 App Router (서버 컴포넌트, `params` Promise, Server Actions)
- Prisma 7 + SQLite, `lib/prisma.ts` 싱글톤
- 신규 의존성: `jose`(세션 서명), `zod`(검증). 테스트: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `vite-tsconfig-paths`

## 1. 인증 / 세션

- 비밀번호: 환경변수 `ADMIN_PASSWORD`(평문). 로그인 액션에서 `crypto.timingSafeEqual`로 비교(비번 해시 bcrypt는 단일 고정 비번이라 생략 — YAGNI).
- 세션: 로그인 성공 시 `jose`로 서명한 JWT를 `session` 쿠키(httpOnly·secure·sameSite=lax·7일)로 발급. 서명키 `SESSION_SECRET`.
- 파일:
  - `lib/session.ts` (`server-only`) — `encrypt`/`decrypt`(jose), `createSession`, `deleteSession`
  - `lib/dal.ts` — `verifySession()`(React `cache`): 쿠키 검증, 없으면 `/login` redirect

## 2. 라우트 구조

```
app/
  login/page.tsx           # 로그인 폼 (로그인 상태면 /admin로)
  admin/
    layout.tsx             # verifySession()으로 보호 + 관리 헤더(로그아웃)
    page.tsx               # 글 전체 목록(초안 포함), 행마다 수정/삭제/공개토글
    new/page.tsx           # 새 글 작성 폼
    [id]/edit/page.tsx     # 글 수정 폼 (id=uuid)
    actions.ts             # "use server" — createFeed/updateFeed/deleteFeed/togglePublished
  actions/auth.ts          # "use server" — login, logout
proxy.ts                   # /admin/* optimistic 보호(쿠키만 확인 → 미인증 시 /login)
```
- 공개 페이지는 slug, **관리자 내부는 id(uuid)**로 접근.

## 3. Server Actions (모두 `verifySession` 선검증)

- `login(state, formData)` — 비번 검증 → 세션 생성 → `redirect('/admin')`. 실패 시 에러 반환.
- `logout()` — 쿠키 삭제 → `redirect('/login')`.
- `createFeed(state, formData)` — zod 검증 → 생성 → `revalidatePath` → `redirect('/admin')`.
- `updateFeed(id, state, formData)` — zod 검증 → 수정(updatedAt 갱신) → revalidate.
- `deleteFeed(id)` — 삭제 → revalidate (목록에서 확인 후 실행).
- `togglePublished(id)` — published 반전 → revalidate.

## 4. 입력 검증 (zod) — `lib/validation.ts`

```ts
FeedFormSchema = z.object({
  title:   z.string().min(1),
  slug:    z.string().regex(/^[a-z0-9-]+$/, "소문자·숫자·하이픈만"),
  summary: z.string().optional(),
  content: z.string().min(1),
  published: z.boolean(),
})
```
- 폼은 `useActionState`로 필드별 에러 표시(slug 형식, 필수 누락).
- slug 중복(unique 위반)은 Prisma 에러를 잡아 "이미 쓰는 slug" 메시지로.

## 5. 데이터 헬퍼 확장 — `lib/feeds.ts`

- 추가: `getAllFeeds()`(초안 포함 전체, 관리자용), `getFeedById(id)`(공개여부 무관).
- 기존 공개용(`getPublishedFeeds`, `getFeedBySlug`)은 그대로.

## 6. 환경변수

- `.env`에 추가(값 생성은 도와주되 최종 입력은 사용자):
  - `ADMIN_PASSWORD="..."`
  - `SESSION_SECRET="..."` (`openssl rand -base64 32`)
- `.env*`는 gitignore라 커밋 안 됨. `.env.example`에 키 이름만 문서화.

## 7. 보안 원칙 (Next 문서 기반)

- UI 가림만으로 불충분 → **모든 Server Action에서 `verifySession` 재검증**.
- `proxy.ts`는 optimistic(쿠키만), 실제 방어는 DAL/액션에서.
- 쿠키는 서버에서만 설정, httpOnly로 JS 접근 차단.

## 8. Vitest 테스트 도입 (구현 완료 후)

> **제약:** `async` 서버 컴포넌트는 Vitest 미지원(Next 공식). 페이지·Server Action은 단위 테스트 대상에서 제외하고, prod 빌드 + 수동 시나리오로 검증한다.

- 설정: `vitest.config.mts`(`@vitejs/plugin-react` + `vite-tsconfig-paths`, jsdom) + `vitest.setup.ts`(`@testing-library/jest-dom/vitest`). `package.json`에 `"test": "vitest run"`.
- **단위 테스트 대상(순수 로직 위주):**
  - `lib/validation.ts` — zod 스키마: 유효/무효 slug(대문자·공백·언더스코어 거부), 필수 필드 누락, published 불리언.
  - `lib/session.ts` — `encrypt`→`decrypt` 라운드트립(같은 payload 복원), 잘못된/만료 토큰은 undefined.
  - 동기 컴포넌트 렌더: `app/feed/[slug]/not-found.tsx` 등 RTL로 텍스트/링크 렌더.
- **제외(E2E 영역):** async 페이지(`/feed`, `/admin`), Server Actions(login/CRUD) — prod 수동 검증.

## 9. 검증 (게이트)

- `npx tsc --noEmit` + `npx next build` + `eslint .` + `vitest run` 모두 통과.
- prod 수동 시나리오: 로그인/로그아웃, 작성→공개→공개페이지 노출, 수정, 비공개 토글→공개페이지 404, 삭제, 미로그인 `/admin`→`/login` 리다이렉트.

## 범위 제외 (YAGNI)

- 회원가입·다중계정·역할, 비번 해시(bcrypt), 이미지 업로드, 자동 slug 생성(직접 입력), async 컴포넌트 E2E 자동화(Playwright 등은 추후).
