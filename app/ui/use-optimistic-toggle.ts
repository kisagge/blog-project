import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 500;

// 낙관적 토글 공용(좋아요·댓글 좋아요·리액션·저장). 키별로:
// - 누르면 즉시 뒤집어 표시하고, 연타는 마지막 상태로 합쳐 DEBOUNCE_MS 뒤 1번만 커밋
//   (서버 toggle은 현재 상태를 뒤집으므로, 서버에 반영된 값과 다를 때만 호출 — 짝수 연타는 호출 없음)
// - 커밋 실패(429 등) 시 되돌리고 onRevert(key, 실패한 값)로 알림(카운트 보정용).
//   그 사이 사용자가 다시 눌렀다면 최신 의도를 보존.
// - pending(): 커밋 대기·진행 중인지(실시간 재동기화가 낙관 상태를 덮지 않게 하는 가드)
export function useOptimisticToggles<K extends string>(
  initial: Record<K, boolean>,
  commit: (key: K) => Promise<unknown>,
  onRevert?: (key: K, failed: boolean) => void,
) {
  const [state, setState] = useState(initial);
  const committed = useRef({ ...initial }); // 서버에 반영된 값
  const timers = useRef(new Map<K, ReturnType<typeof setTimeout>>());
  const inflight = useRef(0);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  // 반환값: 뒤집은 뒤의 값(호출부가 카운트를 같이 움직일 때 사용).
  function toggle(key: K): boolean {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    const prev = timers.current.get(key);
    if (prev) clearTimeout(prev);
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        if (next === committed.current[key]) return;
        committed.current[key] = next;
        inflight.current++;
        commit(key)
          .catch(() => {
            committed.current[key] = !next;
            setState((s) => (s[key] === next ? { ...s, [key]: !next } : s));
            onRevert?.(key, next);
          })
          .finally(() => {
            inflight.current--;
          });
      }, DEBOUNCE_MS),
    );
    return next;
  }

  const pending = () => timers.current.size > 0 || inflight.current > 0;

  // 서버 값으로 맞춤(재접속 재동기화). 대기 중이면 사용자 의도를 지키려 호출부가 건너뛴다.
  function reset(values: Record<K, boolean>) {
    committed.current = { ...values };
    setState(values);
  }

  return { state, toggle, pending, reset };
}

// 키 하나짜리 편의 버전.
export function useOptimisticToggle(
  initial: boolean,
  commit: () => Promise<unknown>,
  onRevert?: (failed: boolean) => void,
) {
  const t = useOptimisticToggles({ on: initial }, commit, (_k, failed) =>
    onRevert?.(failed),
  );
  return {
    on: t.state.on,
    toggle: () => t.toggle("on"),
    pending: t.pending,
    reset: (on: boolean) => t.reset({ on }),
  };
}
