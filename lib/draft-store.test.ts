import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  draftKey,
  loadDraft,
  saveDraft,
  clearDraft,
  pruneDrafts,
} from "@/lib/draft-store";

const KEY = draftKey("member", "t1");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function count(): number {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("byjang-draft:")) n++;
  }
  return n;
}

describe("draft-store", () => {
  test("save→load 라운드트립", () => {
    saveDraft(KEY, { a: 1, b: "x" });
    expect(loadDraft<{ a: number; b: string }>(KEY)).toEqual({ a: 1, b: "x" });
  });

  test("TTL 초과 → null + 삭제", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ savedAt: Date.now() - 8 * DAY, data: { a: 1 } }),
    );
    expect(loadDraft(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test("용량 캡 초과(>1MB) → 미저장", () => {
    saveDraft(KEY, { big: "x".repeat(1_100_000) });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test("clearDraft 삭제", () => {
    saveDraft(KEY, { a: 1 });
    clearDraft(KEY);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test("pruneDrafts: 만료 삭제 + 개수 상한 초과 시 오래된 것부터", () => {
    localStorage.setItem(
      draftKey("member", "stale"),
      JSON.stringify({ savedAt: Date.now() - 8 * DAY, data: {} }),
    );
    for (let i = 0; i < 14; i++)
      localStorage.setItem(
        draftKey("member", `f${i}`),
        JSON.stringify({ savedAt: Date.now() - (14 - i) * 1000, data: {} }),
      );
    pruneDrafts();
    expect(localStorage.getItem(draftKey("member", "stale"))).toBeNull(); // 만료
    expect(count()).toBe(12); // 14 → 상한 12
    expect(localStorage.getItem(draftKey("member", "f0"))).toBeNull(); // 가장 오래된
    expect(localStorage.getItem(draftKey("member", "f13"))).not.toBeNull(); // 최신 유지
  });

  test("setItem이 throw해도 saveDraft는 throw 안 함(quota 내성)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => saveDraft(KEY, { a: 1 })).not.toThrow();
  });

  test("setItem 1회 실패 후 prune+retry로 저장 복구", () => {
    const real = Storage.prototype.setItem;
    let calls = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      k: string,
      v: string,
    ) {
      if (++calls === 1) throw new DOMException("quota", "QuotaExceededError");
      return real.call(this, k, v); // 재시도는 실제 저장
    });
    saveDraft(KEY, { a: 1 });
    expect(calls).toBe(2); // 최초 실패 → prune 후 1회 재시도
    expect(loadDraft<{ a: number }>(KEY)).toEqual({ a: 1 });
  });
});
