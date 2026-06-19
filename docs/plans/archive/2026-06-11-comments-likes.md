# 회원 댓글(2뎁스) + 좋아요 (v1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 공개 피드 상세에서 승인 회원·관리자가 댓글(2뎁스)·좋아요를 남기고, 비로그인 시도 시 로그인 유도 모달을 띄운다.

**Architecture:** 자기참조 `Comment`(parentId, 2뎁스 강제) + `Like`(feed,user unique). 관리자는 예약 admin User로 작성. 데이터 계층은 임시 SQLite 통합 테스트, 서버 액션이 actor를 검증해 anon 차단. 상세 페이지(서버)가 목록·카운트를 렌더하고 클라이언트 컴포넌트가 액션·모달을 담당.

**Tech Stack:** Next 16 App Router · Server Actions · Prisma 7 (SQLite) · zod · Vitest

> **설계:** `docs/plans/2026-06-11-comments-likes-design.md`
> **규칙:** 기능 동반 테스트 + 버전 bump(0.8.0→0.9.0). 게이트: `npx tsc --noEmit && npx eslint . && pnpm test`.
> **추가 요구:** 댓글 ≤2000자(입력 제한+서버 검증), 줄바꿈 보존, 3줄 초과 시 ellipsis + 더보기/접기.

---

## Task 1: Comment/Like 모델 + 마이그레이션

**Files:** Modify `prisma/schema.prisma`, `lib/test-db.ts`

**Step 1:** `Feed`/`User` 모델에 역참조 추가, 새 모델 추가. `Feed` 모델 닫는 `}` 직전에:

```prisma
  comments  Comment[]
  likes     Like[]
```

`User` 모델 닫는 `}` 직전에:

```prisma
  comments  Comment[]
  likes     Like[]
```

파일 끝에:

```prisma
model Comment {
  id        String    @id @default(uuid())
  feedId    String
  userId    String
  parentId  String?
  content   String
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  feed      Feed      @relation(fields: [feedId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id])
  parent    Comment?  @relation("replies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[] @relation("replies")

  @@index([feedId])
  @@index([parentId])
}

model Like {
  id        String   @id @default(uuid())
  feedId    String
  userId    String
  createdAt DateTime @default(now())
  feed      Feed     @relation(fields: [feedId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])

  @@unique([feedId, userId])
}
```

**Step 2:** 마이그레이션 생성·적용:

```bash
pnpm prisma migrate dev --name add_comment_like
```

Expected: 새 마이그레이션 폴더 생성·적용, prisma client 재생성.

**Step 3:** `lib/test-db.ts`의 SCHEMA 배열에 Comment/Like DDL 추가(마이그레이션 SQL과 동일). 마이그레이션 SQL을 열어 `CREATE TABLE "Comment" ...`, `CREATE TABLE "Like" ...`, 관련 INDEX/UNIQUE 구문을 그대로 SCHEMA 배열 문자열로 복사. (파일 기존 스타일 따름)

**Step 4: 검증** — `pnpm test`(기존 44 그대로 통과, test-db가 새 테이블 만들어도 무해).

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/test-db.ts
git commit -m "feat(comment): Comment/Like 모델 + 마이그레이션 + test-db DDL"
```

---

## Task 2: 예약 admin User + actor 헬퍼 (TDD)

**Files:** Create `lib/comment-actor.ts`, `lib/comment-actor.test.ts`

**Step 1: 실패 테스트** — `lib/comment-actor.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";

vi.mock("server-only", () => ({}));

type Mod = typeof import("@/lib/comment-actor");
let m: Mod;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  m = await import("@/lib/comment-actor");
});
afterAll(async () => {
  await cleanup();
});

describe("admin user / nickname", () => {
  test("ensureAdminUser는 예약 User를 1회 생성(멱등)", async () => {
    const a = await m.ensureAdminUser();
    const b = await m.ensureAdminUser();
    expect(a.id).toBe(b.id);
    expect(a.email).toBe("admin@byjang.local");
  });
  test("기본 닉네임은 관리자, setAdminNickname로 변경", async () => {
    expect(await m.getAdminNickname()).toBe("관리자");
    await m.setAdminNickname("운영자");
    expect(await m.getAdminNickname()).toBe("운영자");
  });
});
```

**Step 2: 실패 확인** — `pnpm test lib/comment-actor.test.ts` → FAIL.

**Step 3: 구현** — `lib/comment-actor.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/dal";

