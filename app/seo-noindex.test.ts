// 회원 전용 게이트 페이지: 크롤러(항상 비회원)에겐 "회원만 볼 수 있습니다" 안내만 보이는 얇은 페이지라
// 검색 색인에서 빼야 한다. robots.txt로 막으면 noindex를 읽지 못하므로 메타데이터 noindex로 처리.
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/dal", () => ({
  getViewerRole: vi.fn(async () => "anon"),
  getMemberSession: vi.fn(async () => null),
}));
vi.mock("@/lib/users", () => ({ getMemberProfile: vi.fn(async () => null) }));
vi.mock("@/lib/member-posts", () => ({ listMemberPosts: vi.fn() }));
vi.mock("@/lib/comments", () => ({ getCommentsByUser: vi.fn() }));
vi.mock("@/lib/follows", () => ({
  getFollowCounts: vi.fn(),
  isFollowing: vi.fn(),
  getFollowingFeed: vi.fn(),
}));
vi.mock("@/lib/site-config", () => ({ guardPublicAccess: vi.fn() }));
vi.mock("@/lib/feeds", () => ({ searchFeeds: vi.fn() }));
vi.mock("@/lib/tags", () => ({ getTagsWithCounts: vi.fn() }));

const NOINDEX = { index: false };

describe("회원 게이트 페이지 noindex", () => {
  test("/following", async () => {
    const { metadata } = await import("@/app/following/page");
    expect(metadata.robots).toEqual(NOINDEX);
  });

  test("/community", async () => {
    const { metadata } = await import("@/app/community/page");
    expect(metadata.robots).toEqual(NOINDEX);
  });

  test("/u/[id] (비회원 게이트·회원 열람 모두)", async () => {
    const { generateMetadata } = await import("@/app/u/[id]/page");
    const md = await generateMetadata({ params: Promise.resolve({ id: "x" }) });
    expect(md.robots).toEqual(NOINDEX);
  });
});
