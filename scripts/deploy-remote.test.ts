// @vitest-environment node
// 운영 배포 스크립트를 가짜 docker(호출 기록 + 시나리오별 응답)로 실행해 순서·실패 처리 검증.
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(process.cwd(), "scripts", "deploy-remote.sh");
const IMAGE = "ghcr.io/kisagge/blog-project";
const SHA = "abc123def456";

let dir: string;
let log: string;

// 가짜 docker: 호출 인자를 log에 한 줄씩 기록. 시나리오는 env로.
//  FAKE_RUNNING=1 → compose ps가 컨테이너 id 출력 / FAKE_BACKUP_FAIL=1 → 백업 exec 실패
//  FAKE_HEALTH="starting healthy" → inspect 호출마다 순서대로 상태 반환(마지막 값 유지)
// 가짜 docker: 호출 인자를 log에 한 줄씩 기록. 시나리오는 env로.
//  FAKE_RUNNING=1 → compose ps가 컨테이너 id 출력 / FAKE_BACKUP_FAIL=1 → 백업 exec 실패
//  FAKE_HEALTH="starting healthy" → inspect 호출마다 순서대로 헬스 상태(마지막 값 유지).
//    "none"은 healthcheck 없는 컨테이너(손으로 복사한 옛 compose.yaml), "exited"는 컨테이너 종료
//  FAKE_PROBE=ok|fail → healthcheck 없을 때 컨테이너 안 /api/health 직접 확인 결과
const FAKE_DOCKER = `#!/bin/sh
echo "$*" >> "$FAKE_LOG"
case "$*" in
  "compose ps --status running -q web") [ "\${FAKE_RUNNING:-0}" = 1 ] && echo cid123; exit 0 ;;
  "compose ps -q web") echo cid123; exit 0 ;;
  "compose exec -T web sh scripts/backup-db.sh") [ "\${FAKE_BACKUP_FAIL:-0}" = 1 ] && exit 1; echo "[backup] ok"; exit 0 ;;
  "compose -f compose.yaml.new config -q") [ "\${FAKE_CONFIG_FAIL:-0}" = 1 ] && exit 1; exit 0 ;;
  "compose exec -T web node -e"*) [ "\${FAKE_PROBE:-fail}" = ok ] && exit 0; exit 1 ;;
  inspect*)
    n=$(grep -c '^inspect' "$FAKE_LOG")
    set -- \${FAKE_HEALTH:-healthy}
    i=1; s=""; for x in "$@"; do s="$x"; [ "$i" -ge "$n" ] && break; i=$((i+1)); done
    case "$s" in exited) echo "exited none" ;; *) echo "running $s" ;; esac
    exit 0 ;;
esac
exit 0
`;

function deploy(env: Record<string, string>) {
  return spawnSync("sh", [SCRIPT], {
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      PATH: `${dir}:/usr/bin:/bin`,
      FAKE_LOG: log,
      DEPLOY_DIR: dir,
      DEPLOY_HEALTH_INTERVAL: "0",
      ...env,
    },
  });
}
const calls = () =>
  readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .filter((l) => !l.startsWith("inspect")); // 헬스 폴링은 순서 비교에서 제외
