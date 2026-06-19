# 회원가입 + 관리자 승인제 (v1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 외부 사용자가 회원가입하면 관리자 승인을 거쳐 일반 회원(비관리자)이 되고, 로그인할 수 있다.

**Architecture:** 접근법 A — 기존 관리자 인증(env 비번 + `/login` + proxy + `guardPublicAccess`)은 그대로 두고 회원 시스템을 병렬로 추가. `User` 테이블 + scrypt 해싱 + 세션 페이로드를 admin/member 판별 유니온으로 확장. 점검 모드는 admin만 통과(불변).

**Tech Stack:** Next 16 App Router · Server Actions · Prisma 7 (SQLite) · jose(JWT) · Node `crypto.scrypt` · zod · Vitest

> **설계 문서:** `docs/plans/2026-06-10-membership-approval-design.md`
> **규칙:** 기능 동반 테스트 + 버전 bump(0.5.0→0.6.0). 검증 게이트: `npx tsc --noEmit && npx eslint . && pnpm test`.

---

## Task 1: User 모델 + 마이그레이션

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1:** `prisma/schema.prisma` 끝에 모델 추가:

```prisma
// 외부 회원(관리자 아님). status로 승인 흐름 관리.
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  nickname     String
  passwordHash String              // "saltHex:hashHex" (scrypt)
  status       String   @default("pending")   // "pending" | "approved"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**Step 2:** 마이그레이션 생성·적용:

```bash
pnpm prisma migrate dev --name add_user
```

Expected: `migrations/<ts>_add_user/` 생성, "successfully applied". prisma client 재생성됨.

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(member): User 모델 + 마이그레이션"
```

---

## Task 2: 비밀번호 해싱 (TDD)

**Files:**

- Create: `lib/password.ts`
- Create: `lib/password.test.ts`

**Step 1: 실패 테스트** — `lib/password.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  test("해시 후 같은 비밀번호로 검증 성공", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });
  test("틀린 비밀번호는 검증 실패", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });
  test("같은 비밀번호도 매번 다른 해시(salt)", async () => {
    expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
  });
  test("형식이 깨진 저장값은 false", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});
```

**Step 2: 실패 확인** — `pnpm test lib/password.test.ts` → 모듈 없음 FAIL.

**Step 3: 구현** — `lib/password.ts`:

```ts
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = Buffer.from(hashHex, "hex");
  const test = (await scryptAsync(
    plain,
    Buffer.from(saltHex, "hex"),
    KEYLEN,
  )) as Buffer;
  return hash.length === test.length && timingSafeEqual(hash, test);
}
```

**Step 4: 통과 확인** — `pnpm test lib/password.test.ts` → PASS.

**Step 5: Commit**

```bash
git add lib/password.ts lib/password.test.ts
git commit -m "feat(member): scrypt 비밀번호 해싱 유틸 + 테스트"
```

---

## Task 3: 검증 스키마 + 회원 데이터 계층 (TDD)

**Files:**

- Modify: `lib/validation.ts` (스키마 추가)
- Create: `lib/users.ts`
- Create: `lib/users.test.ts`

**Step 1: 스키마** — `lib/validation.ts` 끝에 추가:

```ts
export const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력하세요."),
  nickname: z
    .string()
    .trim()
    .min(1, "닉네임을 입력하세요.")
    .max(20, "닉네임은 20자 이하."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
});
export type SignupValues = z.infer<typeof SignupSchema>;
```

