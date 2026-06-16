import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { kstStartOfTodayUtc } from "@/lib/kst";
import { parseTags, setFeedTags } from "@/lib/tags";

// 회원 글 가드.
export const DRAFT_LIMIT = 3; // 회원당 동시 임시저장 최대 개수
export const DAILY_PUBLISH_LIMIT = 5; // 회원당 하루 게시 개수

// 성공 시 value를 항상 반환(슬롯 id·slug 등) — value 선택인 공용 Result와 의미가 달라 로컬 유지.
type Result<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// 제목 기반 slug + 짧은 난수(충돌·악용 방지). 한글 제목은 ascii가 비어 "post-..."가 된다.
function genSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return `${base || "post"}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export async function countMyDrafts(userId: string): Promise<number> {
  return prisma.feed.count({ where: { authorId: userId, status: "draft" } });
}

async function countPublishedToday(userId: string): Promise<number> {
  return prisma.feed.count({
    where: {
      authorId: userId,
      status: "published",
      publishedAt: { gte: kstStartOfTodayUtc() },
    },
  });
}

export async function listMyDrafts(userId: string) {
  return prisma.feed.findMany({
    where: { authorId: userId, status: "draft" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
}

export async function listMyPosts(userId: string) {
  return prisma.feed.findMany({
    where: { authorId: userId, status: "published" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      viewCount: true,
      publishedAt: true,
    },
  });
}

// 공개 프로필용: 임의 작성자의 게시(회원공개) 글. 본인 확인 없음(공개 읽기).
export async function listMemberPosts(authorId: string) {
  return prisma.feed.findMany({
    where: {
      authorId,
      status: "published",
      visibility: "members",
      hiddenAt: null, // 신고로 가려진 글 제외
    },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      viewCount: true,
      publishedAt: true,
    },
  });
}

// 편집용 단건(본인 글만). 없거나 타인 글이면 null.
export async function getMyPost(userId: string, id: string) {
  return prisma.feed.findFirst({
    where: { id, authorId: userId },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      slug: true,
      feedTags: { select: { tag: { select: { name: true } } } },
    },
  });
}

type Input = { title: string; content: string; tags?: string };

// 임시저장 저장: id 있으면 본인 draft 갱신, 없으면 신규(한도 검사).
export async function saveDraft(
  userId: string,
  input: Input & { id?: string },
): Promise<Result<{ id: string }>> {
  if (input.id) {
    const row = await prisma.feed.findFirst({
      where: { id: input.id, authorId: userId },
      select: { id: true },
    });
    if (!row) return { ok: false, error: "글을 찾을 수 없습니다." };
    await prisma.feed.update({
      where: { id: input.id },
      data: { title: input.title, content: input.content },
    });
    await setFeedTags(input.id, parseTags(input.tags ?? ""));
    return { ok: true, value: { id: input.id } };
  }
  if ((await countMyDrafts(userId)) >= DRAFT_LIMIT) {
    return {
      ok: false,
      error: `임시저장은 최대 ${DRAFT_LIMIT}개까지 가능합니다. 기존 임시저장을 게시하거나 삭제해 주세요.`,
    };
  }
  const feed = await prisma.feed.create({
    data: {
      slug: genSlug(input.title),
      title: input.title,
      content: input.content,
      visibility: "members",
      status: "draft",
      authorId: userId,
    },
  });
  await setFeedTags(feed.id, parseTags(input.tags ?? ""));
  return { ok: true, value: { id: feed.id } };
}

// 게시(회원공개). id 있고 이미 published면 단순 수정(하루 제한 미적용),
// draft→published거나 신규면 하루 게시 제한 검사 + publishedAt 기록.
export async function publishPost(
  userId: string,
  input: Input & { id?: string },
): Promise<Result<{ slug: string }>> {
  if (input.id) {
    const row = await prisma.feed.findFirst({
      where: { id: input.id, authorId: userId },
      select: { id: true, slug: true, status: true },
    });
    if (!row) return { ok: false, error: "글을 찾을 수 없습니다." };
    if (row.status === "published") {
      // 이미 게시된 글 수정.
      await prisma.feed.update({
        where: { id: row.id },
        data: { title: input.title, content: input.content },
      });
      await setFeedTags(row.id, parseTags(input.tags ?? ""));
      return { ok: true, value: { slug: row.slug } };
    }
    // 임시저장 → 게시.
    if ((await countPublishedToday(userId)) >= DAILY_PUBLISH_LIMIT) {
      return { ok: false, error: dailyLimitMessage() };
    }
    await prisma.feed.update({
      where: { id: row.id },
      data: {
        title: input.title,
        content: input.content,
        status: "published",
        publishedAt: new Date(),
      },
    });
    await setFeedTags(row.id, parseTags(input.tags ?? ""));
    return { ok: true, value: { slug: row.slug } };
  }
  // 신규 바로 게시.
  if ((await countPublishedToday(userId)) >= DAILY_PUBLISH_LIMIT) {
    return { ok: false, error: dailyLimitMessage() };
  }
  const feed = await prisma.feed.create({
    data: {
      slug: genSlug(input.title),
      title: input.title,
      content: input.content,
      visibility: "members",
      status: "published",
      authorId: userId,
      publishedAt: new Date(),
    },
  });
  await setFeedTags(feed.id, parseTags(input.tags ?? ""));
  return { ok: true, value: { slug: feed.slug } };
}

function dailyLimitMessage(): string {
  return `하루에 ${DAILY_PUBLISH_LIMIT}개까지만 게시할 수 있습니다. 내일 다시 시도해 주세요.`;
}

// 본인 글 삭제(draft·published 공용).
export async function deleteMyPost(
  userId: string,
  id: string,
): Promise<Result> {
  const row = await prisma.feed.findFirst({
    where: { id, authorId: userId },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "글을 찾을 수 없습니다." };
  await prisma.feed.delete({ where: { id } });
  return { ok: true, value: undefined };
}
