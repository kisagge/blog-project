import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/comment-actor", () => ({ getCommentActor: vi.fn() }));
vi.mock("@/lib/feed-access", () => ({ getReadableFeed: vi.fn() }));
vi.mock("@/lib/bookmarks", () => ({ toggleBookmark: vi.fn() }));

import { toggleBookmarkAction } from "@/app/feed/bookmark-actions";
import { getCommentActor } from "@/lib/comment-actor";
import { getReadableFeed } from "@/lib/feed-access";
import { toggleBookmark } from "@/lib/bookmarks";
import { revalidatePath } from "next/cache";

const actor = vi.mocked(getCommentActor);
const gf = vi.mocked(getReadableFeed);

beforeEach(() => {
  vi.clearAllMocks();
  actor.mockResolvedValue({ userId: "u1", nickname: "n", role: "member" });
});

describe("toggleBookmarkAction", () => {
  test("읽을 수 없는 글은 저장 불가", async () => {
    gf.mockResolvedValue(null);
    await toggleBookmarkAction("secret", "x");
    expect(gf).toHaveBeenCalledWith("secret", "member");
    expect(toggleBookmark).not.toHaveBeenCalled();
  });

  test("저장 시 DB slug로 리밸리데이트", async () => {
    gf.mockResolvedValue({ id: "f1", slug: "real" });
    await toggleBookmarkAction("f1", "fake");
    expect(toggleBookmark).toHaveBeenCalledWith("f1", "u1");
    expect(revalidatePath).toHaveBeenCalledWith("/feed/real");
  });

  test("관리자 액터는 제외", async () => {
    actor.mockResolvedValue({ userId: "a", nickname: "관리자", role: "admin" });
    await toggleBookmarkAction("f1", "x");
    expect(gf).not.toHaveBeenCalled();
  });
});
