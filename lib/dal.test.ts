// @vitest-environment node
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { encrypt } from "@/lib/jwt";

vi.mock("server-only", () => ({}));

// 세션 쿠키를 모듈 레벨 가변 토큰으로 모킹(시나리오마다 교체).
let token: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) =>
      k === "session" && token ? { value: token } : undefined,
  }),
}));

// redirect는 NEXT_REDIRECT throw로 흉내.
const redirectMock = vi.fn((url: string) => {
  const e = new Error("NEXT_REDIRECT") as Error & {
    digest?: string;
    url?: string;
  };
  e.digest = "NEXT_REDIRECT";
  e.url = url;
  throw e;
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

type Dal = typeof import("@/lib/dal");
type Prisma = (typeof import("@/lib/prisma"))["prisma"];
let prisma: Prisma;
let cleanup: () => Promise<void>;
let approvedId: string;
let pendingId: string;

const exp = "2099-01-01T00:00:00.000Z";

// React cache()가 무인자 함수를 메모이즈할 수 있어, 세션 상태 시나리오마다 dal을 새로 import.
async function freshDal(): Promise<Dal> {
  vi.resetModules();
  return import("@/lib/dal");
}

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma as Prisma;
  const a = await prisma.user.create({
    data: {
      email: "ap@x.com",
      nickname: "승인",
      passwordHash: "-",
      status: "approved",
    },
  });
  const p = await prisma.user.create({
    data: {
      email: "pe@x.com",
      nickname: "대기",
      passwordHash: "-",
      status: "pending",
    },
  });
  approvedId = a.id;
  pendingId = p.id;
});
afterAll(async () => {
  await cleanup();
});
beforeEach(() => {
  token = undefined;
  redirectMock.mockClear();
});

describe("dal", () => {
  test("anon(쿠키 없음): role anon, getMemberSession null, isBlockedMember false", async () => {
    const dal = await freshDal();
    expect(await dal.getViewerRole()).toBe("anon");
    expect(await dal.getMemberSession()).toBeNull();
    expect(await dal.isBlockedMember()).toBe(false);
  });

  test("승인 member: role member, getMemberSession 세션, isBlockedMember false", async () => {
    token = await encrypt({
      role: "member",
      userId: approvedId,
      nickname: "승인",
      expiresAt: exp,
    });
    const dal = await freshDal();
    expect(await dal.getViewerRole()).toBe("member");
    expect(await dal.getMemberSession()).toMatchObject({
      role: "member",
      userId: approvedId,
    });
    expect(await dal.isBlockedMember()).toBe(false);
  });

  test("미승인(차단) member: getMemberSession null, isBlockedMember true", async () => {
    token = await encrypt({
      role: "member",
      userId: pendingId,
      nickname: "대기",
      expiresAt: exp,
    });
    const dal = await freshDal();
    expect(await dal.getMemberSession()).toBeNull();
    expect(await dal.isBlockedMember()).toBe(true);
  });

  test("admin: role admin, verifySession 통과", async () => {
    token = await encrypt({ role: "admin", expiresAt: exp });
    const dal = await freshDal();
    expect(await dal.getViewerRole()).toBe("admin");
    expect(await dal.verifySession()).toMatchObject({ role: "admin" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  test("비admin: verifySession이 redirect('/login') throw", async () => {
    token = await encrypt({
      role: "member",
      userId: approvedId,
      nickname: "승인",
      expiresAt: exp,
    });
    const dal = await freshDal();
    await expect(dal.verifySession()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
