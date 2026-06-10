# 관리자 + 인증 (3단계) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 단일 관리자가 로그인해 `/admin`에서 글(Feed)을 작성·수정·삭제·공개토글하고, 구현 완료 후 Vitest로 순수 로직 단위 테스트를 추가한다.

**Architecture:** `jose` JWT를 httpOnly 쿠키로 발급하는 stateless 세션. 순수 JWT(`lib/jwt.ts`)와 쿠키 바인딩(`lib/session.ts`)을 분리해 테스트 가능성을 확보. 보호는 `proxy.ts`(optimistic) + `lib/dal.ts`의 `verifySession()`(페이지/Server Action 재검증) 다층. 글 변경은 Server Actions + zod 검증.

**Tech Stack:** Next.js 16, React 19, Prisma 7(SQLite), jose, zod, Vitest + React Testing Library

> **검증:** 구현 단계는 `tsc`/`build`/`eslint` + prod 수동 시나리오. 테스트 단계에서 Vitest 도입. `async` 서버 컴포넌트·Server Action은 Vitest 미지원이라 단위 테스트 제외(prod 수동으로 커버).

> **설계 문서:** `docs/plans/2026-06-04-admin-auth-design.md`
> **사용자 요구:** 기능을 먼저 전부 구현하고, 그 다음 Vitest 테스트 코드를 작성한다(TDD 아님, 사후 테스트).

---

## Part A — 기능 구현

## Task 1: 의존성 + 환경변수 템플릿

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `.env.example`

**Step 1: 설치**
```bash
pnpm add jose zod
```

**Step 2: `.env.example` 작성** (키 이름만 — 실제 값은 `.env`에, gitignore됨)
```bash
# 관리자 로그인 비밀번호 (평문)
ADMIN_PASSWORD="change-me"
# 세션 JWT 서명 키: openssl rand -base64 32 로 생성
SESSION_SECRET="generate-with-openssl-rand-base64-32"
# 기존
DATABASE_URL="file:./dev.db"
```

**Step 3: 로컬 `.env`에 값 추가** (사용자가 직접/또는 확인). 개발용 임시값:
```bash
# .env 에 아래 두 줄 추가 (SESSION_SECRET은 openssl rand -base64 32 결과로 교체 권장)
ADMIN_PASSWORD="admin1234"
SESSION_SECRET="<openssl rand -base64 32 결과>"
```
확인: `node -e "require('dotenv').config(); console.log(!!process.env.ADMIN_PASSWORD, !!process.env.SESSION_SECRET)"` → `true true`

**Step 4: Commit**
```bash
git add package.json pnpm-lock.yaml .env.example
git commit -m "build: jose, zod 추가 + .env.example(ADMIN_PASSWORD, SESSION_SECRET)"
```

---

## Task 2: 세션 레이어 (jwt / session / dal)

**Files:**
- Create: `lib/jwt.ts` (순수 JWT — server-only 없음, Vitest 대상)
- Create: `lib/session.ts` (쿠키 바인딩, server-only)
- Create: `lib/dal.ts` (verifySession)

**Step 1: `lib/jwt.ts`**
```ts
import { SignJWT, jwtVerify } from "jose";

export type SessionPayload = { admin: true; expiresAt: string };

const encodedKey = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey());
}

export async function decrypt(token?: string): Promise<SessionPayload | undefined> {
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, encodedKey(), { algorithms: ["HS256"] });
    return payload as SessionPayload;
  } catch {
    return undefined;
  }
}
```

**Step 2: `lib/session.ts`**
```ts
import "server-only";
import { cookies } from "next/headers";
import { encrypt } from "@/lib/jwt";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession() {
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  const token = await encrypt({ admin: true, expiresAt: expiresAt.toISOString() });
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
```

**Step 3: `lib/dal.ts`**
```ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/lib/jwt";

// 세션이 있으면 payload, 없으면 undefined (redirect 안 함)
export const getSession = cache(async () => {
  const token = (await cookies()).get("session")?.value;
  return decrypt(token);
});

// 보호용: 세션 없으면 /login로 redirect
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.admin) redirect("/login");
  return session;
});
```

