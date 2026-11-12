import "server-only";
import { prisma } from "@/lib/prisma";
import { bodyChanged } from "@/lib/feed-dates";

// 관리자 글 수정 이력. 본문 변경 저장 직전 버전을 스냅샷으로 남기고, 글당 최근 N개만 보존한다.

export const REVISION_LIMIT = 20;

type Body = { title: string; summary: string | null; content: string };
// prisma 또는 트랜잭션 클라이언트(저장과 같은 트랜잭션에서 스냅샷하도록).
type Db = Pick<typeof prisma, "feedRevision">;

// 이전 버전을 스냅샷하고 오래된 것부터 REVISION_LIMIT 초과분을 정리.
// 같은 밀리초에 여러 건이 생기면 createdAt이 같아 정렬·정리 대상이 무작위가 되므로(방금 저장한 것이
// 정리될 수도 있음), 글별로 직전 이력보다 엄격히 늦은 시각(+1ms)을 부여해 순서를 결정적으로 만든다.
export async function snapshotRevision(db: Db, feedId: string, prev: Body) {
  const latest = await db.feedRevision.findFirst({
    where: { feedId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const now = new Date();
  const createdAt =
    latest && latest.createdAt >= now
      ? new Date(latest.createdAt.getTime() + 1)
      : now;
  await db.feedRevision.create({
    data: {
      feedId,
      title: prev.title,
      summary: prev.summary,
      content: prev.content,
      createdAt,
    },
  });
  const stale = await db.feedRevision.findMany({
    where: { feedId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: REVISION_LIMIT,
    select: { id: true },
  });
  if (stale.length) {
    await db.feedRevision.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } },
    });
  }
}

export async function countRevisions(feedId: string) {
  return prisma.feedRevision.count({ where: { feedId } });
}

// 최신순 목록(본문은 길이만 — 목록에서 본문 전체를 싣지 않음).
export async function listRevisions(feedId: string) {
  const rows = await prisma.feedRevision.findMany({
    where: { feedId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, title: true, content: true, createdAt: true },
  });
  return rows.map(({ content, ...r }) => ({ ...r, length: content.length }));
}

export async function getRevision(id: string) {
  return prisma.feedRevision.findUnique({ where: { id } });
}

export type RestoreResult =
  | { ok: true; feedId: string; title: string; changed: boolean }
  | { ok: false; error: string };

// 리비전으로 되돌리기. 현재 버전을 먼저 스냅샷해(되돌리기도 되돌릴 수 있게) 같은 트랜잭션에서 교체.
// 게시 글이면 수정일(editedAt)도 갱신. 이미 같은 내용이면 아무것도 하지 않음.
export async function restoreRevision(
  revisionId: string,
): Promise<RestoreResult> {
  return prisma.$transaction(async (tx) => {
    const rev = await tx.feedRevision.findUnique({ where: { id: revisionId } });
    if (!rev) return { ok: false, error: "이력을 찾을 수 없습니다." };
    const feed = await tx.feed.findUnique({
      where: { id: rev.feedId },
      select: { status: true, title: true, summary: true, content: true },
    });
    if (!feed) return { ok: false, error: "글을 찾을 수 없습니다." };
    const next = {
      title: rev.title,
      summary: rev.summary,
      content: rev.content,
    };
    if (!bodyChanged(feed, next)) {
      return { ok: true, feedId: rev.feedId, title: rev.title, changed: false };
    }
    await snapshotRevision(tx, rev.feedId, feed);
    await tx.feed.update({
      where: { id: rev.feedId },
      data: {
        ...next,
        ...(feed.status === "published" ? { editedAt: new Date() } : {}),
      },
    });
    return { ok: true, feedId: rev.feedId, title: rev.title, changed: true };
  });
}