export const ADMIN_EMAIL = "admin@byjang.local";
const ADMIN_DEFAULT_NICKNAME = "관리자";

// 관리자 작성용 예약 User(싱글톤). 로그인 불가 해시("-": salt:hash 형식 아님).
export async function ensureAdminUser() {
  return prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      nickname: ADMIN_DEFAULT_NICKNAME,
      passwordHash: "-",
      status: "approved",
    },
  });
}

export async function getAdminNickname() {
  const u = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { nickname: true },
  });
  return u?.nickname ?? ADMIN_DEFAULT_NICKNAME;
}

export async function setAdminNickname(nickname: string) {
  const name = nickname.trim() || ADMIN_DEFAULT_NICKNAME;
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { nickname: name },
    create: {
      email: ADMIN_EMAIL,
      nickname: name,
      passwordHash: "-",
      status: "approved",
    },
  });
}

export type CommentActor = { userId: string; nickname: string };

// 현재 세션의 작성 주체(member|admin). anon이면 null.
export async function getCommentActor(): Promise<CommentActor | null> {
  const session = await getSession();
  if (session?.role === "member")
    return { userId: session.userId, nickname: session.nickname };
  if (session?.role === "admin") {
    const admin = await ensureAdminUser();
    return { userId: admin.id, nickname: admin.nickname };
  }
  return null;
}
```

**Step 4: 통과 확인** — `pnpm test lib/comment-actor.test.ts` → PASS.

**Step 5: Commit**

```bash
git add lib/comment-actor.ts lib/comment-actor.test.ts
git commit -m "feat(comment): 예약 admin User + actor/닉네임 헬퍼 + 테스트"
```

---

## Task 3: 회원 목록/카운트에서 예약 admin 제외

**Files:** Modify `lib/users.ts`, `lib/users.test.ts`

**Step 1: 테스트 보강** — `lib/users.test.ts`의 `describe("users")` 끝에 추가:

```ts
test("예약 admin User는 회원 목록/카운트에서 제외", async () => {
  const { ensureAdminUser } = await import("@/lib/comment-actor");
  await ensureAdminUser();
  const before = await m.countUsersByStatus("approved");
  const list = await m.listUsersByStatus("approved");
  expect(list.some((u) => u.email === "admin@byjang.local")).toBe(false);
  // 예약 admin이 카운트에 포함되지 않음(approved 회원 수만)
  expect(before).toBe(list.length);
});
```

**Step 2:** `lib/users.ts`에서 `listUsersByStatus`·`countUsersByStatus`의 where에 예약 이메일 제외 추가. 상단에 `import { ADMIN_EMAIL } from "@/lib/comment-actor";` (순환 import 주의 — comment-actor가 users를 import하지 않으므로 안전). 각 함수 where:

```ts
where: { status, email: { not: ADMIN_EMAIL } },
```

**Step 3: 검증** — `pnpm test lib/users.test.ts` → PASS.

**Step 4: Commit**

```bash
git add lib/users.ts lib/users.test.ts
git commit -m "feat(comment): 예약 admin User를 회원 목록/카운트에서 제외"
```

---

## Task 4: 검증 스키마 + 댓글 데이터 계층 (TDD)

**Files:** Modify `lib/validation.ts`; Create `lib/comments.ts`, `lib/comments.test.ts`

**Step 1: 스키마** — `lib/validation.ts` 끝에:

```ts
export const CommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력하세요.")
    .max(2000, "댓글은 2000자 이하여야 합니다."),
});
```

**Step 2: 실패 테스트** — `lib/comments.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Mod = typeof import("@/lib/comments");
let m: Mod;
let prisma: import("@/app/generated/prisma/client").PrismaClient;
let cleanup: () => Promise<void>;
let feedId: string;
let alice: string;
let bob: string;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  const feed = await prisma.feed.create({
    data: { slug: "f1", title: "F", content: "c", published: true },
  });
  feedId = feed.id;
  const a = await prisma.user.create({
    data: {
      email: "a@x.com",
      nickname: "앨리스",
      passwordHash: "-",
      status: "approved",
    },
  });
  const b = await prisma.user.create({
    data: {
      email: "b@x.com",
      nickname: "밥",
      passwordHash: "-",
      status: "approved",
    },
  });
  alice = a.id;
  bob = b.id;
  m = await import("@/lib/comments");
});
afterAll(async () => {
  await cleanup();
});

