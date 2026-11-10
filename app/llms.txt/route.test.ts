import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Route = typeof import("@/app/llms.txt/route");
let GET: Route["GET"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  const mk = (slug: string, over: Record<string, unknown>) =>
    db.prisma.feed.create({
      data: { slug, title: slug, content: "c", status: "published", ...over },
    });
  await mk("llms-public", { visibility: "public", summary: "공개요약" });
  await mk("llms-members", { visibility: "members" });
  await mk("llms-private", { visibility: "private" });
  await mk("llms-hidden", { visibility: "public", hiddenAt: new Date() });
  await mk("llms-draft", { visibility: "public", status: "draft" });
  ({ GET } = await import("@/app/llms.txt/route"));
});
afterAll(async () => {
  await cleanup();
});

describe("llms.txt", () => {
  test("text/plain + 전체공개·게시·미숨김 글만 노출", async () => {
    const res = await GET();
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const txt = await res.text();
    expect(txt.startsWith("# BY Playground\n")).toBe(true);
    expect(txt).toContain(
      "- [llms-public](https://by-jang-blog.xyz/feed/llms-public): 공개요약",
    );
    for (const hidden of [
      "llms-members",
      "llms-private",
      "llms-hidden",
      "llms-draft",
    ])
      expect(txt).not.toContain(hidden);
  });
});
