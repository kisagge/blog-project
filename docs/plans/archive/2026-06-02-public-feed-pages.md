# 공개 피드 페이지 (목록 + 상세) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 방문자가 `/feed`에서 공개된 글 목록을 보고 `/feed/[slug]`에서 마크다운 본문을 읽을 수 있는 읽기 전용 공개 페이지를 만든다.

**Architecture:** Next.js 16 App Router 서버 컴포넌트가 `lib/feeds.ts` 헬퍼를 통해 Prisma로 DB를 직접 조회한다. 공개 페이지는 항상 `published: true`만 노출한다. 본문은 `react-markdown` + `remark-gfm`로 렌더한다. 공통 상단 헤더는 루트 레이아웃에 둔다.

**Tech Stack:** Next.js 16, React 19, Prisma 7 (+better-sqlite3 어댑터, SQLite), Tailwind v4, react-markdown, remark-gfm

> **검증 방식 주의:** 이 레포에는 아직 테스트 러너가 없다. 각 작업의 검증은 `npx tsc --noEmit`(타입), 필요 시 `npx next build`(빌드), 그리고 시드 데이터를 넣고 `pnpm dev`로 브라우저/`curl` 확인으로 한다. 테스트 프레임워크 도입은 이 계획 범위 밖.

> **설계 문서:** `docs/plans/2026-06-02-public-feed-pages-design.md`

---

## Task 1: Post → Feed 모델 개명 + 마이그레이션 재생성

**Files:**
- Modify: `prisma/schema.prisma:15-24` (`model Post` → `model Feed`)
- Delete: `prisma/migrations/20260602022757_init/` (데이터 0건이므로 폐기)
- Regenerate: `dev.db`, `app/generated/prisma/` (명령으로 자동 생성)

**Step 1: 스키마에서 모델명 변경**

`prisma/schema.prisma`의 `model Post {` 한 줄만 `model Feed {`로 바꾼다. 필드는 그대로 둔다.

```prisma
model Feed {
  id        Int      @id @default(autoincrement())
  slug      String   @unique
  title     String
  summary   String?
  content   String              // 본문 (마크다운 문자열로 저장)
  published Boolean  @default(false)   // 초안/공개 토글
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Step 2: 기존 마이그레이션과 로컬 DB 제거**

Run:
```bash
rm -rf prisma/migrations dev.db
```

**Step 3: 마이그레이션 재생성 + 클라이언트 재생성**

Run:
```bash
npx prisma migrate dev --name init
```
Expected: `prisma/migrations/<timestamp>_init/migration.sql`에 `CREATE TABLE "Feed"`가 생성되고, `app/generated/prisma`가 재생성되며 "Your database is now in sync with your schema." 출력.

**Step 4: 모델명 반영 확인**

Run:
```bash
grep -n "model Feed" prisma/schema.prisma && grep -rn "CREATE TABLE \"Feed\"" prisma/migrations
```
Expected: 두 grep 모두 매칭.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "refactor(db): Post 모델을 Feed로 개명하고 init 마이그레이션 재생성"
```

---

## Task 2: 마크다운 렌더링 의존성 설치

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

**Step 1: 패키지 설치**

Run:
```bash
pnpm add react-markdown remark-gfm
```
Expected: dependencies에 `react-markdown`, `remark-gfm` 추가.

**Step 2: 설치 확인**

Run:
```bash
node -e "require.resolve('react-markdown'); require.resolve('remark-gfm'); console.log('ok')"
```
Expected: `ok`

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: react-markdown, remark-gfm 추가"
```

---

## Task 3: 데이터 접근 헬퍼 `lib/feeds.ts`

**Files:**
- Create: `lib/feeds.ts`

**Step 1: 헬퍼 작성**

```ts
import { prisma } from "@/lib/prisma";

// 목록: 공개된 글만, 최신순, 카드에 필요한 필드만
export async function getPublishedFeeds() {
  return prisma.feed.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      title: true,
      summary: true,
      createdAt: true,
    },
  });
}

