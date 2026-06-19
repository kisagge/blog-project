# 피드 본문 이미지 업로드 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 관리자가 글 작성/수정 폼에서 이미지를 업로드해 본문 마크다운에 `![](url)`로 삽입하고, 파일은 서버 볼륨에 저장·서빙한다.

**Architecture:** 관리자 Server Action이 파일을 검증(형식/크기) 후 `data/uploads/<uuid>.<ext>`에 저장하고 `/uploads/<name>` URL을 반환한다. 프로덕션은 nginx가 `/uploads`를 볼륨에서 직접 서빙, 로컬 dev는 Next Route Handler가 같은 경로를 스트리밍한다. 본문은 기존 react-markdown이 `<img>`로 렌더.

**Tech Stack:** Next 16 Server Actions, Node fs, Vitest, nginx, Docker 볼륨

> **설계 문서:** `docs/plans/2026-06-08-image-upload-design.md`
> **검증:** 검증 로직은 Vitest 단위테스트, 나머지는 `tsc`/`eslint`/`build` + 수동.

---

## Task 1: 이미지 검증 유틸 (TDD)

**Files:**

- Create: `lib/upload.ts`
- Create: `lib/upload.test.ts`

**Step 1: 실패 테스트 작성** — `lib/upload.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { checkImage, MAX_IMAGE_BYTES } from "@/lib/upload";

describe("checkImage", () => {
  test("png/jpeg/webp는 통과하고 확장자를 준다", () => {
    expect(checkImage("image/png", 1000)).toEqual({ ok: true, ext: "png" });
    expect(checkImage("image/jpeg", 1000)).toEqual({ ok: true, ext: "jpg" });
    expect(checkImage("image/webp", 1000)).toEqual({ ok: true, ext: "webp" });
  });
  test("gif 등 허용되지 않은 형식은 거부", () => {
    const r = checkImage("image/gif", 1000);
    expect(r.ok).toBe(false);
  });
  test("5MB 초과는 거부", () => {
    const r = checkImage("image/png", MAX_IMAGE_BYTES + 1);
    expect(r.ok).toBe(false);
  });
  test("경계값(정확히 5MB)은 통과", () => {
    expect(checkImage("image/png", MAX_IMAGE_BYTES).ok).toBe(true);
  });
});
```

**Step 2: 실패 확인** — `pnpm test lib/upload.test.ts` → 모듈 없음으로 FAIL.

**Step 3: 구현** — `lib/upload.ts`:

```ts
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ImageCheck =
  | { ok: true; ext: string }
  | { ok: false; error: string };

export function checkImage(type: string, size: number): ImageCheck {
  const ext = EXT_BY_TYPE[type];
  if (!ext)
    return { ok: false, error: "jpg/png/webp 이미지만 업로드할 수 있습니다." };
  if (size > MAX_IMAGE_BYTES)
    return { ok: false, error: "이미지는 5MB 이하만 업로드할 수 있습니다." };
  return { ok: true, ext };
}
```

**Step 4: 통과 확인** — `pnpm test lib/upload.test.ts` → PASS.

**Step 5: Commit**

```bash
git add lib/upload.ts lib/upload.test.ts
git commit -m "feat(upload): 이미지 형식/크기 검증 유틸 + 테스트"
```

---

## Task 2: 업로드 Server Action

**Files:**

- Create: `app/admin/upload-action.ts`

**Step 1: 작성**