const indexOf = (cmd: string) => calls().indexOf(cmd);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "deploy-"));
  log = join(dir, "calls.log");
  writeFileSync(log, "");
  writeFileSync(join(dir, "docker"), FAKE_DOCKER);
  chmodSync(join(dir, "docker"), 0o755);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("deploy-remote.sh", () => {
  test("정상: 커밋 이미지 pull → 배포 전 백업 → latest로 지정 → 기동 → 헬스 대기", () => {
    const r = deploy({
      DEPLOY_SHA: SHA,
      FAKE_RUNNING: "1",
      FAKE_HEALTH: "starting starting healthy",
    });
    expect(r.status).toBe(0);
    const pull = indexOf(`pull ${IMAGE}:${SHA}`);
    const backup = indexOf("compose exec -T web sh scripts/backup-db.sh");
    const tag = indexOf(`tag ${IMAGE}:${SHA} ${IMAGE}:latest`);
    const up = indexOf("compose up -d");
    expect([pull, backup, tag, up].every((i) => i >= 0)).toBe(true);
    expect(pull).toBeLessThan(backup);
    expect(backup).toBeLessThan(tag); // 새 이미지가 마이그레이션하기 전에 백업
    expect(tag).toBeLessThan(up);
    expect(calls()).not.toContain("compose pull"); // 레지스트리 latest를 끌어오지 않음(경합 방지)
    expect(r.stdout).toContain(`deployed ${SHA}`);
    expect(calls()).toContain("compose logs --tail=40 web"); // 마이그레이션 출력 남김
  });

  test("배포 전 백업 실패 → 배포 중단(기동하지 않음)", () => {
    const r = deploy({
      DEPLOY_SHA: SHA,
      FAKE_RUNNING: "1",
      FAKE_BACKUP_FAIL: "1",
    });
    expect(r.status).not.toBe(0);
    expect(indexOf("compose up -d")).toBe(-1);
    expect(indexOf(`tag ${IMAGE}:${SHA} ${IMAGE}:latest`)).toBe(-1);
  });

  test("컨테이너가 꺼져 있으면 백업 없이 경고 후 배포", () => {
    const r = deploy({ DEPLOY_SHA: SHA, FAKE_RUNNING: "0" });
    expect(r.status).toBe(0);
    expect(indexOf("compose exec -T web sh scripts/backup-db.sh")).toBe(-1);
    expect(r.stdout).toContain("::warning::");
    expect(indexOf("compose up -d")).toBeGreaterThanOrEqual(0);
  });

  test("헬스체크 unhealthy → 실패 + 최근 로그 출력", () => {
    const r = deploy({
      DEPLOY_SHA: SHA,
      FAKE_RUNNING: "1",
      FAKE_HEALTH: "starting unhealthy",
    });
    expect(r.status).not.toBe(0);
    expect(calls()).toContain("compose logs --tail=80 web");
    expect(r.stdout).toContain("::error::");
  });

  test("헬스가 끝내 healthy가 안 되면 시간 초과로 실패", () => {
    const r = deploy({
      DEPLOY_SHA: SHA,
      FAKE_RUNNING: "1",
      FAKE_HEALTH: "starting",
      DEPLOY_HEALTH_TRIES: "3",
    });
    expect(r.status).not.toBe(0);
    expect(calls()).toContain("compose logs --tail=80 web");
  });

  test("healthcheck 없는 compose(옛 서버 파일): 컨테이너 안에서 /api/health 직접 확인해 통과", () => {
    const r = deploy({
      DEPLOY_SHA: SHA,
      FAKE_RUNNING: "1",
      FAKE_HEALTH: "none",
      FAKE_PROBE: "ok",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`deployed ${SHA}`);
  });

  test("healthcheck 없고 앱이 응답하지 않으면 시간 초과로 실패", () => {
    const r = deploy({
      DEPLOY_SHA: SHA,
      FAKE_RUNNING: "1",
      FAKE_HEALTH: "none",
      FAKE_PROBE: "fail",
      DEPLOY_HEALTH_TRIES: "3",
    });
    expect(r.status).not.toBe(0);
    expect(calls()).toContain("compose logs --tail=80 web");
  });

  test("컨테이너가 종료되면 기다리지 않고 바로 실패", () => {
    const r = deploy({
      DEPLOY_SHA: SHA,
      FAKE_RUNNING: "1",
      FAKE_HEALTH: "starting exited",
      DEPLOY_HEALTH_TRIES: "30",
    });
    expect(r.status).not.toBe(0);
    const inspects = readFileSync(log, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("inspect")).length;
    expect(inspects).toBe(2);
    expect(r.stdout).toContain("exited");
  });

  describe("compose.yaml 동기화(DEPLOY_COMPOSE_B64)", () => {
    const OLD = "services:\n  web:\n    image: x:latest\n";
    const NEW = OLD + "    logging:\n      driver: json-file\n";
    const b64 = (t: string) => Buffer.from(t).toString("base64");
    const compose = () => readFileSync(join(dir, "compose.yaml"), "utf8");
    const backups = () =>
      readdirSync(dir).filter((f) => f.startsWith("compose.yaml.bak-"));

    test("내용이 다르면 기존 파일 백업 + diff 출력 후 교체, 그다음 배포", () => {
      writeFileSync(join(dir, "compose.yaml"), OLD);
      const r = deploy({
        DEPLOY_SHA: SHA,
        FAKE_RUNNING: "1",
        DEPLOY_COMPOSE_B64: b64(NEW),
      });
      expect(r.status).toBe(0);
      expect(compose()).toBe(NEW);
      expect(backups()).toHaveLength(1);
      expect(readFileSync(join(dir, backups()[0]), "utf8")).toBe(OLD);
      expect(r.stdout).toContain("+    logging:");
      expect(existsSync(join(dir, "compose.yaml.new"))).toBe(false);
      // 검증이 pull·백업보다 먼저
      expect(indexOf("compose -f compose.yaml.new config -q")).toBeLessThan(
        indexOf(`pull ${IMAGE}:${SHA}`),
      );
    });

    test("같으면 백업·교체 없이 배포", () => {
      writeFileSync(join(dir, "compose.yaml"), NEW);
      const r = deploy({
        DEPLOY_SHA: SHA,
        FAKE_RUNNING: "1",
        DEPLOY_COMPOSE_B64: b64(NEW),
      });
      expect(r.status).toBe(0);
      expect(backups()).toHaveLength(0);
      expect(r.stdout).toContain("compose.yaml 변경 없음");
    });

    test("새 compose가 유효하지 않으면 아무것도 바꾸지 않고 중단", () => {
      writeFileSync(join(dir, "compose.yaml"), OLD);
      const r = deploy({
        DEPLOY_SHA: SHA,
        FAKE_RUNNING: "1",
        FAKE_CONFIG_FAIL: "1",
        DEPLOY_COMPOSE_B64: b64("broken: [\n"),
      });
      expect(r.status).not.toBe(0);
      expect(compose()).toBe(OLD);
      expect(backups()).toHaveLength(0);
      expect(indexOf(`pull ${IMAGE}:${SHA}`)).toBe(-1);
      expect(existsSync(join(dir, "compose.yaml.new"))).toBe(false);
    });

    test("DEPLOY_COMPOSE_B64가 없으면 서버 파일 그대로(수동 실행 호환)", () => {
      writeFileSync(join(dir, "compose.yaml"), OLD);
      const r = deploy({ DEPLOY_SHA: SHA, FAKE_RUNNING: "1" });
      expect(r.status).toBe(0);
      expect(compose()).toBe(OLD);
    });
  });

  test("DEPLOY_SHA 없으면 docker를 건드리기 전에 실패", () => {
    const r = deploy({});
    expect(r.status).not.toBe(0);
    expect(readFileSync(log, "utf8")).toBe("");
  });
});
