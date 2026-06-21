import { test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// "use server" 파일은 async 함수만 export해야 한다(서버 액션 규칙).
// 특히 import한 타입을 `export type { X }`(명명된 type 재-export)로 다시 내보내면,
// Turbopack 프로덕션 서버 청크가 소거된 타입 식별자를 런타임 값으로 참조하게 되어
// 모듈 평가 시점에 "ReferenceError: X is not defined" → 해당 모듈을 쓰는 페이지가 500.
// (tsc·`next build`는 통과해서 CI로 못 잡고, `next start`에서만 터진다 — 회귀 방지로 정적 검사.)
// 로컬 type alias(`export type Foo = ...`)는 완전 소거되어 안전하므로 검사 대상 아님.

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "generated")
      continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test("'use server' 파일은 명명된 type 재-export를 쓰지 않는다(prod 모듈평가 ReferenceError 방지)", () => {
  const offenders: string[] = [];
  for (const root of ["app", "lib"]) {
    for (const file of walk(root)) {
      const src = readFileSync(file, "utf8");
      const head = src.trimStart();
      if (!head.startsWith('"use server"') && !head.startsWith("'use server'"))
        continue;
      // `export type { ... }` (명명된 타입 재-export) 탐지.
      if (/^\s*export\s+type\s*\{/m.test(src)) offenders.push(file);
    }
  }
  expect(offenders).toEqual([]);
});
