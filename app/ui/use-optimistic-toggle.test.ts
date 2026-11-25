import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOptimisticToggles } from "@/app/ui/use-optimistic-toggle";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useOptimisticToggles", () => {
  test("즉시 뒤집고, 디바운스 후 1회 커밋 / 짝수 연타는 호출 없음", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useOptimisticToggles({ a: false }, commit),
    );
    act(() => void result.current.toggle("a"));
    expect(result.current.state.a).toBe(true);
    expect(result.current.pending()).toBe(true);
    await act(async () => vi.advanceTimersByTime(500));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("a");
    expect(result.current.pending()).toBe(false);

    act(() => void result.current.toggle("a"));
    act(() => void result.current.toggle("a"));
    await act(async () => vi.advanceTimersByTime(500));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(result.current.state.a).toBe(true);
  });

  test("커밋 실패 시 되돌리고 onRevert(key, 실패한 값) 호출", async () => {
    const commit = vi.fn().mockRejectedValue(new Error("429"));
    const onRevert = vi.fn();
    const { result } = renderHook(() =>
      useOptimisticToggles({ a: false, b: true }, commit, onRevert),
    );
    act(() => void result.current.toggle("b"));
    expect(result.current.state.b).toBe(false);
    await act(async () => vi.advanceTimersByTime(500));
    expect(result.current.state.b).toBe(true);
    expect(onRevert).toHaveBeenCalledWith("b", false);
    expect(result.current.state.a).toBe(false);
  });

  test("reset: 대기 중이 아니면 서버 값으로 맞춤", () => {
    const { result } = renderHook(() =>
      useOptimisticToggles({ a: false }, vi.fn()),
    );
    act(() => result.current.reset({ a: true }));
    expect(result.current.state.a).toBe(true);
  });
});
