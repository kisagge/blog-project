// 테스트 DB 템플릿: 실제 마이그레이션(prisma migrate deploy — 운영과 같은 경로)으로 한 번 만들고,
// 각 테스트 파일은 setupTestDb()에서 이 파일을 복사해 쓴다. 예전엔 lib/test-db.ts에 DDL을 손으로
// 옮겨 적어 마이그레이션(FTS·publishedAt 트리거 포함)과 어긋날 위험이 있었다.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    testDbTemplate: string;
  }
}

export default function setup(project: TestProject) {
  const dir = mkdtempSync(join(tmpdir(), "byjang-test-template-"));
  const file = join(dir, "template.db");
  execFileSync(
    join(process.cwd(), "node_modules", ".bin", "prisma"),
    ["migrate", "deploy"],
    { env: { ...process.env, DATABASE_URL: `file:${file}` }, stdio: "pipe" },
  );
  project.provide("testDbTemplate", file);
  return () => rmSync(dir, { recursive: true, force: true });
}