```ts
"use server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { verifySession } from "@/lib/dal";
import { checkImage } from "@/lib/upload";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "data/uploads";

export type UploadResult = { url: string } | { error: string };

export async function uploadImage(formData: FormData): Promise<UploadResult> {
  await verifySession(); // 관리자만
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "파일이 없습니다." };

  const check = checkImage(file.type, file.size);
  if (!check.ok) return { error: check.error };

  const name = `${randomUUID()}.${check.ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(
    join(UPLOAD_DIR, name),
    Buffer.from(await file.arrayBuffer()),
  );
  return { url: `/uploads/${name}` };
}
```

**Step 2: 타입체크** — `npx tsc --noEmit` → 에러 없음.

**Step 3: Commit**

```bash
git add app/admin/upload-action.ts
git commit -m "feat(upload): 관리자 이미지 업로드 Server Action"
```

---

## Task 3: dev용 업로드 서빙 Route Handler

> 프로덕션은 nginx가 `/uploads`를 가로채므로 이 핸들러는 로컬 dev에서만 동작. dev/prod 모두 URL은 `/uploads/<name>`로 동일.

**Files:**

- Create: `app/uploads/[name]/route.ts`

**Step 1: 작성**

```ts
import { readFile } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "data/uploads";
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  // uuid.ext 형태만 허용 (경로 조작 차단)
  if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(join(UPLOAD_DIR, name));
    const ext = name.split(".").pop()!.toLowerCase();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=2592000",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
```

**Step 2: 타입체크** — `npx tsc --noEmit` → 에러 없음.

**Step 3: Commit**

```bash
git add app/uploads
git commit -m "feat(upload): dev용 /uploads 서빙 route handler(경로 검증 포함)"
```

---

## Task 4: 작성 폼에 이미지 첨부 UI

**Files:**

- Modify: `app/admin/feed-form.tsx`

**Step 1: 전체 교체** (textarea에 ref + 이미지 input + 커서 삽입)

```tsx
"use client";
import { useActionState, useRef, useState } from "react";
import type { FeedFormState } from "@/app/admin/actions";
import { uploadImage } from "@/app/admin/upload-action";

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

export default function FeedForm({
  action,
  defaultValues,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<FeedFormState, FormData>(
    action,
    undefined,
  );
  const d = defaultValues ?? {};
  const err = state?.errors ?? {};

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function insertAtCursor(text: string) {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    const pos = start + text.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadImage(fd);
    setUploading(false);
    if ("error" in res) {
      setUploadError(res.error);
      return;
    }
    insertAtCursor(`![](${res.url})\n`);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="제목" error={err.title}>
        <input name="title" defaultValue={d.title} className={inputCls} />
      </Field>
      <Field label="slug (소문자·숫자·하이픈)" error={err.slug}>
        <input name="slug" defaultValue={d.slug} className={inputCls} />
      </Field>
      <Field label="요약 (선택)" error={err.summary}>
        <input
          name="summary"
          defaultValue={d.summary ?? ""}
          className={inputCls}
        />
      </Field>
      <Field label="본문 (마크다운)" error={err.content}>
        <textarea
          ref={contentRef}
          name="content"
          defaultValue={d.content}
          rows={12}
          className={inputCls}
        />
        <div className="mt-2 flex items-center gap-3 text-sm">
          <label className="cursor-pointer rounded border border-black/15 px-2 py-1 dark:border-white/20">
            이미지 첨부
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImage}
              disabled={uploading}
              className="hidden"
            />
          </label>
          {uploading && <span className="text-zinc-500">업로드 중…</span>}
          {uploadError && <span className="text-red-600">{uploadError}</span>}
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={d.published} />
        공개
      </label>
      {state?.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background w-fit rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "저장 중…" : submitLabel}
      </button>
    </form>
  );
}

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-sm text-red-600">{error.join(" ")}</p>}
    </div>
  );
}
```

**Step 2: 타입체크** — `npx tsc --noEmit` → 에러 없음.

**Step 3: Commit**

```bash
git add app/admin/feed-form.tsx
git commit -m "feat(admin): 작성 폼 이미지 첨부 → 본문 마크다운 삽입"
```

---

## Task 5: next.config bodySizeLimit + 본문 이미지 스타일 + ignore

**Files:**

- Modify: `next.config.ts`, `app/feed/[slug]/page.tsx`, `.gitignore`, `.dockerignore`

**Step 1: `next.config.ts`** — Server Action 바디 한도 상향(5MB + 여유)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
```

**Step 2: 상세 본문 이미지 스타일** — `app/feed/[slug]/page.tsx`의 마크다운 컨테이너 className에 이미지 규칙 추가:
`[&_img]:max-w-full`, `[&_img]:rounded`, `[&_img]:my-4` 를 기존 `[&_a]:underline ...` 체인에 추가.