**Step 2: 실패 테스트** — `lib/users.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Users = typeof import("@/lib/users");
let m: Users;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  m = await import("@/lib/users");
});
afterAll(async () => {
  await cleanup();
});

describe("users", () => {
  test("가입은 pending 회원을 만든다", async () => {
    const r = await m.createPendingUser({
      email: "A@x.com",
      nickname: "에이",
      password: "password1",
    });
    expect(r.ok).toBe(true);
    const u = await m.findUserByEmail("a@x.com"); // 소문자 정규화 확인
    expect(u?.status).toBe("pending");
  });
  test("중복 이메일은 거부", async () => {
    const r = await m.createPendingUser({
      email: "a@x.com",
      nickname: "또",
      password: "password1",
    });
    expect(r).toEqual({ ok: false, error: "이미 가입된 이메일입니다." });
  });
  test("미승인 회원은 로그인 차단", async () => {
    const r = await m.authenticateMember("a@x.com", "password1");
    expect(r).toEqual({ ok: false, error: "관리자 승인 대기 중입니다." });
  });
  test("승인 후 올바른 비밀번호로 로그인 성공", async () => {
    const u = await m.findUserByEmail("a@x.com");
    await m.approveUser(u!.id);
    const r = await m.authenticateMember("a@x.com", "password1");
    expect(r.ok).toBe(true);
  });
  test("틀린 비밀번호는 일반 메시지로 실패", async () => {
    const r = await m.authenticateMember("a@x.com", "nope");
    expect(r).toEqual({
      ok: false,
      error: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });
  });
});
```

**Step 3: 실패 확인** — `pnpm test lib/users.test.ts` → FAIL.

**Step 4: 구현** — `lib/users.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

type Result<T = undefined> =
  | { ok: true; value?: T }
  | { ok: false; error: string };

export async function createPendingUser(input: {
  email: string;
  nickname: string;
  password: string;
}): Promise<Result> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "이미 가입된 이메일입니다." };
  await prisma.user.create({
    data: {
      email,
      nickname: input.nickname.trim(),
      passwordHash: await hashPassword(input.password),
    },
  });
  return { ok: true };
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

export type AuthedMember = { id: string; nickname: string };

export async function authenticateMember(
  email: string,
  password: string,
): Promise<{ ok: true; user: AuthedMember } | { ok: false; error: string }> {
  const user = await findUserByEmail(email);
  const generic = "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (!user) return { ok: false, error: generic };
  if (!(await verifyPassword(password, user.passwordHash)))
    return { ok: false, error: generic };
  if (user.status !== "approved")
    return { ok: false, error: "관리자 승인 대기 중입니다." };
  return { ok: true, user: { id: user.id, nickname: user.nickname } };
}

export async function approveUser(id: string) {
  await prisma.user.update({ where: { id }, data: { status: "approved" } });
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });
}

export async function listUsersByStatus(status: "pending" | "approved") {
  return prisma.user.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, nickname: true, createdAt: true },
  });
}
```

**Step 5: 통과 확인** — `pnpm test lib/users.test.ts` → PASS.

**Step 6: Commit**

```bash
git add lib/validation.ts lib/users.ts lib/users.test.ts
git commit -m "feat(member): 회원 데이터 계층(가입/인증/승인) + 검증 스키마 + 테스트"
```

---

## Task 4: 세션 페이로드를 admin/member 유니온으로 확장

> 기존 `{ admin: true }`를 읽는 4곳을 모두 갱신한다: `lib/dal.ts`, `app/login/page.tsx`, `proxy.ts`, `lib/site-config.ts`.

**Files:**

- Modify: `lib/jwt.ts`, `lib/session.ts`, `lib/dal.ts`, `app/actions/auth.ts`, `app/login/page.tsx`, `proxy.ts`, `lib/site-config.ts`

**Step 1: `lib/jwt.ts`** — `SessionPayload`를 유니온으로:

```ts
export type SessionPayload =
  | { role: "admin"; expiresAt: string }
  | { role: "member"; userId: string; nickname: string; expiresAt: string };
```

(`encrypt`/`decrypt`의 `SignJWT(payload)`·캐스팅은 그대로 동작)

**Step 2: `lib/session.ts`** — admin/member 세션 생성 함수. 공통 쿠키 설정을 헬퍼로:

```ts
import "server-only";
import { cookies } from "next/headers";
import { encrypt, type SessionPayload } from "@/lib/jwt";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function setSessionCookie(payload: Omit<SessionPayload, "expiresAt">) {
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  const token = await encrypt({
    ...payload,
    expiresAt: expiresAt.toISOString(),
  } as SessionPayload);
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function createAdminSession() {
  await setSessionCookie({ role: "admin" });
}

export async function createMemberSession(userId: string, nickname: string) {
  await setSessionCookie({ role: "member", userId, nickname });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
```

