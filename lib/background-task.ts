import "server-only";
import { swallow } from "@/lib/log";

// 앱 내부 주기 작업(예약 발행·보존 정리) 공용. 컨테이너(next start)가 항상 떠 있는 단일 프로세스 전제라
// 외부 cron 없이 인터벌로 돌린다. 핸들은 globalThis에 두어 register 재호출·HMR에도 작업당 1개만 유지.
type Handles = {
  delay?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
};
const g = globalThis as { __bgTasks?: Map<string, Handles> };
const tasks = () => (g.__bgTasks ??= new Map());

// run을 첫 실행(firstDelayMs 후, 0이면 즉시) 뒤 intervalMs마다 실행. 오류는 swallow(tag)로 로그만.
// 같은 key가 이미 돌고 있으면 무시(중복 시작 방지).
export function startBackgroundTask(
  key: string,
  run: () => Promise<unknown>,
  { firstDelayMs, intervalMs }: { firstDelayMs: number; intervalMs: number },
): void {
  if (tasks().has(key)) return;
  const tick = () => void run().catch(swallow(`scheduler:${key}`));
  const h: Handles = {};
  if (firstDelayMs <= 0) tick();
  else {
    h.delay = setTimeout(tick, firstDelayMs);
    h.delay.unref?.();
  }
  h.interval = setInterval(tick, intervalMs);
  h.interval.unref?.(); // 테스트/종료 시 프로세스 잔류 방지
  tasks().set(key, h);
}

// 작업 정지(테스트 정리용).
export function stopBackgroundTask(key: string): void {
  const h = tasks().get(key);
  if (!h) return;
  if (h.delay) clearTimeout(h.delay);
  if (h.interval) clearInterval(h.interval);
  tasks().delete(key);
}