**Step 3: ignore** — `.gitignore`와 `.dockerignore`에 각각 추가:

```
/data/uploads
```

(로컬 업로드물이 git/이미지에 안 들어가게)

**Step 4: 검증** — `npx tsc --noEmit && npx eslint .` 통과.

**Step 5: Commit**

```bash
git add next.config.ts app/feed/\[slug\]/page.tsx .gitignore .dockerignore
git commit -m "build: serverActions bodySizeLimit 6mb + 본문 img 스타일 + uploads ignore"
```

---

## Task 6: 컨테이너 업로드 디렉토리 (compose + entrypoint)

**Files:**

- Modify: `compose.yaml`, `docker-entrypoint.sh`

**Step 1: `compose.yaml`** — environment에 `UPLOAD_DIR` 추가 (볼륨 `/data`는 이미 마운트됨)

```yaml
environment:
  DATABASE_URL: "file:/data/prod.db"
  NODE_ENV: "production"
  UPLOAD_DIR: "/data/uploads"
```

**Step 2: `docker-entrypoint.sh`** — migrate 앞에 업로드 디렉토리 보장

```sh
#!/bin/sh
set -e
echo "[entrypoint] ensure upload dir..."
mkdir -p "${UPLOAD_DIR:-/data/uploads}"
echo "[entrypoint] prisma migrate deploy..."
./node_modules/.bin/prisma migrate deploy
echo "[entrypoint] starting Next.js (next start)..."
exec ./node_modules/.bin/next start -p 3010 -H 0.0.0.0
```

**Step 3: Commit**

```bash
git add compose.yaml docker-entrypoint.sh
git commit -m "build: 컨테이너 UPLOAD_DIR(/data/uploads) + entrypoint mkdir"
```

---

## Task 7: 배포 가이드 — nginx /uploads + 권한

**Files:**

- Modify: `docs/deploy/lightsail.md`

**Step 1:** nginx 서버블록의 `location / { ... }` 위에 추가하도록 문서화:

```nginx
  location /uploads/ {
    alias /srv/byjang/data/uploads/;
    expires 30d;
    access_log off;
  }
```

그리고 "최초 1회 업로드 디렉토리 권한" 안내 추가:

```bash
sudo mkdir -p /srv/byjang/data/uploads
sudo chown -R 999:999 /srv/byjang/data/uploads   # 컨테이너 uid(nextjs)
sudo systemctl reload nginx
```

**Step 2: Commit**

```bash
git add docs/deploy/lightsail.md
git commit -m "docs(deploy): nginx /uploads 서빙 + 업로드 디렉토리 권한"
```

---

## Task 8: 최종 검증 + PR

**Step 1: 게이트**

```bash
npx tsc --noEmit && npx eslint . && pnpm test && rm -rf .next && npx next build
```

Expected: 모두 통과.

**Step 2: 로컬 수동 검증**

```bash
# .env에 UPLOAD_DIR 없으면 기본 data/uploads 사용. 관리자 로그인 상태에서:
pnpm dev  # http://localhost:3010/admin/new
```

- 이미지 첨부 → 본문에 `![](/uploads/<uuid>.png)` 삽입 확인
- 저장 → 글 상세에서 이미지 렌더 확인
- `http://localhost:3010/uploads/<uuid>.png` 직접 접근 200(route handler)
- gif 첨부 시 에러 메시지, 5MB 초과 에러 확인

**Step 3: 푸시 + PR** (사용자 승인 후)

```bash
git push -u origin feature/image-upload
gh pr create --base main --head feature/image-upload --title "feat: 피드 본문 이미지 업로드" --body "..."
```

**Step 4: 배포 시 주의 (PR 본문/안내에 명시)**

- 머지·자동배포 후 **서버에서 nginx `/uploads` location 추가 + reload**, `data/uploads` 권한(999) 1회 설정 필요(가이드대로). 이게 빠지면 업로드 파일이 404.

---

## 작업 순서 요약

1 검증유틸(TDD) → 2 업로드 액션 → 3 dev 서빙 → 4 폼 UI → 5 config/스타일/ignore → 6 컨테이너 dir → 7 배포가이드 → 8 검증+PR
