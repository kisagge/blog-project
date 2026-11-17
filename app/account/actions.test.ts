// @vitest-environment node
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ createMemberSession: vi.fn() }));
vi.mock("@/lib/dal", () => ({ getMemberSession: vi.fn() }));
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { setupTestDb } from "@/lib/test-db";
import { makeUser } from "@/lib/test-factories";
import { getMemberSession } from "@/lib/dal";

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const pngForm = () => {
  const f = new FormData();
  f.set("file", new File([PNG_1x1], "a.png", { type: "image/png" }));
  return f;
};

type Actions = typeof import("@/app/account/actions");
type Avatar = typeof import("@/app/account/avatar-action");
type Admin = typeof import("@/app/admin/upload-action");
let A: Actions;
let av: Avatar;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;
let dir: string;
let victim: { id: string; nickname: string };
let attacker: { id: string; nickname: string };

const gms = vi.mocked(getMemberSession);
const as = (u: { id: string; nickname: string }) =>
  gms.mockResolvedValue({
    userId: u.id,
    nickname: u.nickname,
    role: "member",
  } as Awaited<ReturnType<typeof getMemberSession>>);
const fileOf = (url: string) =>
  join(dir, url.slice("/uploads/".length).split("?")[0]);
const profileForm = (u: { nickname: string }, avatarUrl: string) => {
  const f = new FormData();
  f.set("nickname", u.nickname);
  f.set("bio", "");
  f.set("avatarUrl", avatarUrl);
  return f;
};
const upload = async () => {
  const r = await av.uploadAvatar(pngForm());
  if (!("url" in r)) throw new Error(r.error);
  return r.url;
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "acct-uploads-"));
  process.env.UPLOAD_DIR = dir;
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  victim = await makeUser(prisma);
  attacker = await makeUser(prisma);
  A = await import("@/app/account/actions");
  av = await import("@/app/account/avatar-action");
});
afterAll(async () => {
  await cleanup();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => gms.mockReset());

describe("아바타 지정·교체 (업로드 소유)", () => {
  test("본인 업로드 → 지정 → 다른 본인 업로드로 교체 시 이전 파일 삭제", async () => {
    as(victim);
    const first = await upload();
    expect(
      await A.updateProfileAction(undefined, profileForm(victim, first)),
    ).toEqual({ done: true });
    const second = await upload();
    expect(
      await A.updateProfileAction(undefined, profileForm(victim, second)),
    ).toEqual({ done: true });
    expect(existsSync(fileOf(first))).toBe(false);
    expect(existsSync(fileOf(second))).toBe(true);
  });

  test("공격: 남의 업로드를 아바타로 지정 불가 → 교체해도 피해자 파일 유지", async () => {
    as(victim);
    const victimFile = await upload();
    await A.updateProfileAction(undefined, profileForm(victim, victimFile));

    as(attacker);
    const r = await A.updateProfileAction(
      undefined,
      profileForm(attacker, victimFile),
    );
    expect(r).toEqual({
      errors: {
        avatarUrl: ["직접 업로드한 이미지만 아바타로 쓸 수 있습니다."],
      },
    });
    // 공격자가 자기 업로드로 바꾸거나 아바타를 지워도 피해자 파일은 그대로
    await A.updateProfileAction(
      undefined,
      profileForm(attacker, await upload()),
    );
    await A.updateProfileAction(undefined, profileForm(attacker, ""));
    expect(existsSync(fileOf(victimFile))).toBe(true);
    expect(
      (await prisma.user.findUnique({ where: { id: victim.id } }))?.avatarUrl,
    ).toBe(victimFile);
  });

  test("공격: 관리자 본문 이미지도 아바타로 지정 불가", async () => {
    vi.doMock("@/lib/dal", () => ({
      getMemberSession: gms,
      verifySession: vi.fn(async () => ({ role: "admin" })),
    }));
    const admin: Admin = await import("@/app/admin/upload-action");
    const r = await admin.uploadImage(pngForm());
    if (!("url" in r)) throw new Error(r.error);
    as(attacker);
    expect(
      await A.updateProfileAction(undefined, profileForm(attacker, r.url)),
    ).toHaveProperty("errors.avatarUrl");
    expect(existsSync(fileOf(r.url))).toBe(true);
  });

  test("같은 파일을 쿼리만 바꿔 다시 저장해도 현재 아바타 파일을 지우지 않음", async () => {
    as(victim);
    const url = await upload();
    await A.updateProfileAction(undefined, profileForm(victim, url));
    const bare = url.split("?")[0];
    expect(
      await A.updateProfileAction(
        undefined,
        profileForm(victim, `${bare}?x=1`),
      ),
    ).toEqual({ done: true });
    expect(existsSync(fileOf(url))).toBe(true);
  });
});