**Step 4: 타입체크**
Run: `npx tsc --noEmit`
Expected: 에러 없음.

**Step 5: Commit**
```bash
git add lib/jwt.ts lib/session.ts lib/dal.ts
git commit -m "feat(auth): jose 세션 레이어(jwt/session/dal) 추가"
```

---

## Task 3: zod 검증 스키마

**Files:**
- Create: `lib/validation.ts`

**Step 1: 작성**
```ts
import { z } from "zod";

export const FeedFormSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요."),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "slug는 소문자·숫자·하이픈(-)만 사용할 수 있습니다."),
  summary: z.string().trim().optional(),
  content: z.string().min(1, "본문을 입력하세요."),
  published: z.boolean(),
});

export type FeedFormValues = z.infer<typeof FeedFormSchema>;

// FormData → 파싱 입력 객체 (체크박스는 존재 여부로 boolean)
export function feedFormToObject(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    content: String(formData.get("content") ?? ""),
    published: formData.get("published") === "on" || formData.get("published") === "true",
  };
}
```

**Step 2: 타입체크** — `npx tsc --noEmit` → 에러 없음.

**Step 3: Commit**
```bash
git add lib/validation.ts
git commit -m "feat(feed): zod FeedFormSchema + FormData 파서"
```

---

## Task 4: 관리자용 데이터 헬퍼 확장

**Files:**
- Modify: `lib/feeds.ts`

**Step 1: 아래 두 함수 추가** (기존 공개용 함수 위/아래에 append)
```ts
// 관리자용: 초안 포함 전체, 최신순
export async function getAllFeeds() {
  return prisma.feed.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, published: true, createdAt: true },
  });
}

// 관리자용: 공개 여부 무관 단건(id)
export async function getFeedById(id: string) {
  return prisma.feed.findUnique({ where: { id } });
}
```

**Step 2: 타입체크** — `npx tsc --noEmit` → 에러 없음.

**Step 3: Commit**
```bash
git add lib/feeds.ts
git commit -m "feat(feed): 관리자용 getAllFeeds/getFeedById 추가"
```

---

## Task 5: 인증 액션 + 로그인 페이지

**Files:**
- Create: `app/actions/auth.ts`
- Create: `app/login/page.tsx`
- Create: `app/login/login-form.tsx`

**Step 1: `app/actions/auth.ts`**
```ts
"use server";
import { timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
```

**Step 2: `app/login/login-form.tsx`** (client, useActionState)
```tsx
"use client";
import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <label htmlFor="password" className="text-sm font-medium">비밀번호</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        className="rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
```

**Step 3: `app/login/page.tsx`** (이미 로그인 상태면 /admin로)
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import LoginForm from "./login-form";

export const metadata = { title: "로그인 · BY Playground" };

export default async function LoginPage() {
  const session = await getSession();
  if (session?.admin) redirect("/admin");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">관리자 로그인</h1>
      <LoginForm />
    </main>
  );
}
```

**Step 4: 타입체크** — `npx tsc --noEmit` → 에러 없음.

**Step 5: Commit**
```bash
git add app/actions/auth.ts app/login
git commit -m "feat(auth): 로그인/로그아웃 액션 + 로그인 페이지"
```

---

## Task 6: proxy.ts (optimistic 보호)

**Files:**
- Create: `proxy.ts` (프로젝트 루트, app과 같은 레벨)

**Step 1: 작성**
```ts
import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/jwt";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const session = await decrypt(token);
  if (!session?.admin) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

**Step 2: 타입체크 + 빌드** — `npx tsc --noEmit && npx next build` → 성공, proxy가 빌드 로그에 인식됨.

**Step 3: Commit**
```bash
git add proxy.ts
git commit -m "feat(auth): /admin proxy 보호(미인증 시 /login)"
```

---

## Task 7: admin 레이아웃 (보호 + 로그아웃)

