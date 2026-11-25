// @vitest-environment node
// 수동 예약 발행 트리거(서버에서 실행)를 가짜 curl로 돌려 .env의 CRON_SECRET 해석을 검증.
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(process.cwd(), "scripts", "publish-scheduled-remote.sh");
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pub-"));
  // 가짜 curl: 인자를 기록.
  writeFileSync(
    join(dir, "curl"),
    `#!/bin/sh\nprintf '%s\\n' "$@" >> "${dir}/curl.log"\n`,
  );
  chmodSync(join(dir, "curl"), 0o755);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(envFile: string) {
  writeFileSync(join(dir, ".env"), envFile);
  return spawnSync("sh", [SCRIPT], {
    env: { NODE_ENV: "test", PATH: `${dir}:/usr/bin:/bin`, DEPLOY_DIR: dir },
    encoding: "utf8",
  });
}
const sentSecret = () => {
  const log = readFileSync(join(dir, "curl.log"), "utf8").split("\n");
  return log.find((l) => l.startsWith("x-cron-secret: "))?.slice(15);
};

describe("publish-scheduled-remote.sh", () => {
  test.each([
    ["따옴표 없음", "CRON_SECRET=abc123\n"],
    ["큰따옴표", 'CRON_SECRET="abc123"\n'],
    ["작은따옴표", "CRON_SECRET='abc123'\n"],
    ["CRLF(윈도우에서 편집한 .env)", "A=1\r\nCRON_SECRET=abc123\r\n"],
    ["export 접두사", "export CRON_SECRET=abc123\n"],
    [
      "여러 번 정의되면 마지막 값(dotenv와 같게)",
      "CRON_SECRET=old\nCRON_SECRET=abc123\n",
    ],
  ])("%s → 값 abc123으로 호출", (_name, envFile) => {
    const r = run(envFile);
    expect(r.status).toBe(0);
    expect(sentSecret()).toBe("abc123");
  });

  test("이름이 비슷한 다른 키·주석은 무시", () => {
    const r = run(
      "# CRON_SECRET=nope\nMY_CRON_SECRET=nope\nCRON_SECRET=abc123\n",
    );
    expect(r.status).toBe(0);
    expect(sentSecret()).toBe("abc123");
  });

  test("미설정·빈 값이면 호출하지 않고 성공 종료", () => {
    for (const envFile of ["A=1\n", "CRON_SECRET=\n", 'CRON_SECRET=""\n']) {
      rmSync(join(dir, "curl.log"), { force: true });
      const r = run(envFile);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("건너뜀");
      expect(existsSync(join(dir, "curl.log"))).toBe(false);
    }
  });
});
