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

export async function trackFeedView(feedId: string): Promise<void> {
  if (await recordView("feed", feedId)) {
    await prisma.feed
      .update({ where: { id: feedId }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
  }
}

export async function trackDfView(dfCharacterId: string): Promise<void> {
  if (await recordView("df", dfCharacterId)) {
    await prisma.dfCharacter
      .update({
        where: { id: dfCharacterId },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});
  }
}

// 사이트 방문(페이지 무관). 방문자·하루 단위로 1건 → 일 순 방문자 집계.
const SITE = "site";
export async function trackSiteVisit(): Promise<void> {
  await recordView("site", SITE);
}

export async function countTodayVisitors(): Promise<number> {
  return prisma.view.count({ where: { entityType: "site", day: kstDay() } });
}