// 상세: 공개된 단일 글, 없으면 null
export async function getFeedBySlug(slug: string) {
  return prisma.feed.findFirst({
    where: { slug, published: true },
  });
}
```

**Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음(종료코드 0). `prisma.feed`가 인식되면 Task 1의 클라이언트 재생성이 정상이라는 뜻.

**Step 3: Commit**

```bash
git add lib/feeds.ts
git commit -m "feat(feed): 공개 글 조회 헬퍼 추가 (published만 노출)"
```

---

## Task 4: 시드 데이터 (확인용)

**Files:**
- Create: `prisma/seed.ts`

> 공개 페이지를 눈으로 검증하려면 published 글이 필요하다. 초안 숨김도 확인하기 위해 `published:false` 글을 1건 섞는다.

**Step 1: 시드 스크립트 작성**

```ts
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.feed.deleteMany();
  await prisma.feed.createMany({
    data: [
      {
        slug: "hello-world",
        title: "첫 글: BY Playground 시작",
        summary: "블로그를 시작하며 남기는 첫 메모.",
        content:
          "# 안녕하세요\n\n**BY Playground**에 오신 걸 환영합니다.\n\n- 마크다운 지원\n- `remark-gfm`으로 표/체크박스도 OK\n\n| 항목 | 값 |\n| --- | --- |\n| 단계 | 2 |",
        published: true,
      },
      {
        slug: "second-post",
        title: "두 번째 글",
        summary: "목록 정렬 확인용 글.",
        content: "두 번째 글의 본문입니다.\n\n줄바꿈도 확인합니다.",
        published: true,
      },
      {
        slug: "draft-hidden",
        title: "비공개 초안 (목록에 안 보여야 함)",
        summary: null,
        content: "이 글은 published=false라 공개 페이지에 노출되면 안 된다.",
        published: false,
      },
    ],
  });
  const count = await prisma.feed.count();
  console.log(`seeded. total=${count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

**Step 2: 시드 실행**

Run:
```bash
DATABASE_URL="file:./dev.db" npx tsx prisma/seed.ts
```
Expected: `seeded. total=3`

**Step 3: 공개 글만 카운트되는지 확인**

Run:
```bash
DATABASE_URL="file:./dev.db" npx tsx -e "import('./app/generated/prisma/client.ts').then(async m => { const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3'); const p = new m.PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) }); console.log('published=', await p.feed.count({ where: { published: true } })); await p.\$disconnect(); })"
```
Expected: `published= 2`

**Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore(feed): 확인용 시드 데이터 추가 (공개 2 + 초안 1)"
```

---

## Task 5: 루트 레이아웃 — 헤더 + 메타데이터

**Files:**
- Modify: `app/layout.tsx`

**Step 1: 헤더 추가 + metadata 변경**

`metadata`를 아래로 바꾸고, `<body>` 안 `children` 위에 공통 헤더를 추가한다.

```tsx
export const metadata: Metadata = {
  title: "BY Playground",
  description: "BY Playground — 개인 기록 공간",
};
```

`<body className="flex min-h-full flex-col">` 내부를 다음으로 교체:

```tsx
<body className="flex min-h-full flex-col">
  <header className="border-b border-black/[.08] dark:border-white/[.145]">
    <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        BY Playground
      </Link>
      <nav className="text-sm">
        <Link href="/feed" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          Feed
        </Link>
      </nav>
    </div>
  </header>
  {children}
</body>
```

파일 상단에 `import Link from "next/link";` 추가.

**Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

**Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(layout): 공통 상단 헤더(BY Playground) + metadata 설정"
```

---

## Task 6: 루트 홈 `app/page.tsx`

**Files:**
- Modify: `app/page.tsx` (create-next-app 템플릿 전체 교체)

**Step 1: 간단한 홈으로 교체**

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">BY Playground</h1>
      <p className="max-w-prose text-zinc-600 dark:text-zinc-400">
        생각과 기록을 남기는 개인 공간입니다.
      </p>
      <Link
        href="/feed"
        className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:opacity-90"
      >
        피드 보기 →
      </Link>
    </main>
  );
}
```

**Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (기존 `next/image` import가 사라지므로 미사용 경고도 없어야 함.)

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): 루트 홈을 BY Playground 소개 + 피드 링크로 교체"
```

---

## Task 7: 피드 목록 `app/feed/page.tsx` + 로딩

**Files:**
- Create: `app/feed/page.tsx`
- Create: `app/feed/loading.tsx`

**Step 1: 목록 페이지 작성**

```tsx
import Link from "next/link";
import { getPublishedFeeds } from "@/lib/feeds";

export const metadata = { title: "Feed · BY Playground" };

