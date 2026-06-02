# 설계: 공개 피드 페이지 (목록 + 상세)

- 작성일: 2026-06-02
- 단계: 전체 로드맵 4단계 중 **2단계** (① DB+모델 → ② 공개 페이지 → ③ 관리자+인증 → ④ Lightsail 배포)
- 블로그 이름: **BY Playground**

## 목표

방문자가 공개된 글을 목록에서 보고, 상세 페이지에서 본문(마크다운)을 읽을 수 있는 읽기 전용 공개 페이지를 만든다. 작성/수정/인증은 다음 단계.

## 기술 스택 / 전제

- Next.js 16 App Router (서버 컴포넌트 우선, `params`는 Promise → `await`)
- Prisma 7 + SQLite, `lib/prisma.ts` 싱글톤 재사용
- 마크다운 렌더링: `react-markdown` + `remark-gfm` (원시 HTML 미렌더 → XSS 안전)
- 스타일: 기존 Tailwind v4 + Geist 폰트 + zinc 컬러 + 다크모드 유지

## 데이터 모델 변경 (1단계 보정)

- `model Post` → `model Feed`로 이름 변경. 필드는 그대로:
  `id, slug(unique), title, summary?, content, published(default false), createdAt, updatedAt`
- 테이블명도 `Feed` (별도 `@@map` 없음).
- 데이터 0건이므로 기존 `init` 마이그레이션을 제거하고 새 `init` 마이그레이션을 재생성한다.
  `dev.db`와 생성 클라이언트(`app/generated/prisma`)도 재생성.
- 코드 접근: `prisma.feed`.

## 라우트 구조

```
app/
  layout.tsx            # 공통 상단 헤더 추가 + metadata 제목 변경
  page.tsx              # /        → 간단한 홈(소개 + "피드 보기" 링크). 추후 다른 콘텐츠 자리
  feed/
    page.tsx            # /feed        → 공개된 피드 목록
    loading.tsx         # 목록 로딩 스켈레톤
    [slug]/
      page.tsx          # /feed/[slug] → 상세(마크다운 렌더)
      not-found.tsx     # 없는/비공개 글 → 404
```

- URL을 `/feed` 하위로 둔 이유: 루트(`/`)는 추후 피드 외 다른 종류의 콘텐츠를 둘 공간으로 비워둔다.

## 상단 헤더

- `app/layout.tsx`(루트 레이아웃)에 공통 헤더 배치:
  - 왼쪽: 블로그명 **BY Playground** → `/` 링크
  - 오른쪽: **Feed** → `/feed` 링크
- `metadata.title`을 "Create Next App" → "BY Playground"로 변경.

## 데이터 접근 레이어 — `lib/feeds.ts`

```ts
getPublishedFeeds()   // where published=true, orderBy createdAt desc, 목록용 필드만 select
getFeedBySlug(slug)   // where { slug, published: true }, 없으면 null
```

- **공개 페이지는 항상 `published: true`만 노출** (초안 차단을 where 조건으로 강제).

## 컴포넌트 / 렌더링

- **목록 (`app/feed/page.tsx`)**: 글 카드 리스트(제목, summary, 작성일). 각 항목 `<Link href={`/feed/${slug}`}>`. 글 없으면 빈 상태 메시지.
- **상세 (`app/feed/[slug]/page.tsx`)**: 제목+작성일 헤더, `<article>` 안에 `react-markdown`+`remark-gfm`로 본문 렌더. slug 없으면 `notFound()`.
- 마크다운 본문 스타일은 Tailwind 유틸 클래스로 최소 지정(`@tailwindcss/typography` 미도입 — YAGNI).

## 에러 / 빈 상태 / 메타데이터

- 없는 slug → `notFound()` → `feed/[slug]/not-found.tsx`.
- 상세 페이지 `generateMetadata`로 글 제목을 `<title>`에 반영(SEO 기초).
- 목록은 `loading.tsx`로 스켈레톤.

## 의존성 추가

- `react-markdown`, `remark-gfm` (runtime dependencies)

## 범위에서 제외 (다음 단계)

- 작성/수정/삭제, 인증, 관리자 → 3단계
- 페이지네이션, 태그, 검색, 댓글 → 글이 많아지면 그때
