import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { kstStartOfTodayUtc } from "@/lib/kst";
import { parseTags, setFeedTags } from "@/lib/tags";
import { bodyChanged } from "@/lib/feed-dates";
import { FEED_LATEST_ORDER } from "@/lib/feeds";
import type { ValueResult } from "@/lib/result";

// 회원 글 가드.
export const DRAFT_LIMIT = 3; // 회원당 동시 임시저장 최대 개수
export const DAILY_PUBLISH_LIMIT = 5; // 회원당 하루 게시 개수

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
    orderBy: FEED_LATEST_ORDER,
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
    orderBy: FEED_LATEST_ORDER,
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

const NOT_FOUND = "글을 찾을 수 없습니다.";

// 본인 글 1건(남의 글·없는 id는 null — 존재 여부를 구분해 드러내지 않음).
function findOwnPost(userId: string, id: string) {
  return prisma.feed.findFirst({
    where: { id, authorId: userId },
    select: { id: true, slug: true, status: true, title: true, content: true },
  });
}

// 태그 입력(콤마 구분 원본)으로 글의 태그를 통째로 교체.
function replaceTags(feedId: string, raw?: string) {
  return setFeedTags(feedId, parseTags(raw ?? ""));
}

// 새로 게시(임시저장 → 게시 포함)할 때만 적용하는 하루 게시 제한. 초과면 안내 문구, 아니면 null.
async function dailyQuotaError(userId: string): Promise<string | null> {
  return (await countPublishedToday(userId)) >= DAILY_PUBLISH_LIMIT
    ? `하루에 ${DAILY_PUBLISH_LIMIT}개까지만 게시할 수 있습니다. 내일 다시 시도해 주세요.`
    : null;
}

// 회원 글 신규 생성(회원공개 고정, slug 자동). 게시면 publishedAt 기록.
async function createMemberFeed(
  userId: string,
  input: Input,
  status: "draft" | "published",
) {
  const feed = await prisma.feed.create({
    data: {
      slug: genSlug(input.title),
      title: input.title,
      content: input.content,
      visibility: "members",
      status,
      authorId: userId,
      ...(status === "published" && { publishedAt: new Date() }),
    },
  });
  await replaceTags(feed.id, input.tags);
  return feed;
}

// 임시저장 저장: id 있으면 본인 draft 갱신, 없으면 신규(한도 검사).
export async function saveDraft(
  userId: string,
  input: Input & { id?: string },
): Promise<ValueResult<{ id: string }>> {
  if (input.id) {
    const row = await findOwnPost(userId, input.id);
    if (!row) return { ok: false, error: NOT_FOUND };
    await prisma.feed.update({
      where: { id: row.id },
      data: { title: input.title, content: input.content },
    });
    await replaceTags(row.id, input.tags);
    return { ok: true, value: { id: row.id } };
  }
  if ((await countMyDrafts(userId)) >= DRAFT_LIMIT) {
    return {
      ok: false,
      error: `임시저장은 최대 ${DRAFT_LIMIT}개까지 가능합니다. 기존 임시저장을 게시하거나 삭제해 주세요.`,
    };
  }
  const feed = await createMemberFeed(userId, input, "draft");
  return { ok: true, value: { id: feed.id } };
}

// 게시(회원공개). 세 갈래:
// - 이미 게시된 글 수정: 하루 제한 미적용, 제목·본문이 실제로 바뀐 경우에만 수정 시각 기록(태그만 변경은 제외)
// - 임시저장 → 게시: 하루 제한 검사 + publishedAt 기록
// - 신규 바로 게시: 하루 제한 검사 + publishedAt 기록
export async function publishPost(
  userId: string,
  input: Input & { id?: string },
): Promise<ValueResult<{ slug: string }>> {
  if (!input.id) {
    const quota = await dailyQuotaError(userId);
    if (quota) return { ok: false, error: quota };
    const feed = await createMemberFeed(userId, input, "published");
    return { ok: true, value: { slug: feed.slug } };
  }
  const row = await findOwnPost(userId, input.id);
  if (!row) return { ok: false, error: NOT_FOUND };
  const next = { title: input.title, content: input.content };
  if (row.status === "published") {
    await prisma.feed.update({
      where: { id: row.id },
      data: bodyChanged(row, next) ? { ...next, editedAt: new Date() } : next,
    });
  } else {
    const quota = await dailyQuotaError(userId);
    if (quota) return { ok: false, error: quota };
    await prisma.feed.update({
      where: { id: row.id },
      data: { ...next, status: "published", publishedAt: new Date() },
    });
  }
  await replaceTags(row.id, input.tags);
  return { ok: true, value: { slug: row.slug } };
}

// 본인 글 삭제(draft·published 공용).
export async function deleteMyPost(
  userId: string,
  id: string,
): Promise<ValueResult<undefined>> {
  const row = await findOwnPost(userId, id);
  if (!row) return { ok: false, error: NOT_FOUND };
  await prisma.feed.delete({ where: { id: row.id } });
  return { ok: true, value: undefined };
}
