import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const e = new Error("NEXT_REDIRECT") as Error & { url?: string };
    e.url = url;
    throw e;
  }),
}));
vi.mock("@/lib/dal", () => ({
  getMemberSession: vi.fn(async () => ({
    role: "member",
    userId: "u1",
    nickname: "n",
  })),
}));
vi.mock("@/lib/member-posts", () => ({
  saveDraft: vi.fn(async () => ({ ok: true, value: { id: "d1" } })),
  publishPost: vi.fn(async () => ({ ok: true, value: { slug: "s1" } })),
  deleteMyPost: vi.fn(),
}));

import { submitPost } from "@/app/account/posts/actions";
import { redirect } from "next/navigation";

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.mocked(redirect).mockClear();
});

describe("submitPost", () => {
  test("임시저장 후엔 '내 글' 탭으로(프로필 탭이 아니라)", async () => {
    await expect(
      submitPost(
        undefined,
        fd({ intent: "draft", title: "제목", content: "본문", tags: "" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/account/posts");
  });

  test("게시 후엔 글 상세로", async () => {
    await expect(
      submitPost(
        undefined,
        fd({ intent: "publish", title: "제목", content: "본문", tags: "" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/feed/s1");
  });
});
