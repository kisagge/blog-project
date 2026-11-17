// @vitest-environment node
// 점검 모드 가드 누락 방지: 레이아웃 가드는 페이지 렌더를 막지 못하므로(레이아웃·페이지 병렬 렌더 —
// 리다이렉트 응답에 본문이 실림) 가드 레이아웃 아래 모든 page.tsx가 직접 guardPublicAccess를 호출해야 한다.
import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const APP = join(process.cwd(), "app");

function pagesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return pagesUnder(p);
    return name === "page.tsx" ? [p] : [];
  });
}

// 레이아웃에서 guardPublicAccess를 쓰는 디렉터리 = 공개 사이트 영역
const guardedDirs = readdirSync(APP)
  .map((n) => join(APP, n))
  .filter(
    (d) =>
      statSync(d).isDirectory() &&
      (() => {
        try {
          return readFileSync(join(d, "layout.tsx"), "utf8").includes(
            "guardPublicAccess",
          );
        } catch {
          return false;
        }
      })(),
  );

const pages = guardedDirs.flatMap(pagesUnder);

describe("점검 모드 페이지 가드", () => {
  test("가드 레이아웃이 있음(전제)", () => {
    expect(guardedDirs.length).toBeGreaterThan(0);
    expect(pages.length).toBeGreaterThan(0);
  });

  test.each(pages.map((p) => [relative(APP, p), p]))(
    "%s 페이지가 직접 가드",
    (_, p) => {
      const src = readFileSync(p, "utf8");
      const body = src.slice(src.indexOf("export default"));
      expect(body).toContain("await guardPublicAccess()");
      // generateMetadata가 있으면 그 안에서도 가드(메타데이터가 리다이렉트 응답에 실리는 것 방지)
      const meta = src.indexOf("export async function generateMetadata");
      if (meta >= 0)
        expect(src.slice(meta, src.indexOf("\n}\n", meta))).toContain(
          "await guardPublicAccess()",
        );
    },
  );
});
