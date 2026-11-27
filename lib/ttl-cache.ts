// 프로세스 메모리 캐시(단일 컨테이너 전제 — rate-limit·이벤트 버스와 같은 가정).
// 만료(ttlMs) + 개수 상한(max, 가장 오래 안 쓴 것부터 버림). 진행 중인 계산은 Promise를 공유해
// 동시에 몰린 같은 요청이 한 번만 계산하고, 실패한 계산은 저장하지 않는다(다음 요청이 재시도).
export function createTtlCache<V>({
  ttlMs,
  max,
}: {
  ttlMs: number;
  max: number;
}) {
  const entries = new Map<string, { at: number; value: Promise<V> }>();

  function getOrSet(key: string, compute: () => Promise<V>): Promise<V> {
    const hit = entries.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      entries.delete(key); // 최근 사용으로 갱신(Map은 삽입 순서 유지)
      entries.set(key, hit);
      return hit.value;
    }
    const value = compute();
    entries.delete(key);
    entries.set(key, { at: Date.now(), value });
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    while (entries.size > max) entries.delete(entries.keys().next().value!);
    return value;
  }

  return { getOrSet, clear: () => entries.clear() };
}
