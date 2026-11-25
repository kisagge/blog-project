import { useEffect, useRef, useState } from "react";
import {
  clearDraft,
  loadDraft,
  pruneDrafts,
  saveDraft,
} from "@/lib/draft-store";

type Fields = Record<string, string>;

const hasContent = (d: Fields) => Object.values(d).some(Boolean);
const differs = <T extends Fields>(d: T, initial: T) =>
  (Object.keys(initial) as (keyof T)[]).some((k) => d[k] !== initial[k]);

// 편집기 초안(localStorage) 공용: 마운트 시 오래된 초안 정리 + 초기값과 다른 저장본이 있으면 복원 제안,
// 입력 중 디바운스 저장, 제출 실패 시 즉시 저장(제출할 때 지운 초안 되살림), 제출 시 삭제.
// 필드를 읽고 쓰는 방식(제어/비제어)은 편집기마다 달라 값 자체는 호출부가 다룬다.
export function useDraft<T extends Fields>(key: string, initial: T) {
  const [restorable, setRestorable] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pruneDrafts();
    const d = loadDraft<T>(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d && hasContent(d) && differs(d, initial)) setRestorable(d);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 즉시 저장(모두 빈 값이면 저장하지 않음).
  function save(data: T | null) {
    if (data && hasContent(data)) saveDraft(key, data);
  }

  // 마지막 호출 후 delayMs가 지나면 read()로 그 시점 값을 읽어 저장.
  function saveSoon(read: () => T | null, delayMs = 800) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(read()), delayMs);
  }

  // 복원 제안 수락: 저장본을 돌려주고 안내를 닫음(값 적용은 호출부).
  function accept(): T | null {
    const d = restorable;
    setRestorable(null);
    return d;
  }

  // 복원 제안 거절: 저장본 삭제.
  function dismiss() {
    clearDraft(key);
    setRestorable(null);
  }

  // 제출: 대기 중 저장 취소 + 저장본 삭제(실패하면 save로 되살림).
  function clear() {
    if (timer.current) clearTimeout(timer.current);
    clearDraft(key);
  }

  return {
    restorable: restorable !== null,
    save,
    saveSoon,
    accept,
    dismiss,
    clear,
  };
}