**Step 3: `lib/dal.ts`** — verifySession을 role 기반으로:

```ts
export const verifySession = cache(async () => {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/login");
  return session;
});
```

**Step 4: `app/actions/auth.ts`** — `createSession` → `createAdminSession`, 로그아웃 목적지 `/`:

```ts
import { createAdminSession, deleteSession } from "@/lib/session";
// login(): await createAdminSession();  (나머지 동일)
// logout(): await deleteSession(); redirect("/");
```

**Step 5: `app/login/page.tsx`** — `session?.admin` → `session?.role === "admin"`.

**Step 6: `proxy.ts`** — `if (!session?.admin)` → `if (session?.role !== "admin")`.

**Step 7: `lib/site-config.ts`** — `guardPublicAccess` 내 `if (session?.admin) return;` → `if (session?.role === "admin") return;`.

**Step 8: 검증** — `npx tsc --noEmit && pnpm test` → 통과(기존 28 테스트 유지). `npx eslint .` 통과.

**Step 9: Commit**

```bash
git add lib/jwt.ts lib/session.ts lib/dal.ts app/actions/auth.ts app/login/page.tsx proxy.ts lib/site-config.ts
git commit -m "feat(member): 세션 페이로드 admin/member 유니온 확장"
```

---

## Task 5: 회원가입 페이지 + 액션 (`/signup`)

**Files:**

- Create: `app/signup/actions.ts`
- Create: `app/signup/signup-form.tsx`
- Create: `app/signup/page.tsx`

**Step 1: 액션** — `app/signup/actions.ts`:

```ts
"use server";
import { SignupSchema } from "@/lib/validation";
import { createPendingUser } from "@/lib/users";

export type SignupState =
  | { errors?: Record<string, string[]>; error?: string; done?: boolean }
  | undefined;

export async function signup(
  _state: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const res = await createPendingUser(parsed.data);
  if (!res.ok) return { error: res.error };
  return { done: true };
}
```

**Step 2: 폼** — `app/signup/signup-form.tsx` (client, `app/login/login-form.tsx` 스타일 따름):

```tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signup, type SignupState } from "./actions";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export default function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    signup,
    undefined,
  );
  if (state?.done) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-sm">
          가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          홈으로
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <Field
        label="이메일"
        name="email"
        type="email"
        error={state?.errors?.email}
      />
      <Field label="닉네임" name="nickname" error={state?.errors?.nickname} />
      <Field
        label="비밀번호 (8자 이상)"
        name="password"
        type="password"
        error={state?.errors?.password}
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "신청 중…" : "가입 신청"}
      </button>
      <p className="text-sm text-zinc-500">
        이미 회원이세요?{" "}
        <Link href="/signin" className="underline">
          로그인
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input id={name} name={name} type={type} className={inputCls} />
      {error && <p className="text-sm text-red-600">{error.join(" ")}</p>}
    </div>
  );
}
```

**Step 3: 페이지** — `app/signup/page.tsx`:

```tsx
import SignupForm from "./signup-form";

export const metadata = { title: "회원가입 · BY Playground" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
      <SignupForm />
    </main>
  );
}
```

**Step 4: 검증** — `npx tsc --noEmit && npx eslint app/signup` 통과.

**Step 5: Commit**

```bash
git add app/signup
git commit -m "feat(member): 회원가입 페이지 + 액션(/signup)"
```

---

## Task 6: 회원 로그인 페이지 + 액션 (`/signin`)

**Files:**

- Create: `app/signin/actions.ts`
- Create: `app/signin/signin-form.tsx`
- Create: `app/signin/page.tsx`

**Step 1: 액션** — `app/signin/actions.ts`:

