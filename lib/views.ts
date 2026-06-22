import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { kstDay } from "@/lib/kst";

const VID = "vid";
const VID_MAX_AGE = 60 * 60 * 24 * 365; // 1년

// 익명 방문자 ID(쿠키). 없으면 발급.
async function visitorId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VID)?.value;
  if (existing) return existing;
  const id = randomUUID();
  store.set(VID, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VID_MAX_AGE,
  });
  return id;
}

// 오늘 첫 조회면 View 기록을 만들고 true. 이미 봤으면 false(unique 충돌).
async function recordView(
  entityType: "feed" | "df" | "site",
  entityId: string,
): Promise<boolean> {
  const visitor = await visitorId();
  try {
    await prisma.view.create({
      data: { entityType, entityId, visitorId: visitor, day: kstDay() },
    });
    return true;
  } catch {
    return false;
  }
}

// View 기록 + viewCount 증가를 한 트랜잭션으로 원자화. unique 충돌(이미 조회)이면 롤백→false,
// 증가 실패면 둘 다 롤백(증가 없는 고아 View 방지). 절대 throw 안 함(호출부 fire-and-forget).
async function recordViewAndCount(
  entityType: "feed" | "df",
  entityId: string,
): Promise<void> {
  const visitor = await visitorId();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.view.create({
        data: { entityType, entityId, visitorId: visitor, day: kstDay() },
      });
      if (entityType === "feed") {
        await tx.feed.update({
          where: { id: entityId },
          data: { viewCount: { increment: 1 } },
        });
      } else {
        await tx.dfCharacter.update({
          where: { id: entityId },
          data: { viewCount: { increment: 1 } },
        });
      }
    });
  } catch {
    // 이미 조회(unique) 또는 증가 실패 → 무시(카운트는 항상 View 수와 일치 유지).
  }
}

export async function trackFeedView(feedId: string): Promise<void> {
  await recordViewAndCount("feed", feedId);
}

export async function trackDfView(dfCharacterId: string): Promise<void> {
  await recordViewAndCount("df", dfCharacterId);
}

// 사이트 방문(페이지 무관). 방문자·하루 단위로 1건 → 일 순 방문자 집계.
const SITE = "site";
export async function trackSiteVisit(): Promise<void> {
  await recordView("site", SITE);
}

export async function countTodayVisitors(): Promise<number> {
  return prisma.view.count({ where: { entityType: "site", day: kstDay() } });
}
