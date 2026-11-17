// @vitest-environment node
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { setupTestDb } from "@/lib/test-db";
import { makeUser } from "@/lib/test-factories";

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const png = () => new File([PNG_1x1], "a.png", { type: "image/png" });

type Mod = typeof import("@/lib/uploads");
let m: Mod;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;
let dir: string;
let alice: string, bob: string;

const fileOf = (url: string) =>
  join(dir, url.slice("/uploads/".length).split("?")[0]);
const urlOf = (r: { url: string } | { error: string }) => {
  if (!("url" in r)) throw new Error(r.error);
  return r.url;
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "uploads-"));
  process.env.UPLOAD_DIR = dir; // save-image가 모듈 로드 시 읽음 → import 전에 설정
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  alice = (await makeUser(prisma)).id;
  bob = (await makeUser(prisma)).id;
  m = await import("@/lib/uploads");
});
afterAll(async () => {
  await cleanup();
  rmSync(dir, { recursive: true, force: true });
});

describe("uploads (소유 기록)", () => {
  test("saveOwnedImage: 파일 저장 + 소유자·종류 기록", async () => {
    const url = urlOf(await m.saveOwnedImage(png(), alice, "avatar"));
    expect(existsSync(fileOf(url))).toBe(true);
    const name = url.slice("/uploads/".length).split("?")[0];
    expect(await prisma.upload.findUnique({ where: { name } })).toMatchObject({
      ownerId: alice,
      kind: "avatar",
    });
  });

  test("형식 오류는 기록 없이 에러", async () => {
    const before = await prisma.upload.count();
    const r = await m.saveOwnedImage(
      new File([Buffer.from("not image")], "a.png", { type: "image/png" }),
      alice,
      "avatar",
    );
    expect(r).toHaveProperty("error");
    expect(await prisma.upload.count()).toBe(before);
  });

  test("isOwnedUpload: 소유자·종류가 모두 맞을 때만 true", async () => {
    const url = urlOf(await m.saveOwnedImage(png(), alice, "avatar"));
    expect(await m.isOwnedUpload(url, alice, "avatar")).toBe(true);
    expect(await m.isOwnedUpload(url, bob, "avatar")).toBe(false);
    expect(await m.isOwnedUpload(url, alice, "post")).toBe(false);
    expect(await m.isOwnedUpload("/uploads/nope.png", alice, "avatar")).toBe(
      false,
    );
    expect(await m.isOwnedUpload("https://x.com/a.png", alice, "avatar")).toBe(
      false,
    );
  });

  test("deleteOwnedUpload: 남의 파일은 지우지 않고, 본인 파일만 기록·파일 삭제", async () => {
    const url = urlOf(await m.saveOwnedImage(png(), alice, "avatar"));
    expect(await m.deleteOwnedUpload(url, bob, "avatar")).toBe(false);
    expect(existsSync(fileOf(url))).toBe(true);
    expect(await m.deleteOwnedUpload(url, alice, "avatar")).toBe(true);
    expect(existsSync(fileOf(url))).toBe(false);
  });

  test("관리자 업로드(ownerId null)는 회원이 지울 수 없음", async () => {
    const url = urlOf(await m.saveOwnedImage(png(), null, "admin"));
    expect(await m.deleteOwnedUpload(url, alice, "avatar")).toBe(false);
    expect(await m.isOwnedUpload(url, null, "admin")).toBe(true);
    expect(existsSync(fileOf(url))).toBe(true);
  });

  test("canUseAsAvatar: 본인 아바타 업로드·현재 아바타(기록 없는 옛 파일)만 허용", async () => {
    const mine = urlOf(await m.saveOwnedImage(png(), alice, "avatar"));
    const others = urlOf(await m.saveOwnedImage(png(), bob, "avatar"));
    const myPostImage = urlOf(await m.saveOwnedImage(png(), alice, "post"));
    const admin = urlOf(await m.saveOwnedImage(png(), null, "admin"));
    expect(await m.canUseAsAvatar(alice, mine)).toBe(true);
    expect(await m.canUseAsAvatar(alice, others)).toBe(false);
    expect(await m.canUseAsAvatar(alice, myPostImage)).toBe(false);
    expect(await m.canUseAsAvatar(alice, admin)).toBe(false);
    // 소유 기록 도입 전 지정해 둔 현재 아바타는 그대로 유지 가능(쿼리 차이 무시)
    const legacy = "/uploads/11111111-1111-1111-1111-111111111111.png";
    await prisma.user.update({
      where: { id: alice },
      data: { avatarUrl: `${legacy}?w=1&h=1` },
    });
    expect(await m.canUseAsAvatar(alice, legacy)).toBe(true);
    expect(await m.canUseAsAvatar(bob, legacy)).toBe(false);
  });
});
