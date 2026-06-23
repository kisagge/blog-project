// 인메모리 고정 윈도우 속도 제한. proxy(Node 런타임, 단일 프로세스)에서 모듈 상태 유지.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;
const MAX_BUCKETS = 50_000; // 메모리 상한(≈수 MB) — 고유 키 폭주(공격) 시 OOM 안전밸브.

// 현재 버킷 수(관측·테스트용).
export function bucketCount(): number {
  return buckets.size;
}

// key당 windowMs 동안 limit회까지 허용. 허용이면 true, 초과면 false.
// now는 테스트용 주입(기본 Date.now()).
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  // 가끔(또는 상한 초과 시) 만료 버킷 정리(메모리 누수 방지).
  if (now - lastSweep > 60_000 || buckets.size > MAX_BUCKETS) {
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    // 만료분 정리 후에도 상한 초과면(병적 폭주=공격) 전체 비움 — OOM 방지 우선.
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

// 레이트리밋 초과 시 액션이 돌려줄 메시지(전역 proxy 429와 동일 문구).
export const TOO_MANY_REQUESTS =
  "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";

// 민감 액션별 한도(접두사로 키 분리). 단일 컨테이너라 인메모리 한도로 충분.
export const ACTION_LIMITS = {
  signin: { limit: 10, windowMs: 5 * 60_000 }, // 로그인 브루트포스
  signup: { limit: 5, windowMs: 10 * 60_000 }, // 가입 스팸
  passwordReset: { limit: 5, windowMs: 10 * 60_000 }, // 코드 요청(이메일당 60s 쿨다운은 별개)
  report: { limit: 10, windowMs: 10 * 60_000 }, // 신고 남용
  avatarUpload: { limit: 20, windowMs: 10 * 60_000 }, // 회원 아바타 업로드(디스크 채우기 방지)
  postImageUpload: { limit: 30, windowMs: 10 * 60_000 }, // 회원 본문 이미지 업로드(여러 장 가능)
  follow: { limit: 60, windowMs: 10 * 60_000 }, // 팔로우/언팔로우 토글 남용 방지
} as const;

// 액션 레이트리밋. 허용이면 true. id는 IP(비로그인) 또는 userId(로그인).
export function allowAction(
  scope: keyof typeof ACTION_LIMITS,
  id: string,
): boolean {
  const { limit, windowMs } = ACTION_LIMITS[scope];
  return rateLimit(`${scope}:${id}`, limit, windowMs);
}