```ts
"use server";
import { redirect } from "next/navigation";
import { authenticateMember } from "@/lib/users";
import { createMemberSession } from "@/lib/session";

export type SigninState = { error?: string } | undefined;

export async function signin(
  _state: SigninState,
  formData: FormData,
): Promise<SigninState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const res = await authenticateMember(email, password);
  if (!res.ok) return { error: res.error };
  await createMemberSession(res.user.id, res.user.nickname);
  redirect("/");
}
```

**Step 2: 폼** — `app/signin/signin-form.tsx` (이메일·비번 2필드, signup-form 스타일):

```tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signin, type SigninState } from "./actions";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export default function SigninForm() {
  const [state, action, pending] = useActionState<SigninState, FormData>(
    signin,
    undefined,
  );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputCls}
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "확인 중…" : "로그인"}
      </button>
      <p className="text-sm text-zinc-500">
        회원이 아니세요?{" "}
        <Link href="/signup" className="underline">
          가입 신청
        </Link>
      </p>
    </form>
  );
}
```

**Step 3: 페이지** — `app/signin/page.tsx`:

```tsx
import SigninForm from "./signin-form";

export const metadata = { title: "로그인 · BY Playground" };

export default function SigninPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
      <SigninForm />
    </main>
  );
}
```

**Step 4: 검증** — `npx tsc --noEmit && npx eslint app/signin` 통과.

**Step 5: Commit**

```bash
git add app/signin
git commit -m "feat(member): 회원 로그인 페이지 + 액션(/signin)"
```

---

## Task 7: 헤더에 로그인 상태 표시

**Files:**

- Modify: `app/layout.tsx`

**Step 1:** 헤더 `<nav>`를 세션 기반으로. `app/layout.tsx`를 async 서버 컴포넌트로 만들고 import 추가:

```tsx
import { getSession } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
```

`export default async function RootLayout(...)`로 바꾸고, 함수 본문 상단:

```tsx
const session = await getSession();
```

`<nav className="text-sm">` 내부를 교체:

```tsx
<nav className="flex items-center gap-4 text-sm">
  <Link
    href="/feed"
    className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
  >
    Feed
  </Link>
  {session?.role === "member" ? (
    <>
      <span className="text-zinc-500">{session.nickname}</span>
      <form action={logout}>
        <button
          type="submit"
          className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          로그아웃
        </button>
      </form>
    </>
  ) : session?.role === "admin" ? (
    <Link
      href="/admin"
      className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      관리자
    </Link>
  ) : (
    <Link
      href="/signin"
      className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      로그인
    </Link>
  )}
</nav>
```

**Step 2: 검증** — `npx tsc --noEmit && npx eslint app/layout.tsx` 통과. (`getSession`이 cookies를 읽으므로 레이아웃이 동적 렌더됨 — 정상)

**Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(member): 헤더에 로그인 상태(닉네임/로그아웃·로그인) 표시"
```

---

## Task 8: 어드민 승인 UI + 액션 (`/admin`)

**Files:**

- Modify: `app/admin/actions.ts` (액션 추가)
- Modify: `app/admin/page.tsx` (대기/승인 회원 섹션)

**Step 1: 액션** — `app/admin/actions.ts`에 import + 액션 추가:

```ts
import { approveUser, deleteUser } from "@/lib/users";

export async function approveUserAction(formData: FormData) {
  await verifySession();
  await approveUser(String(formData.get("id") ?? ""));
  revalidatePath("/admin");
}