describe("comments", () => {
  test("상위 댓글 생성 + 트리 조회", async () => {
    const r = await m.addComment({ feedId, userId: alice, content: "안녕" });
    expect(r.ok).toBe(true);
    const tree = await m.getFeedComments(feedId);
    expect(tree).toHaveLength(1);
    expect(tree[0].nickname).toBe("앨리스");
    expect(tree[0].replies).toHaveLength(0);
  });
  test("대댓글(2뎁스)은 허용", async () => {
    const top = (await m.getFeedComments(feedId))[0];
    const r = await m.addComment({
      feedId,
      userId: bob,
      content: "답글",
      parentId: top.id,
    });
    expect(r.ok).toBe(true);
    const tree = await m.getFeedComments(feedId);
    expect(tree[0].replies).toHaveLength(1);
    expect(tree[0].replies[0].nickname).toBe("밥");
  });
  test("대댓글에 답글(3뎁스)은 거부", async () => {
    const reply = (await m.getFeedComments(feedId))[0].replies[0];
    const r = await m.addComment({
      feedId,
      userId: alice,
      content: "x",
      parentId: reply.id,
    });
    expect(r).toEqual({
      ok: false,
      error: "대댓글에는 답글을 달 수 없습니다.",
    });
  });
  test("타인 댓글 삭제 거부, 본인은 허용", async () => {
    const top = (await m.getFeedComments(feedId))[0];
    expect(await m.deleteComment(top.id, bob)).toEqual({
      ok: false,
      error: "삭제 권한이 없습니다.",
    });
    // top은 대댓글이 있으므로 soft-delete
    expect((await m.deleteComment(top.id, alice)).ok).toBe(true);
    const tree = await m.getFeedComments(feedId);
    expect(tree[0].deleted).toBe(true);
    expect(tree[0].replies).toHaveLength(1); // 대댓글 유지
  });
  test("admin은 모든 댓글 삭제 가능(isAdmin)", async () => {
    const r = await m.addComment({ feedId, userId: alice, content: "또" });
    const id = (r as { ok: true; id: string }).id;
    expect((await m.deleteComment(id, bob, true)).ok).toBe(true); // 대댓글 없음 → hard delete
    expect((await m.getFeedComments(feedId)).some((c) => c.id === id)).toBe(
      false,
    );
  });
});
```

**Step 3: 실패 확인** — `pnpm test lib/comments.test.ts` → FAIL.

**Step 4: 구현** — `lib/comments.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { CommentSchema } from "@/lib/validation";

type AddInput = {
  feedId: string;
  userId: string;
  content: string;
  parentId?: string | null;
};
type AddResult = { ok: true; id: string } | { ok: false; error: string };

export async function addComment(input: AddInput): Promise<AddResult> {
  const parsed = CommentSchema.safeParse({ content: input.content });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "내용을 확인하세요.",
    };

  if (input.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
      select: { feedId: true, parentId: true },
    });
    if (!parent || parent.feedId !== input.feedId)
      return { ok: false, error: "원댓글을 찾을 수 없습니다." };
    if (parent.parentId)
      return { ok: false, error: "대댓글에는 답글을 달 수 없습니다." };
  }

  const c = await prisma.comment.create({
    data: {
      feedId: input.feedId,
      userId: input.userId,
      content: parsed.data.content,
      parentId: input.parentId ?? null,
    },
    select: { id: true },
  });
  return { ok: true, id: c.id };
}

export type CommentNode = {
  id: string;
  nickname: string;
  userId: string;
  content: string;
  deleted: boolean;
  createdAt: string;
  replies: CommentNode[];
};

function toNode(c: {
  id: string;
  userId: string;
  content: string;
  deletedAt: Date | null;
  createdAt: Date;
  user: { nickname: string };
}): Omit<CommentNode, "replies"> {
  const deleted = c.deletedAt !== null;
  return {
    id: c.id,
    userId: c.userId,
    nickname: c.user.nickname,
    content: deleted ? "" : c.content,
    deleted,
    createdAt: c.createdAt.toISOString(),
  };
}

