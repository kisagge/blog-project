// 초안 자동저장용 안전 localStorage 스토어(클라이언트 전용).
// 자동저장은 best-effort — 모든 접근을 try/catch로 감싸 타이핑/제출을 절대 막지 않는다.
// 누적/용량 방지: 글당 키 1개(overwrite) + TTL + 용량 캡 + QuotaExceeded 시 정리·재시도 + 개수 상한.

const PREFIX = "byjang-draft:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일 초과 초안은 무시·삭제
const MAX_LEN = 1_000_000; // 직렬화 문자열 길이(UTF-16 코드 유닛) 상한 — quota보다 보수적, 병적 케이스 차단
const MAX_DRAFTS = 12; // 보관 초안 개수 상한(초과 시 오래된 것부터 삭제)

type Stored<T> = { savedAt: number; data: T };

function ls(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

// 글당 키 1개(overwrite). 신규 글은 id가 없어 "new"를 공유 — 단일 작성자라 동시 신규 초안
// 충돌은 드물고, 충돌 시 마지막 저장이 이김(누적은 없음). 제출 성공 시 삭제로 잔류도 방지.
export function draftKey(scope: "member" | "admin", id: string): string {
  return `${PREFIX}${scope}:${id}`;
}

export function loadDraft<T>(key: string): T | null {
  const store = ls();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (!parsed || typeof parsed.savedAt !== "number") {
      store.removeItem(key);
      return null;
    }
    if (Date.now() - parsed.savedAt > TTL_MS) {
      store.removeItem(key); // 만료 → 삭제
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  const store = ls();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* 무시 */
  }
}

// 초안 접두 키 정리: 손상·만료 삭제 + 개수 상한 초과 시 오래된 것부터 삭제.
export function pruneDrafts(): void {
  const store = ls();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    const survivors: { key: string; savedAt: number }[] = [];
    for (const k of keys) {
      try {
        const p = JSON.parse(store.getItem(k) || "null") as Stored<unknown> | null;
        const savedAt = p && typeof p.savedAt === "number" ? p.savedAt : 0;
        if (Date.now() - savedAt > TTL_MS) {
          store.removeItem(k); // 만료
        } else {
          survivors.push({ key: k, savedAt });
        }
      } catch {
        store.removeItem(k); // 손상
      }
    }
    if (survivors.length > MAX_DRAFTS) {
      survivors.sort((a, b) => a.savedAt - b.savedAt); // 오래된 순
      for (const s of survivors.slice(0, survivors.length - MAX_DRAFTS)) {
        store.removeItem(s.key);
      }
    }
  } catch {
    /* 무시 */
  }
}

export function saveDraft<T>(key: string, data: T): void {
  const store = ls();
  if (!store) return;
  let payload: string;
  try {
    payload = JSON.stringify({ savedAt: Date.now(), data } as Stored<T>);
  } catch {
    return; // 직렬화 불가
  }
  if (payload.length > MAX_LEN) return; // 용량 캡
  try {
    store.setItem(key, payload);
  } catch {
    // QuotaExceededError 등 → 오래된 초안 정리 후 1회 재시도, 그래도 실패면 포기.
    try {
      pruneDrafts();
      store.setItem(key, payload);
    } catch {
      /* 자동저장 포기(타이핑/제출엔 영향 없음) */
    }
  }
}