**Files:**
- Create: `app/admin/layout.tsx`

**Step 1: 작성**
```tsx
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

export const metadata = { title: "관리자 · BY Playground" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await verifySession(); // 미인증 시 /login redirect

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <div className="mb-8 flex items-center justify-between border-b border-black/[.08] pb-4 dark:border-white/[.145]">
        <nav className="flex gap-4 text-sm">
          <Link href="/admin" className="font-semibold">관리자</Link>
          <Link href="/admin/new" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">새 글</Link>
        </nav>
        <form action={logout}>
          <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            로그아웃
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
```

**Step 2: 타입체크** — `npx tsc --noEmit` → 에러 없음.

**Step 3: Commit**
```bash
git add app/admin/layout.tsx
git commit -m "feat(admin): 보호된 admin 레이아웃 + 로그아웃"
```

---

## Task 8: admin 액션 (CRUD + 공개토글)

**Files:**
- Create: `app/admin/actions.ts`

**Step 1: 작성**
```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { FeedFormSchema, feedFormToObject } from "@/lib/validation";

export type FeedFormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

function revalidateFeed() {
  revalidatePath("/feed", "layout"); // 목록 + 모든 상세
  revalidatePath("/admin");
}

export async function createFeed(_state: FeedFormState, formData: FormData): Promise<FeedFormState> {
  await verifySession();
  const parsed = FeedFormSchema.safeParse(feedFormToObject(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await prisma.feed.create({ data: parsed.data });
  } catch (e) {
    return { message: "이미 사용 중인 slug일 수 있습니다.", errors: { slug: ["중복되었거나 저장에 실패했습니다."] } };
  }
  revalidateFeed();
  redirect("/admin");
}

export async function updateFeed(id: string, _state: FeedFormState, formData: FormData): Promise<FeedFormState> {
  await verifySession();
  const parsed = FeedFormSchema.safeParse(feedFormToObject(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await prisma.feed.update({ where: { id }, data: parsed.data });
  } catch (e) {
    return { message: "저장 실패(중복 slug 등).", errors: { slug: ["중복되었거나 저장에 실패했습니다."] } };
  }
  revalidateFeed();
  redirect("/admin");
}

export async function deleteFeed(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  await prisma.feed.delete({ where: { id } });
  revalidateFeed();
}

export async function togglePublished(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  const feed = await prisma.feed.findUnique({ where: { id }, select: { published: true } });
  if (!feed) return;
  await prisma.feed.update({ where: { id }, data: { published: !feed.published } });
  revalidateFeed();
}
```

**Step 2: 타입체크** — `npx tsc --noEmit` → 에러 없음.

**Step 3: Commit**
```bash
git add app/admin/actions.ts
git commit -m "feat(admin): createFeed/updateFeed/deleteFeed/togglePublished 액션"
```

---

## Task 9: FeedForm 공유 컴포넌트 + new/edit 페이지

**Files:**
- Create: `app/admin/feed-form.tsx`
- Create: `app/admin/new/page.tsx`
- Create: `app/admin/[id]/edit/page.tsx`

**Step 1: `app/admin/feed-form.tsx`** (client, 생성·수정 공용)
```tsx
"use client";
import { useActionState } from "react";
import type { FeedFormState } from "@/app/admin/actions";

type Props = {
  action: (state: FeedFormState, formData: FormData) => Promise<FeedFormState>;
  defaultValues?: {
    title?: string;
    slug?: string;
    summary?: string | null;
    content?: string;
    published?: boolean;
  };
  submitLabel: string;
};

export default function FeedForm({ action, defaultValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<FeedFormState, FormData>(action, undefined);
  const d = defaultValues ?? {};
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="제목" error={err.title}>
        <input name="title" defaultValue={d.title} className={inputCls} />
      </Field>
      <Field label="slug (소문자·숫자·하이픈)" error={err.slug}>
        <input name="slug" defaultValue={d.slug} className={inputCls} />
      </Field>
      <Field label="요약 (선택)" error={err.summary}>
        <input name="summary" defaultValue={d.summary ?? ""} className={inputCls} />
      </Field>
      <Field label="본문 (마크다운)" error={err.content}>
        <textarea name="content" defaultValue={d.content} rows={12} className={inputCls} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={d.published} />
        공개
      </label>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50">
        {pending ? "저장 중…" : submitLabel}
      </button>
    </form>
  );
}

const inputCls = "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

function Field({ label, error, children }: { label: string; error?: string[]; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-sm text-red-600">{error.join(" ")}</p>}
    </div>
  );
}
```

