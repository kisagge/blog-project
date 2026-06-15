// 인메모리 고정 윈도우 속도 제한. proxy(Node 런타임, 단일 프로세스)에서 모듈 상태 유지.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

// key당 windowMs 동안 limit회까지 허용. 허용이면 true, 초과면 false.
// now는 테스트용 주입(기본 Date.now()).
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  // 가끔 만료 버킷 정리(메모리 누수 방지).
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
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
