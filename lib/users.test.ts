import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";

vi.mock("server-only", () => ({}));

type Users = typeof import("@/lib/users");
let m: Users;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  m = await import("@/lib/users");
});
afterAll(async () => {
  await cleanup();
});

describe("users", () => {
  test("가입은 pending 회원을 만든다", async () => {
    const r = await m.createPendingUser({
      email: "A@x.com",
      nickname: "에이",
      password: "password1",
    });
    expect(r.ok).toBe(true);
    const u = await m.findUserByEmail("a@x.com"); // 소문자 정규화 확인
    expect(u?.status).toBe("pending");
  });
  test("신청 중(pending) 이메일 재신청은 '신청 중' 안내", async () => {
    const r = await m.createPendingUser({
      email: "a@x.com",
      nickname: "또",
      password: "password1",
    });
    expect(r).toEqual({
      ok: false,
      error: "이미 회원가입 신청 중입니다. 관리자 승인을 기다려 주세요.",
    });
  });
  test("미승인 회원은 로그인 차단", async () => {
    const r = await m.authenticateMember("a@x.com", "password1");
    expect(r).toEqual({ ok: false, error: "관리자 승인 대기 중입니다." });
  });
  test("승인 후 올바른 비밀번호로 로그인 성공", async () => {
    const u = await m.findUserByEmail("a@x.com");
    await m.approveUser(u!.id);
    const r = await m.authenticateMember("a@x.com", "password1");
    expect(r.ok).toBe(true);
  });
  test("틀린 비밀번호는 일반 메시지로 실패", async () => {
    const r = await m.authenticateMember("a@x.com", "nope");
    expect(r).toEqual({
      ok: false,
      error: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });
  });

  test("countUsersByStatus: 승인 1, 대기 0 (앞 테스트에서 승인됨)", async () => {
    expect(await m.countUsersByStatus("approved")).toBe(1);
    expect(await m.countUsersByStatus("pending")).toBe(0);
  });

  test("listUsersPage: 상태별 페이지네이션 (승인 25명, size20)", async () => {
    for (let i = 0; i < 25; i++) {
      await m.createPendingUser({
        email: `p${i}@x.com`,
        nickname: `n${i}`,
        password: "password1",
      });
      const u = await m.findUserByEmail(`p${i}@x.com`);
      await m.approveUser(u!.id);
    }
    const p1 = await m.listUsersPage("approved", 1, 20);
    expect(p1.items).toHaveLength(20);
    expect(p1.total).toBe(26); // 기존 a@x.com 1명 + 25명
    const p2 = await m.listUsersPage("approved", 2, 20);
    expect(p2.items).toHaveLength(6);
  });

  test("예약 admin User는 회원 목록/카운트에서 제외", async () => {
    const { ensureAdminUser } = await import("@/lib/comment-actor");
    await ensureAdminUser();
    const before = await m.countUsersByStatus("approved");
    const list = await m.listUsersByStatus("approved");
    expect(list.some((u) => u.email === "admin@byjang.local")).toBe(false);
    expect(before).toBe(list.length);
  });

  test("승인된 이메일 재신청은 '이미 가입' 안내", async () => {
    const r = await m.createPendingUser({
      email: "a@x.com", // 앞 테스트에서 승인됨
      nickname: "또또",
      password: "password1",
    });
    expect(r).toEqual({ ok: false, error: "이미 가입된 이메일입니다." });
  });

  test("거절은 행을 남기고 사유를 기록 (목록에서는 제외)", async () => {
    await m.createPendingUser({
      email: "rej@x.com",
      nickname: "거절자",
      password: "password1",
    });
    const u = await m.findUserByEmail("rej@x.com");
    await m.rejectUser(u!.id, "  부적절한 닉네임  ");
    const after = await m.findUserByEmail("rej@x.com");
    expect(after?.status).toBe("rejected");
    expect(after?.rejectionReason).toBe("부적절한 닉네임"); // trim됨
    expect(after?.rejectedAt).toBeInstanceOf(Date);
    // rejected는 pending/approved 목록 어디에도 안 보임
    const pending = await m.listUsersByStatus("pending");
    expect(pending.some((x) => x.email === "rej@x.com")).toBe(false);
  });

  test("거절된 이메일 재신청은 같은 행을 pending으로 되돌리고 이전 사유 보존", async () => {
    const r = await m.createPendingUser({
      email: "rej@x.com",
      nickname: "다시신청",
      password: "password2",
    });
    expect(r.ok).toBe(true);
    const u = await m.findUserByEmail("rej@x.com");
    expect(u?.status).toBe("pending");
    expect(u?.nickname).toBe("다시신청"); // 새 입력값으로 갱신
    expect(u?.rejectionReason).toBe("부적절한 닉네임"); // 과거 사유 보존
    // 대기 목록에 이전 거절 사유가 함께 노출
    const pending = await m.listUsersByStatus("pending");
    const entry = pending.find((x) => x.email === "rej@x.com");
    expect(entry?.rejectionReason).toBe("부적절한 닉네임");
  });

  test("재신청 건 승인 시 거절 이력 정리", async () => {
    const u = await m.findUserByEmail("rej@x.com");
    await m.approveUser(u!.id);
    const after = await m.findUserByEmail("rej@x.com");
    expect(after?.status).toBe("approved");
    expect(after?.rejectionReason).toBeNull();
    expect(after?.rejectedAt).toBeNull();
  });

  test("updateProfile은 닉네임 trim 저장·반환 + bio/avatar 저장(getMemberProfile 반영)", async () => {
    const u = await m.findUserByEmail("a@x.com");
    const result = await m.updateProfile(u!.id, {
      nickname: "  새닉네임  ",
      bio: "  안녕하세요  ",
      avatarUrl: "/uploads/abc-123.png?w=80&h=80",
    });
    expect(result).toBe("새닉네임");
    const prof = await m.getMemberProfile(u!.id);
    expect(prof?.nickname).toBe("새닉네임");
    expect(prof?.bio).toBe("안녕하세요");
    expect(prof?.avatarUrl).toBe("/uploads/abc-123.png?w=80&h=80");
  });

  test("updateProfile: bio/avatar 빈값이면 null로 저장(제거)", async () => {
    const u = await m.findUserByEmail("a@x.com");
    await m.updateProfile(u!.id, {
      nickname: "새닉네임",
      bio: "   ",
      avatarUrl: "",
    });
    const prof = await m.getMemberProfile(u!.id);
    expect(prof?.bio).toBeNull();
    expect(prof?.avatarUrl).toBeNull();
  });

  test("isNicknameTaken: 다른 회원·관리자 닉네임은 taken, 본인·미사용은 아님", async () => {
    await m.createPendingUser({
      email: "nick-x@x.com",
      nickname: "중복닉",
      password: "password1",
    });
    const x = await m.findUserByEmail("nick-x@x.com");
    expect(await m.isNicknameTaken("중복닉")).toBe(true);
    expect(await m.isNicknameTaken("  중복닉  ")).toBe(true); // trim 비교
    expect(await m.isNicknameTaken("중복닉", x!.id)).toBe(false); // 본인 제외
    expect(await m.isNicknameTaken("관리자")).toBe(true); // 예약 관리자 기본 닉네임
    expect(await m.isNicknameTaken("아무도안쓰는닉")).toBe(false);
  });

  test("가입 시 중복 닉네임은 거부", async () => {
    const r = await m.createPendingUser({
      email: "nick-dup@x.com",
      nickname: "중복닉",
      password: "password1",
    });
    expect(r).toEqual({ ok: false, error: m.NICKNAME_TAKEN_MESSAGE });
  });

  test("차단/차단해제: status 전환 + 로그인 차단 + 목록 노출", async () => {
    await m.createPendingUser({
      email: "blk@x.com",
      nickname: "차단대상",
      password: "Aa1!aaaa",
    });
    const u = await m.findUserByEmail("blk@x.com");
    await m.approveUser(u!.id);

    // 차단 → blocked, 로그인 불가
    await m.blockUser(u!.id);
    expect((await m.findUserByEmail("blk@x.com"))?.status).toBe("blocked");
    expect(await m.authenticateMember("blk@x.com", "Aa1!aaaa")).toEqual({
      ok: false,
      error: "이용이 제한된 계정입니다.",
    });
    // 차단 회원도 관리 목록(approved+blocked)에는 보임
    const listed = await m.listUsersPage(["approved", "blocked"], 1);
    expect(listed.items.find((x) => x.email === "blk@x.com")?.status).toBe(
      "blocked",
    );

    // 차단 해제 → approved 복구 + 로그인 가능
    await m.unblockUser(u!.id);
    expect((await m.findUserByEmail("blk@x.com"))?.status).toBe("approved");
    expect((await m.authenticateMember("blk@x.com", "Aa1!aaaa")).ok).toBe(true);
  });

  test("getMemberProfile: 회원만 반환, admin·없는 id는 null", async () => {
    await m.createPendingUser({
      email: "prof@x.com",
      nickname: "프로필회원",
      password: "password1",
    });
    const u = await m.findUserByEmail("prof@x.com");
    const p = await m.getMemberProfile(u!.id);
    expect(p?.nickname).toBe("프로필회원");
    expect(p).toHaveProperty("createdAt");
    // 예약 admin(role admin)은 프로필 없음
    const { ensureAdminUser } = await import("@/lib/comment-actor");
    const admin = await ensureAdminUser();
    expect(await m.getMemberProfile(admin.id)).toBeNull();
    // 없는 id
    expect(await m.getMemberProfile("nope")).toBeNull();
  });
});
