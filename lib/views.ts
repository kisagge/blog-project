import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const VID = "vid";
const VID_MAX_AGE = 60 * 60 * 24 * 365; // 1년

// KST 기준 날짜 문자열(YYYY-MM-DD). 하루 단위 중복 제거 키.
function kstDay(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

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
  entityType: "feed" | "df",
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