**Step 2: `app/admin/new/page.tsx`**
```tsx
import FeedForm from "@/app/admin/feed-form";
import { createFeed } from "@/app/admin/actions";

export default function NewFeedPage() {
  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">새 글</h1>
      <FeedForm action={createFeed} submitLabel="작성" />
    </section>
  );
}
```

**Step 3: `app/admin/[id]/edit/page.tsx`** (id로 조회, 없으면 404, updateFeed에 id bind)
```tsx
import { notFound } from "next/navigation";
import FeedForm from "@/app/admin/feed-form";
import { updateFeed } from "@/app/admin/actions";
import { getFeedById } from "@/lib/feeds";

export default async function EditFeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feed = await getFeedById(id);
  if (!feed) notFound();

  const action = updateFeed.bind(null, feed.id);
  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">글 수정</h1>
      <FeedForm
        action={action}
        submitLabel="수정"
        defaultValues={{
          title: feed.title,
          slug: feed.slug,
          summary: feed.summary,
          content: feed.content,
          published: feed.published,
        }}
      />
    </section>
  );
}
```

**Step 4: 타입체크** — `npx tsc --noEmit` → 에러 없음.

**Step 5: Commit**
```bash
git add app/admin/feed-form.tsx app/admin/new app/admin/\[id\]
git commit -m "feat(admin): 글 작성/수정 폼(FeedForm) + new/edit 페이지"
```

---

## Task 10: admin 목록 페이지

**Files:**
- Create: `app/admin/page.tsx`

