// 글 상세 메타데이터는 본문과 같은 판정을 따른다 — 남의 임시저장·숨김·비공개 글의 제목이
// <head>로 새지 않고, 회원공개 글은 비회원(=크롤러)에게 요약 없이 noindex.
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/feeds", () => ({
  getFeedBySlug: vi.fn(),
  getRelatedFeeds: vi.fn(),
  getAdjacentFeeds: vi.fn(),
  searchFeeds: vi.fn(),
}));
vi.mock("@/lib/dal", () => ({
  getViewerRole: vi.fn(async () => "anon"),
  getSession: vi.fn(async () => undefined),
  isBlockedMember: vi.fn(async () => false),
}));
vi.mock("@/lib/site-config", () => ({ guardPublicAccess: vi.fn() }));

import { generateMetadata } from "@/app/feed/[slug]/page";
import { getFeedBySlug } from "@/lib/feeds";
import { getSession, getViewerRole } from "@/lib/dal";

const feed = (over: Record<string, unknown> = {}) => ({
  id: "f1",
  slug: "s",
  title: "비밀 제목",
  summary: "요약",
  status: "published",
  hiddenAt: null,
  visibility: "public",
  authorId: "u1",
  ...over,
});
const meta = () => generateMetadata({ params: Promise.resolve({ slug: "s" }) });

beforeEach(() => {
  vi.mocked(getViewerRole).mockResolvedValue("anon");
  vi.mocked(getSession).mockResolvedValue(undefined);
});

describe("글 상세 generateMetadata", () => {
  test("공개 글: 제목·요약·canonical", async () => {
    vi.mocked(getFeedBySlug).mockResolvedValue(feed() as never);
    expect(await meta()).toMatchObject({
      title: "비밀 제목",
      description: "요약",
      alternates: { canonical: "/feed/s" },
    });
  });

  test("남의 임시저장·숨김·비공개 → 제목 노출 없음", async () => {
    for (const f of [
      feed({ status: "draft" }),
      feed({ hiddenAt: new Date() }),
      feed({ visibility: "private" }),
    ]) {
      vi.mocked(getFeedBySlug).mockResolvedValue(f as never);
      expect(await meta()).toEqual({ title: "찾을 수 없음" });
    }
  });

  test("본인 임시저장은 제목만", async () => {
    vi.mocked(getViewerRole).mockResolvedValue("member");
    vi.mocked(getSession).mockResolvedValue({
      role: "member",
      userId: "u1",
    } as never);
    vi.mocked(getFeedBySlug).mockResolvedValue(
      feed({ status: "draft" }) as never,
    );
    expect(await meta()).toEqual({ title: "비밀 제목" });
  });

  test("회원공개 + 비회원: 요약 없이 noindex", async () => {
    vi.mocked(getFeedBySlug).mockResolvedValue(
      feed({ visibility: "members" }) as never,
    );
    const m = await meta();
    expect(m).toMatchObject({ title: "비밀 제목", robots: { index: false } });
    expect((m as { description?: string }).description).toBeUndefined();
  });
});