export async function removeUserAction(formData: FormData) {
  await verifySession();
  await deleteUser(String(formData.get("id") ?? ""));
  revalidatePath("/admin");
}
```

(거절·회원삭제 모두 `deleteUser` → `removeUserAction` 하나로 처리)

**Step 2: UI** — `app/admin/page.tsx`에서 데이터 로드 + 섹션 추가. import:

```ts
import { listUsersByStatus } from "@/lib/users";
import { approveUserAction, removeUserAction } from "@/app/admin/actions";
```

`Promise.all`에 추가:

```ts
const [feeds, publicEnabled, pending, members] = await Promise.all([
  getAllFeeds(),
  getPublicEnabled(),
  listUsersByStatus("pending"),
  listUsersByStatus("approved"),
]);
```

사이트 토글 카드 아래(글 목록 위)에 섹션 삽입:

```tsx
<section className="mb-8">
  <h2 className="mb-3 text-lg font-semibold tracking-tight">
    가입 대기 회원 ({pending.length})
  </h2>
  {pending.length === 0 ? (
    <p className="text-sm text-zinc-500">대기 중인 신청이 없습니다.</p>
  ) : (
    <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
      {pending.map((u) => (
        <li
          key={u.id}
          className="flex items-center justify-between gap-3 py-2 text-sm"
        >
          <span className="min-w-0 truncate">
            {u.nickname} · {u.email}
          </span>
          <span className="flex shrink-0 gap-2">
            <form action={approveUserAction}>
              <input type="hidden" name="id" value={u.id} />
              <button className="rounded border border-black/15 px-2 py-1 dark:border-white/20">
                승인
              </button>
            </form>
            <form action={removeUserAction}>
              <input type="hidden" name="id" value={u.id} />
              <button className="rounded border border-red-300 px-2 py-1 text-red-600">
                거절
              </button>
            </form>
          </span>
        </li>
      ))}
    </ul>
  )}
  <h2 className="mt-6 mb-3 text-lg font-semibold tracking-tight">
    회원 ({members.length})
  </h2>
  {members.length === 0 ? (
    <p className="text-sm text-zinc-500">승인된 회원이 없습니다.</p>
  ) : (
    <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
      {members.map((u) => (
        <li
          key={u.id}
          className="flex items-center justify-between gap-3 py-2 text-sm"
        >
          <span className="min-w-0 truncate">
            {u.nickname} · {u.email}
          </span>
          <form action={removeUserAction}>
            <input type="hidden" name="id" value={u.id} />
            <button className="rounded border border-red-300 px-2 py-1 text-red-600">
              삭제
            </button>
          </form>
        </li>
      ))}
    </ul>
  )}
</section>
```

**Step 3: 검증** — `npx tsc --noEmit && npx eslint app/admin` 통과.

**Step 4: Commit**

```bash
git add app/admin/actions.ts app/admin/page.tsx
git commit -m "feat(admin): 가입 대기/회원 목록 + 승인·거절·삭제"
```

---

## Task 9: 버전 bump + 최종 검증 + PR

**Step 1: 버전** — `package.json` `"version": "0.5.0"` → `"0.6.0"`.

**Step 2: 게이트**

```bash
npx tsc --noEmit && npx eslint . && pnpm test && rm -rf .next && npx next build
```

Expected: 모두 통과. 테스트는 기존 28 + password 4 + users 5 = 37개.

**Step 3: 로컬 수동 검증** (`pnpm dev`)

- `/signup`에서 가입 → "승인 대기" 안내.
- 미승인 상태로 `/signin` 로그인 시 "관리자 승인 대기 중" 에러.
- 관리자 `/login` → `/admin`에서 대기 회원 **승인**.
- `/signin` 재로그인 성공 → 헤더에 닉네임·로그아웃 표시. `/admin` 접근 시 `/login`로 차단되는지 확인.
- 점검 모드 ON → 회원도 `/maintenance`로(admin만 통과) 확인.

**Step 4: Commit + PR**

```bash
git add package.json
git commit -m "chore: 버전 0.5.0 → 0.6.0 (회원가입+승인제)"
git push -u origin feature/membership-approval
gh pr create --base main --title "feat: 회원가입 + 관리자 승인제 (v1)" --body "..."
```

**Step 5: PR 본문 주의** — `User` 테이블 마이그레이션 포함(배포 시 `migrate deploy` 자동). 세션 페이로드 변경으로 **기존 관리자 세션 1회 재로그인** 필요.

---

## 작업 순서 요약

1 User 모델 → 2 해싱(TDD) → 3 데이터계층(TDD) → 4 세션 유니온 → 5 가입 페이지 → 6 로그인 페이지 → 7 헤더 → 8 어드민 승인 UI → 9 버전+검증+PR