// 상위 최신순, 대댓글 시간순 트리.
export async function getFeedComments(feedId: string): Promise<CommentNode[]> {
  const rows = await prisma.comment.findMany({
    where: { feedId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      content: true,
      deletedAt: true,
      createdAt: true,
      parentId: true,
      user: { select: { nickname: true } },
    },
  });
  const tops = rows
    .filter((r) => r.parentId === null)
    .map((r) => ({ ...toNode(r), replies: [] as CommentNode[] }));
  const byId = new Map(tops.map((t) => [t.id, t]));
  for (const r of rows) {
    if (r.parentId && byId.has(r.parentId))
      byId.get(r.parentId)!.replies.push({ ...toNode(r), replies: [] });
  }
  tops.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // 상위 최신순
  return tops;
}

type DelResult = { ok: true } | { ok: false; error: string };

export async function deleteComment(
  id: string,
  actorUserId: string,
  isAdmin = false,
): Promise<DelResult> {
  const c = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true, _count: { select: { replies: true } } },
  });
  if (!c) return { ok: false, error: "댓글을 찾을 수 없습니다." };
  if (!isAdmin && c.userId !== actorUserId)
    return { ok: false, error: "삭제 권한이 없습니다." };
  if (c._count.replies > 0) {
    await prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } else {
    await prisma.comment.delete({ where: { id } });
  }
  return { ok: true };
}
```

**Step 5: 통과 확인** — `pnpm test lib/comments.test.ts` → PASS.

**Step 6: Commit**

```bash
git add lib/validation.ts lib/comments.ts lib/comments.test.ts
git commit -m "feat(comment): 댓글 데이터 계층(생성·트리·2뎁스·삭제분기) + 테스트"
```

---

## Task 5: 좋아요 데이터 계층 (TDD)

**Files:** Create `lib/likes.ts`, `lib/likes.test.ts`

**Step 1: 실패 테스트** — `lib/likes.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Mod = typeof import("@/lib/likes");
let m: Mod;
let prisma: import("@/app/generated/prisma/client").PrismaClient;
let cleanup: () => Promise<void>;
let feedId: string, u1: string, u2: string;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  const f = await prisma.feed.create({
    data: { slug: "f", title: "T", content: "c", published: true },
  });
  feedId = f.id;
  u1 = (
    await prisma.user.create({
      data: {
        email: "1@x.com",
        nickname: "u1",
        passwordHash: "-",
        status: "approved",
      },
    })
  ).id;
  u2 = (
    await prisma.user.create({
      data: {
        email: "2@x.com",
        nickname: "u2",
        passwordHash: "-",
        status: "approved",
      },
    })
  ).id;
  m = await import("@/lib/likes");
});
afterAll(async () => {
  await cleanup();
});

describe("likes", () => {
  test("toggle: 처음엔 생성(liked), 다시 누르면 취소", async () => {
    expect(await m.toggleLike(feedId, u1)).toBe(true);
    expect(await m.getLikeSummary(feedId, u1)).toEqual({
      count: 1,
      liked: true,
    });
    expect(await m.toggleLike(feedId, u1)).toBe(false);
    expect(await m.getLikeSummary(feedId, u1)).toEqual({
      count: 0,
      liked: false,
    });
  });
  test("여러 사용자 카운트 + liked는 사용자별", async () => {
    await m.toggleLike(feedId, u1);
    await m.toggleLike(feedId, u2);
    expect(await m.getLikeSummary(feedId, u1)).toEqual({
      count: 2,
      liked: true,
    });
    expect(await m.getLikeSummary(feedId, undefined)).toEqual({
      count: 2,
      liked: false,
    });
  });
});
```

**Step 2: 실패 확인** — `pnpm test lib/likes.test.ts` → FAIL.

**Step 3: 구현** — `lib/likes.ts`:

```ts
import { prisma } from "@/lib/prisma";

