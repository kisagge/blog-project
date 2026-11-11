import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kstDay } from "@/lib/kst";

// 글별 읽기 지표(익명·일 단위). 조회 트래킹이 만든 View 행(방문자·글·KST 일)에 읽은 깊이와
// 활성 시간을 덧붙인다 — 새 식별자·쿠키·행을 만들지 않는다(조회 기록이 없으면 무시).

export const COMPLETE_DEPTH = 90; // 이 깊이(%) 이상 내려가면 "완독"
export const MAX_ACTIVE_SECONDS = 3600; // 방문자·글·하루당 활성 시간 상한(탭 방치·조작 완화)
export const MAX_BEACON_SECONDS = 600; // 비콘 1회에 실을 수 있는 증분 상한

export const ReadBeaconSchema = z.object({
  feedId: z.string().min(1).max(64),
  depth: z.number().int().min(0).max(100),
  seconds: z.number().int().min(0).max(MAX_BEACON_SECONDS),
});
export type ReadBeacon = z.infer<typeof ReadBeaconSchema>;

// 오늘 이 방문자의 해당 글 View가 있으면 깊이는 최댓값, 시간은 누적(상한)으로 갱신하고 true.
export async function recordRead(
  visitorId: string,
  beacon: ReadBeacon,
): Promise<boolean> {
  const where = {
    entityType_entityId_visitorId_day: {
      entityType: "feed",
      entityId: beacon.feedId,
      visitorId,
      day: kstDay(),
    },
  };
  const row = await prisma.view.findUnique({
    where,
    select: { scrollDepth: true, activeSeconds: true },
  });
  if (!row) return false;
  await prisma.view.update({
    where,
    data: {
      scrollDepth: Math.max(row.scrollDepth ?? 0, beacon.depth),
      activeSeconds: Math.min(
        MAX_ACTIVE_SECONDS,
        (row.activeSeconds ?? 0) + beacon.seconds,
      ),
    },
  });
  return true;
}