**Step 1: 작성** (전체 글 + 공개토글/수정/삭제)
```tsx
import Link from "next/link";
import { getAllFeeds } from "@/lib/feeds";
import { deleteFeed, togglePublished } from "@/app/admin/actions";

export default async function AdminListPage() {
  const feeds = await getAllFeeds();

  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">글 목록</h1>
      {feeds.length === 0 ? (
        <p className="text-zinc-500">글이 없습니다. <Link href="/admin/new" className="underline">새 글 작성</Link></p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {feeds.map((feed) => (
            <li key={feed.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{feed.title}</p>
                <p className="truncate text-sm text-zinc-500">
                  /{feed.slug} · {feed.published ? "공개" : "비공개"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <form action={togglePublished}>
                  <input type="hidden" name="id" value={feed.id} />
                  <button type="submit" className="rounded border border-black/15 px-2 py-1 dark:border-white/20">
                    {feed.published ? "비공개로" : "공개로"}
                  </button>
                </form>
                <Link href={`/admin/${feed.id}/edit`} className="rounded border border-black/15 px-2 py-1 dark:border-white/20">수정</Link>
                <form action={deleteFeed}>
                  <input type="hidden" name="id" value={feed.id} />
                  <button type="submit" className="rounded border border-red-300 px-2 py-1 text-red-600">삭제</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

**Step 2: 타입체크 + 빌드** — `npx tsc --noEmit && npx next build` → 성공. `/login`, `/admin`, `/admin/new`, `/admin/[id]/edit` 라우트 표시.

**Step 3: Commit**
```bash
git add app/admin/page.tsx
git commit -m "feat(admin): 글 목록 페이지(공개토글/수정/삭제)"
```

---

## Task 11: prod 통합 시나리오 검증

> dev.db 시드가 비어있으면 `DATABASE_URL="file:./dev.db" npx tsx prisma/seed.ts`. `.env`에 ADMIN_PASSWORD/SESSION_SECRET 필요.

**Step 1: 빌드 + prod 기동**
```bash
rm -rf .next && npx next build && (npx next start -p 3010 &)  # 포트 점유 확인 후
```

**Step 2: 시나리오(쿠키 jar 사용)**
```bash
J=$(mktemp)
# 1) 미로그인 /admin → /login 리다이렉트(또는 307/302)
curl -s -o /dev/null -w "admin 미인증=%{http_code}\n" http://localhost:3010/admin
# 2) 로그인(폼 POST는 Server Action이라 curl 재현이 복잡 → 브라우저 수동 권장)
```
**핵심: 로그인/CRUD는 Server Action(POST, 직렬화 페이로드)이라 curl 재현이 번거롭다. 브라우저로 수동 검증을 권장:**
- `/admin` 접속 → `/login`로 튕김
- 비번 입력 → `/admin` 진입
- 새 글 작성(공개 체크) → `/feed`와 `/feed/<slug>`에 노출
- slug에 대문자/공백 입력 → 검증 에러 표시
- 공개→비공개 토글 → `/feed/<slug>` 404, 목록에서 사라짐
- 수정 → 반영
- 삭제 → 목록에서 제거
- 로그아웃 → `/admin` 접근 시 `/login`

**Step 3: prod 서버 종료** (`lsof -ti:3010 | xargs kill -9`)

**Step 4: (선택) 검증 메모를 PR에 기록.** 코드 변경 없으면 커밋 없음.

---

## Part B — Vitest 단위 테스트 (+ React Testing Library)

## Task 12: Vitest 셋업

**Files:**
- Modify: `package.json`, `tsconfig.json`
- Create: `vitest.config.mts`, `vitest.setup.ts`
- Modify: `.gitignore` (coverage)

**Step 1: 설치**
```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths
```

**Step 2: `vitest.config.mts`** (tsconfigPaths로 `@/*` 별칭 해결, jsdom 환경, globals)
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

**Step 3: `vitest.setup.ts`** (jest-dom matchers + 테스트용 세션 키)
```ts
import "@testing-library/jest-dom/vitest";

process.env.SESSION_SECRET ||= "test-session-secret-please-change";
```

**Step 4: `tsconfig.json` compilerOptions.types에 vitest globals 추가** (없으면 추가)
```jsonc
"types": ["vitest/globals"]
```

**Step 5: `package.json` 스크립트에 추가** (CI는 단발 실행 `vitest run`)
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 6: `.gitignore`에 `/coverage` 추가**

**Step 7: 동작 확인용 임시 테스트** — `__tests__/smoke.test.ts`:
```ts
test("vitest 동작", () => { expect(1 + 1).toBe(2); });
```
Run: `pnpm test`
Expected: 1 passed. 확인 후 `rm __tests__/smoke.test.ts`.

**Step 8: Commit**
```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.mts vitest.setup.ts .gitignore
git commit -m "test: Vitest + React Testing Library 셋업"
```

---

## Task 13: validation + jwt 단위 테스트

**Files:**
- Create: `lib/validation.test.ts`
- Create: `lib/jwt.test.ts`

**Step 1: `lib/validation.test.ts`**
```ts
import { FeedFormSchema, feedFormToObject } from "@/lib/validation";

describe("FeedFormSchema", () => {
  const valid = { title: "제목", slug: "hello-world", summary: "", content: "본문", published: true };

  test("유효한 입력을 통과시킨다", () => {
    expect(FeedFormSchema.safeParse(valid).success).toBe(true);
  });

  test.each([["대문자", "Hello"], ["공백", "hello world"], ["언더스코어", "hello_world"], ["빈값", ""]])(
    "잘못된 slug(%s)를 거부한다",
    (_label, slug) => {
      const r = FeedFormSchema.safeParse({ ...valid, slug });
      expect(r.success).toBe(false);
    },
  );

  test("title이 비면 거부한다", () => {
    expect(FeedFormSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
  });

  test("content가 비면 거부한다", () => {
    expect(FeedFormSchema.safeParse({ ...valid, content: "" }).success).toBe(false);
  });
});

describe("feedFormToObject", () => {
  test("체크박스 on을 boolean true로 변환한다", () => {
    const fd = new FormData();
    fd.set("title", "t"); fd.set("slug", "s"); fd.set("content", "c"); fd.set("published", "on");
    expect(feedFormToObject(fd).published).toBe(true);
  });

  test("published 없으면 false", () => {
    const fd = new FormData();
    expect(feedFormToObject(fd).published).toBe(false);
  });
});
```

**Step 2: `lib/jwt.test.ts`** (node 환경 — web crypto)
```ts
// @vitest-environment node
import { describe, test, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/jwt";

describe("jwt encrypt/decrypt", () => {
  test("라운드트립: payload를 복원한다", async () => {
    const token = await encrypt({ admin: true, expiresAt: "2099-01-01T00:00:00.000Z" });
    const payload = await decrypt(token);
    expect(payload?.admin).toBe(true);
    expect(payload?.expiresAt).toBe("2099-01-01T00:00:00.000Z");
  });

  test("토큰이 없으면 undefined", async () => {
    expect(await decrypt(undefined)).toBeUndefined();
  });

  test("변조된 토큰은 undefined", async () => {
    const token = await encrypt({ admin: true, expiresAt: "2099-01-01T00:00:00.000Z" });
    expect(await decrypt(token + "tampered")).toBeUndefined();
  });
});
```

**Step 3: 실행** — `pnpm test`
Expected: 두 파일 모든 테스트 PASS.

**Step 4: Commit**
```bash
git add lib/validation.test.ts lib/jwt.test.ts
git commit -m "test: validation 스키마 + jwt 라운드트립 단위 테스트"
```

---

## Task 14: 동기 컴포넌트 렌더 테스트

**Files:**
- Create: `app/feed/[slug]/not-found.test.tsx`

> `not-found.tsx`, `loading.tsx`는 동기 컴포넌트라 RTL 렌더 가능. async 페이지는 제외.

**Step 1: `app/feed/[slug]/not-found.test.tsx`**
```tsx
import { render, screen } from "@testing-library/react";
import FeedNotFound from "./not-found";

describe("FeedNotFound", () => {
  test("안내 문구와 피드로 돌아가는 링크를 렌더한다", () => {
    render(<FeedNotFound />);
    expect(screen.getByText("글을 찾을 수 없습니다")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "피드로 돌아가기" });
    expect(link).toHaveAttribute("href", "/feed");
  });
});
```

**Step 2: 실행** — `pnpm test`
Expected: 전체 PASS.

**Step 3: Commit**
```bash
git add app/feed/\[slug\]/not-found.test.tsx
git commit -m "test: FeedNotFound 동기 컴포넌트 렌더 테스트"
```

---

## Task 15: 최종 검증 + 푸시/PR

**Step 1: 전체 게이트**
```bash
npx tsc --noEmit && npx eslint . && pnpm test && rm -rf .next && npx next build
```
Expected: 타입·lint·테스트·빌드 모두 통과.

**Step 2: dev.db 무시 재확인** — `git check-ignore -q dev.db && echo OK`

**Step 3: 푸시 + PR** (사용자 승인 후)
```bash
git push -u origin feature/admin-auth
gh pr create --base main --head feature/admin-auth --title "관리자 + 인증 (3단계) + Vitest 테스트" --body "..."
```

---

## 작업 순서 요약

**Part A (구현):** 1 의존성·env → 2 세션레이어 → 3 zod → 4 헬퍼확장 → 5 로그인 → 6 proxy → 7 admin레이아웃 → 8 admin액션 → 9 폼·new·edit → 10 목록 → 11 수동검증
**Part B (테스트):** 12 Vitest셋업 → 13 validation·jwt → 14 컴포넌트 → 15 최종검증·PR