// 좋아요 토글. 결과 liked 상태 반환.
export async function toggleLike(
  feedId: string,
  userId: string,
): Promise<boolean> {
  const existing = await prisma.like.findUnique({
    where: { feedId_userId: { feedId, userId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.like.create({ data: { feedId, userId } });
  return true;
}

export async function getLikeSummary(
  feedId: string,
  userId?: string,
): Promise<{ count: number; liked: boolean }> {
  const [count, mine] = await Promise.all([
    prisma.like.count({ where: { feedId } }),
    userId
      ? prisma.like.findUnique({
          where: { feedId_userId: { feedId, userId } },
          select: { id: true },
        })
      : null,
  ]);
  return { count, liked: !!mine };
}
```

**Step 4: 통과 확인** — `pnpm test lib/likes.test.ts` → PASS.

**Step 5: Commit**

```bash
git add lib/likes.ts lib/likes.test.ts
git commit -m "feat(like): 좋아요 토글/요약 데이터 계층 + 테스트"
```

---

## Task 6: 서버 액션 (actor 검증)

**Files:** Create `app/feed/comment-actions.ts`

**Step 1:** `app/feed/comment-actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { getCommentActor } from "@/lib/comment-actor";
import { getSession } from "@/lib/dal";
import { addComment, deleteComment } from "@/lib/comments";
import { toggleLike } from "@/lib/likes";

export type ActionState = { error?: string } | undefined;

function revalidate(slug: string) {
  revalidatePath(`/feed/${slug}`);
}

export async function addCommentAction(
  args: { feedId: string; slug: string; parentId?: string },
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getCommentActor();
  if (!actor) return { error: "로그인이 필요합니다." };
  const res = await addComment({
    feedId: args.feedId,
    userId: actor.userId,
    content: String(formData.get("content") ?? ""),
    parentId: args.parentId ?? null,
  });
  if (!res.ok) return { error: res.error };
  revalidate(args.slug);
  return undefined;
}

export async function deleteCommentAction(commentId: string, slug: string) {
  const actor = await getCommentActor();
  if (!actor) return;
  const session = await getSession();
  await deleteComment(commentId, actor.userId, session?.role === "admin");
  revalidate(slug);
}

export async function toggleLikeAction(feedId: string, slug: string) {
  const actor = await getCommentActor();
  if (!actor) return;
  await toggleLike(feedId, actor.userId);
  revalidate(slug);
}
```

**Step 2: 검증** — `npx tsc --noEmit` → 통과.

**Step 3: Commit**

```bash
git add app/feed/comment-actions.ts
git commit -m "feat(comment): 댓글/좋아요 서버 액션(actor 검증)"
```

---

## Task 7: 로그인 유도 모달 + 댓글 본문(접기) 클라이언트 컴포넌트

**Files:** Create `app/feed/login-required-modal.tsx`, `app/feed/comment-body.tsx`

**Step 1: 모달** — `app/feed/login-required-modal.tsx` (네이티브 dialog, ref 외부 제어):

```tsx
"use client";
import Link from "next/link";
import { forwardRef } from "react";

export default forwardRef<HTMLDialogElement>(
  function LoginRequiredModal(_props, ref) {
    return (
      <dialog
        ref={ref}
        className="bg-background text-foreground m-auto w-[min(90vw,22rem)] rounded-lg border border-black/15 p-5 shadow-xl backdrop:bg-black/40 dark:border-white/20"
      >
        <h2 className="text-base font-semibold">로그인이 필요합니다</h2>
        <p className="mt-2 text-sm text-zinc-500">
          댓글·좋아요는 로그인한 회원만 이용할 수 있습니다.
        </p>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <Link
            href="/signup"
            className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
          >
            가입
          </Link>
          <Link
            href="/signin"
            className="bg-foreground text-background rounded px-3 py-1.5 font-medium"
          >
            로그인
          </Link>
        </div>
      </dialog>
    );
  },
);
```

**Step 2: 본문 접기** — `app/feed/comment-body.tsx` (줄바꿈 보존 + 3줄 초과 시 더보기/접기):

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

export default function CommentBody({ content }: { content: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollHeight - el.clientHeight > 1);
  }, [content]);

  return (
    <div>
      <p
        ref={ref}
        className={`text-sm break-words whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}
      >
        {content}
      </p>
      {(overflow || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}
    </div>
  );
}
```

> `line-clamp-3`은 Tailwind 기본 유틸(3줄에서 ellipsis). `whitespace-pre-wrap`으로 줄바꿈 보존, `break-words`로 긴 단어 줄바꿈.

**Step 3: 검증** — `npx tsc --noEmit && npx eslint app/feed` → 통과(만약 set-state-in-effect 경고 시 해당 effect에 주석으로 비활성).

**Step 4: Commit**

```bash
git add app/feed/login-required-modal.tsx app/feed/comment-body.tsx
git commit -m "feat(comment): 로그인 유도 모달 + 댓글 본문 더보기/접기 컴포넌트"
```

---

## Task 8: 좋아요 버튼 + 댓글/답글 폼 클라이언트 컴포넌트

**Files:** Create `app/feed/like-button.tsx`, `app/feed/comment-form.tsx`

**Step 1: 좋아요 버튼** — `app/feed/like-button.tsx`:

```tsx
"use client";
import { useRef, useState, useTransition } from "react";
import LoginRequiredModal from "./login-required-modal";
import { toggleLikeAction } from "./comment-actions";

export default function LikeButton({
  feedId,
  slug,
  initialCount,
  initialLiked,
  canParticipate,
}: {
  feedId: string;
  slug: string;
  initialCount: number;
  initialLiked: boolean;
  canParticipate: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [pending, start] = useTransition();
  const modal = useRef<HTMLDialogElement>(null);

  function onClick() {
    if (!canParticipate) {
      modal.current?.showModal();
      return;
    }
    // 낙관적 갱신
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));
    start(() => toggleLikeAction(feedId, slug));
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={liked}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${liked ? "border-red-300 text-red-600" : "border-black/15 text-zinc-600 dark:border-white/20 dark:text-zinc-300"}`}
      >
        <span aria-hidden>{liked ? "♥" : "♡"}</span>
        좋아요 {count}
      </button>
      <LoginRequiredModal ref={modal} />
    </>
  );
}
```

**Step 2: 댓글/답글 폼** — `app/feed/comment-form.tsx` (재사용: 상위 작성 + 답글). maxLength 2000:

```tsx
"use client";
import { useActionState, useRef } from "react";
import LoginRequiredModal from "./login-required-modal";
import { addCommentAction, type ActionState } from "./comment-actions";

export default function CommentForm({
  feedId,
  slug,
  parentId,
  canParticipate,
  placeholder = "댓글을 입력하세요",
  onDone,
}: {
  feedId: string;
  slug: string;
  parentId?: string;
  canParticipate: boolean;
  placeholder?: string;
  onDone?: () => void;
}) {
  const action = addCommentAction.bind(null, { feedId, slug, parentId });
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (s, fd) => {
      const r = await action(s, fd);
      if (!r?.error) onDone?.();
      return r;
    },
    undefined,
  );
  const modal = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!canParticipate) {
    return (
      <>
        <button
          type="button"
          onClick={() => modal.current?.showModal()}
          className="w-full rounded border border-black/15 px-3 py-2 text-left text-sm text-zinc-500 dark:border-white/20"
        >
          {placeholder}
        </button>
        <LoginRequiredModal ref={modal} />
      </>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        formAction(fd);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        name="content"
        rows={parentId ? 2 : 3}
        maxLength={2000}
        placeholder={placeholder}
        className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background w-fit rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "등록 중…" : parentId ? "답글" : "댓글 등록"}
      </button>
    </form>
  );
}
```

> `maxLength={2000}`으로 입력 자체를 제한, 서버 `CommentSchema`가 2차 검증.

**Step 3: 검증** — `npx tsc --noEmit && npx eslint app/feed`.

**Step 4: Commit**

```bash
git add app/feed/like-button.tsx app/feed/comment-form.tsx
git commit -m "feat(comment): 좋아요 버튼 + 댓글/답글 폼(2000자 제한·로그인 모달)"
```

---

## Task 9: 댓글 목록 + 섹션 + 상세 페이지 통합

**Files:** Create `app/feed/comment-list.tsx`, `app/feed/feed-engagement.tsx`; Modify `app/feed/[slug]/page.tsx`

**Step 1: 댓글 항목/목록** — `app/feed/comment-list.tsx` (서버 컴포넌트). 각 댓글: 닉네임·시간·본문(CommentBody, tombstone은 "삭제된 댓글입니다")·삭제 버튼(본인/admin)·상위엔 답글 토글. 삭제/답글 토글은 클라이언트라 작은 클라이언트 래퍼 필요 → `comment-item.tsx`로 분리:

`app/feed/comment-item.tsx` (client):

```tsx
"use client";
import { useState, useTransition } from "react";
import CommentBody from "./comment-body";
import CommentForm from "./comment-form";
import { deleteCommentAction } from "./comment-actions";
import type { CommentNode } from "@/lib/comments";

export default function CommentItem({
  node,
  feedId,
  slug,
  canParticipate,
  actorUserId,
  isAdmin,
  isReply = false,
}: {
  node: CommentNode;
  feedId: string;
  slug: string;
  canParticipate: boolean;
  actorUserId?: string;
  isAdmin: boolean;
  isReply?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [pending, start] = useTransition();
  const canDelete =
    !node.deleted && (isAdmin || (actorUserId && actorUserId === node.userId));

  return (
    <li
      className={
        isReply ? "" : "border-b border-black/[.06] pb-3 dark:border-white/[.1]"
      }
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">
          {node.deleted ? "—" : node.nickname}
        </span>
        <time className="text-xs text-zinc-400">
          {new Date(node.createdAt).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}
        </time>
      </div>
      {node.deleted ? (
        <p className="mt-1 text-sm text-zinc-400">삭제된 댓글입니다.</p>
      ) : (
        <div className="mt-1">
          <CommentBody content={node.content} />
        </div>
      )}
      <div className="mt-1 flex gap-3 text-xs text-zinc-500">
        {!isReply && !node.deleted && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            답글
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => deleteCommentAction(node.id, slug))}
            className="hover:text-red-600"
          >
            삭제
          </button>
        )}
      </div>
      {replying && (
        <div className="mt-2">
          <CommentForm
            feedId={feedId}
            slug={slug}
            parentId={node.id}
            canParticipate={canParticipate}
            placeholder="답글을 입력하세요"
            onDone={() => setReplying(false)}
          />
        </div>
      )}
      {node.replies.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3 border-l border-black/[.06] pl-4 dark:border-white/[.1]">
          {node.replies.map((r) => (
            <CommentItem
              key={r.id}
              node={r}
              feedId={feedId}
              slug={slug}
              canParticipate={canParticipate}
              actorUserId={actorUserId}
              isAdmin={isAdmin}
              isReply
            />
          ))}
        </ul>
      )}
    </li>
  );
}
```

`app/feed/comment-list.tsx` (server):

```tsx
import CommentItem from "./comment-item";
import type { CommentNode } from "@/lib/comments";

export default function CommentList({
  comments,
  feedId,
  slug,
  canParticipate,
  actorUserId,
  isAdmin,
}: {
  comments: CommentNode[];
  feedId: string;
  slug: string;
  canParticipate: boolean;
  actorUserId?: string;
  isAdmin: boolean;
}) {
  if (comments.length === 0)
    return <p className="text-sm text-zinc-500">첫 댓글을 남겨보세요.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          node={c}
          feedId={feedId}
          slug={slug}
          canParticipate={canParticipate}
          actorUserId={actorUserId}
          isAdmin={isAdmin}
        />
      ))}
    </ul>
  );
}
```

**Step 2: 섹션(서버)** — `app/feed/feed-engagement.tsx`:

```tsx
import { getSession } from "@/lib/dal";
import { getCommentActor } from "@/lib/comment-actor";
import { getFeedComments } from "@/lib/comments";
import { getLikeSummary } from "@/lib/likes";
import LikeButton from "./like-button";
import CommentForm from "./comment-form";
import CommentList from "./comment-list";

export default async function FeedEngagement({
  feedId,
  slug,
}: {
  feedId: string;
  slug: string;
}) {
  const session = await getSession();
  const actor = await getCommentActor();
  const isAdmin = session?.role === "admin";
  const canParticipate = !!actor;
  const [comments, like] = await Promise.all([
    getFeedComments(feedId),
    getLikeSummary(feedId, actor?.userId),
  ]);

  return (
    <section className="mt-10 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
      <LikeButton
        feedId={feedId}
        slug={slug}
        initialCount={like.count}
        initialLiked={like.liked}
        canParticipate={canParticipate}
      />
      <h2 className="mt-8 mb-4 text-lg font-semibold tracking-tight">
        댓글 {comments.length}
      </h2>
      <div className="mb-6">
        <CommentForm
          feedId={feedId}
          slug={slug}
          canParticipate={canParticipate}
        />
      </div>
      <CommentList
        comments={comments}
        feedId={feedId}
        slug={slug}
        canParticipate={canParticipate}
        actorUserId={actor?.userId}
        isAdmin={isAdmin}
      />
    </section>
  );
}
```

> 상위 댓글 수만 표시(`comments.length`). 대댓글 포함 총수 원하면 추후.

**Step 3: 상세 페이지** — `app/feed/[slug]/page.tsx`의 `<main>` 안 `<FeedArticle .../>` 아래에 추가:

```tsx
import FeedEngagement from "@/app/feed/feed-engagement";
// ...
      <FeedArticle feed={feed} />
      <FeedEngagement feedId={feed.id} slug={feed.slug} />
```

`getFeedBySlug`가 published만 주므로 댓글/좋아요는 공개 글에만 노출.

**Step 4: 검증** — `npx tsc --noEmit && npx eslint app/feed && rm -rf .next && npx next build`.

**Step 5: Commit**

```bash
git add app/feed/comment-list.tsx app/feed/comment-item.tsx app/feed/feed-engagement.tsx "app/feed/[slug]/page.tsx"
git commit -m "feat(comment): 피드 상세에 좋아요+댓글 섹션 통합"
```

---

## Task 10: 관리자 설정에 닉네임 폼

**Files:** Modify `app/admin/actions.ts`, `app/admin/settings/page.tsx`

**Step 1: 액션** — `app/admin/actions.ts`에 추가:

```ts
import { setAdminNickname } from "@/lib/comment-actor";

export async function setAdminNicknameAction(formData: FormData) {
  await verifySession();
  await setAdminNickname(String(formData.get("nickname") ?? ""));
  revalidatePath("/admin/settings");
}
```

**Step 2: UI** — `app/admin/settings/page.tsx`에 import + 카드 추가. `getAdminNickname` 로드 후 사이트 토글 카드 아래에:

```tsx
import { getAdminNickname } from "@/lib/comment-actor";
import { setSitePublic, setAdminNicknameAction } from "@/app/admin/actions";
// const publicEnabled = ... → const [publicEnabled, adminNickname] = await Promise.all([getPublicEnabled(), getAdminNickname()]);
```

사이트 카드 아래:

```tsx
<div className="mt-6 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]">
  <p className="font-medium">관리자 닉네임</p>
  <p className="mt-0.5 text-sm text-zinc-500">
    댓글 작성 시 표시되는 이름입니다.
  </p>
  <form action={setAdminNicknameAction} className="mt-3 flex gap-2">
    <input
      name="nickname"
      defaultValue={adminNickname}
      maxLength={20}
      className="rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20"
    />
    <button
      type="submit"
      className="bg-foreground text-background rounded px-3 py-1.5 text-sm font-medium"
    >
      저장
    </button>
  </form>
</div>
```

**Step 3: 검증** — `npx tsc --noEmit && npx eslint app/admin`.

**Step 4: Commit**

```bash
git add app/admin/actions.ts app/admin/settings/page.tsx
git commit -m "feat(admin): 설정에 관리자 닉네임 편집"
```

---

## Task 11: 버전 bump + 최종 검증 + PR

**Step 1:** `package.json` `0.8.0` → `0.9.0`.

**Step 2: 게이트**

```bash
npx tsc --noEmit && npx eslint . && pnpm test && rm -rf .next && npx next build
```

Expected: 통과. 테스트 44 + (actor 2 + users 1 + comments 5 + likes 2) = 54 내외.

**Step 3: 로컬 수동 검증** (`pnpm dev`, 회원 로그인)

- 좋아요 토글·카운트, 비로그인 시 모달.
- 댓글 작성, 대댓글 작성, 대댓글에 답글 버튼 없음 확인.
- 2000자 입력 제한, 줄바꿈 표시, 3줄 초과 더보기/접기.
- 본인 댓글 삭제, 관리자 임의 삭제, 대댓글 있는 댓글 삭제 시 "삭제된 댓글".
- `/admin/settings`에서 관리자 닉네임 변경 → 관리자 댓글에 반영.

**Step 4: Commit + PR**

```bash
git add package.json
git commit -m "chore: 버전 0.8.0 → 0.9.0 (댓글+좋아요)"
git push -u origin feature/comments-likes
gh pr create --base main --title "feat: 회원 댓글(2뎁스) + 좋아요" --body "..."
```

**Step 5: PR 본문 주의** — Comment/Like 마이그레이션 포함(배포 시 migrate deploy 자동). 예약 admin User는 관리자 첫 댓글/닉네임 저장 시 생성.

---

## 작업 순서 요약

1 모델 → 2 actor/예약User → 3 회원목록 제외 → 4 댓글계층 → 5 좋아요계층 → 6 서버액션 → 7 모달+본문접기 → 8 좋아요버튼+폼 → 9 목록+상세통합 → 10 관리자닉네임 → 11 버전+검증+PR
