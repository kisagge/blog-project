// @vitest-environment node
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(process.cwd(), "scripts", "backup-db.sh");

function hasSqlite3(): boolean {
  try {
    execFileSync("sqlite3", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
// sqlite3 CLI는 dev(macOS)·CI(ubuntu-latest)에 기본 존재. 없으면 스킵.
const run = hasSqlite3() ? test : test.skip;

let dir: string;
let db: string;
let backups: string;

function runBackup() {
  execFileSync("sh", [SCRIPT], {
    env: {
      ...process.env,
      DATABASE_FILE: db,
      BACKUP_DIR: backups,
      BACKUP_KEEP_DAYS: "14",
    },
  });
}
const gzFiles = () =>
  readdirSync(backups).filter((f) => /^prod-.*\.db\.gz$/.test(f));

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "bk-"));
  db = join(dir, "src.db");
  backups = join(dir, "backups");
  execFileSync("sqlite3", [
    db,
    "CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT); INSERT INTO t(v) VALUES ('hello'),('world');",
  ]);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("backup-db.sh", () => {
  run("백업 .db.gz 생성 + 복원 가능(integrity_check ok, 행 보존)", () => {
    runBackup();
    const files = gzFiles();
    expect(files).toHaveLength(1);

    // 복원: gunzip → 무결성·행 수 확인.
    const restored = join(dir, "restored.db");
    execFileSync("sh", ["-c", `gunzip -c '${join(backups, files[0])}' > '${restored}'`]);
    expect(
      execFileSync("sqlite3", [restored, "PRAGMA integrity_check;"]).toString().trim(),
    ).toBe("ok");
    expect(
      execFileSync("sqlite3", [restored, "SELECT count(*) FROM t;"]).toString().trim(),
    ).toBe("2");
  });

  run("회전: KEEP일 초과 스냅샷 삭제, 신규는 잔존", () => {
    const old = join(backups, "prod-old.db.gz");
    writeFileSync(old, "x");
    const past = new Date(Date.now() - 30 * 86400 * 1000); // 30일 전
    utimesSync(old, past, past);

    runBackup();
    expect(existsSync(old)).toBe(false); // 30 > 14일 → 삭제
    expect(gzFiles().length).toBeGreaterThanOrEqual(1); // 신규 스냅샷 존재
  });
});