export default async function FeedListPage() {
  const feeds = await getPublishedFeeds();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Feed</h1>

      {feeds.length === 0 ? (
        <p className="text-zinc-500">아직 공개된 글이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {feeds.map((feed) => (
            <li key={feed.slug} className="border-b border-black/[.06] pb-6 dark:border-white/[.1]">
              <Link href={`/feed/${feed.slug}`} className="group block">
                <h2 className="text-xl font-medium tracking-tight group-hover:underline">
                  {feed.title}
                </h2>
                {feed.summary && (
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{feed.summary}</p>
                )}
                <time className="mt-2 block text-sm text-zinc-500">
                  {feed.createdAt.toLocaleDateString("ko-KR")}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

**Step 2: 로딩 스켈레톤 작성**

```tsx
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="mb-8 h-8 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </main>
  );
}
```

**Step 3: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npx next build`
Expected: 타입 에러 없음, 빌드 성공. `/feed` 라우트가 빌드 출력에 표시됨.

**Step 4: 실제 화면 확인**

Run (백그라운드): `pnpm dev` 후
```bash
curl -s http://localhost:3010/feed | grep -o "첫 글: BY Playground 시작"
curl -s http://localhost:3010/feed | grep -c "비공개 초안"
```
Expected: 첫 번째는 제목 매칭, 두 번째는 `0`(초안 비노출 확인).

**Step 5: Commit**

```bash
git add app/feed/page.tsx app/feed/loading.tsx
git commit -m "feat(feed): 공개 피드 목록 페이지 + 로딩 스켈레톤"
```

---

## Task 8: 피드 상세 `app/feed/[slug]/page.tsx` + not-found

**Files:**
- Create: `app/feed/[slug]/page.tsx`
- Create: `app/feed/[slug]/not-found.tsx`

**Step 1: not-found 페이지 작성**

```tsx
import Link from "next/link";

export default function FeedNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">글을 찾을 수 없습니다</h1>
      <p className="mt-2 text-zinc-500">없는 글이거나 비공개 글입니다.</p>
      <Link href="/feed" className="mt-6 inline-block text-sm underline">
        피드로 돌아가기
      </Link>
    </main>
  );
}
```

**Step 2: 상세 페이지 작성**

> Next 16: `params`는 Promise이므로 `await` 한다. 본문은 서버 컴포넌트에서 `react-markdown`으로 렌더.

```tsx
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getFeedBySlug } from "@/lib/feeds";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feed = await getFeedBySlug(slug);
  return { title: feed ? `${feed.title} · BY Playground` : "Not found · BY Playground" };
}

export default async function FeedDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feed = await getFeedBySlug(slug);
  if (!feed) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <article>
        <header className="mb-8 border-b border-black/[.06] pb-6 dark:border-white/[.1]">
          <h1 className="text-3xl font-semibold tracking-tight">{feed.title}</h1>
          <time className="mt-2 block text-sm text-zinc-500">
            {feed.createdAt.toLocaleDateString("ko-KR")}
          </time>
        </header>
        <div className="flex flex-col gap-4 leading-7 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 dark:[&_code]:bg-zinc-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{feed.content}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
```

**Step 3: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npx next build`
Expected: 타입 에러 없음, 빌드 성공.

**Step 4: 실제 화면 확인**

Run (dev 서버 켜진 상태):
```bash
curl -s http://localhost:3010/feed/hello-world | grep -o "<h1[^>]*>안녕하세요</h1>"   # 마크다운 h1 렌더 확인
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3010/feed/draft-hidden       # 초안 → 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3010/feed/nope               # 없는 slug → 404
```
Expected: 첫 줄 매칭, 나머지 둘 다 `404`.

**Step 5: Commit**

```bash
git add app/feed/\[slug\]/page.tsx app/feed/\[slug\]/not-found.tsx
git commit -m "feat(feed): 피드 상세 페이지(마크다운 렌더) + not-found"
```

---

## Task 9: 최종 검증 + 정리

**Step 1: 전체 타입체크 + 빌드 + 린트**

Run:
```bash
npx tsc --noEmit && npx next build && pnpm lint
```
Expected: 모두 통과.

**Step 2: 시드 스크립트가 git에서 제외/포함 상태 점검**

`prisma/seed.ts`는 개발 편의용이므로 커밋해 둔다(Task 4에서 이미 커밋). `dev.db`는 `.gitignore`로 무시되는지 재확인:
```bash
git check-ignore -q dev.db && echo "dev.db ignored OK"
```
Expected: `dev.db ignored OK`

**Step 3: 수동 브라우저 점검 (선택)**

`pnpm dev` → http://localhost:3010 방문:
- `/` 홈 → "피드 보기" 클릭 → `/feed`
- 목록에 공개 글 2건, 초안 미표시
- 글 클릭 → 상세에서 마크다운/표 정상 렌더
- 상단 헤더 "BY Playground"(→`/`), "Feed"(→`/feed`) 동작
- 다크모드 토글(OS 설정)에서 색상 정상

**Step 4: 푸시 (사용자 승인 후)**

```bash
git push
```

---

## 작업 순서 요약

1. Post→Feed 개명 + 마이그레이션 재생성
2. react-markdown / remark-gfm 설치
3. `lib/feeds.ts` 헬퍼
4. 시드 데이터
5. 루트 레이아웃 헤더 + metadata
6. 루트 홈 교체
7. 피드 목록 + 로딩
8. 피드 상세 + not-found
9. 최종 검증 + (승인 후) 푸시
