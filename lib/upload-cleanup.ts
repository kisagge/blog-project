import "server-only";
import { readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { uploadPath } from "@/lib/save-image";
import { DAY_MS } from "@/lib/kst";

// 고아 업로드 정리. 업로드했지만 글을 저장하지 않았거나(작성 취소), 본문에서 이미지를 지운 경우 파일이 남는다.
// 어떤 콘텐츠도 참조하지 않고 유예 기간이 지난 파일만 지운다 — 유예는 작성 중 초안(localStorage, 최대 7일)이
// 아직 저장 전에 참조하는 이미지를 지우지 않도록 넉넉하게.
export const ORPHAN_GRACE_DAYS = 30;

// 업로드 이름 형식(uuid.확장자). 이 형식이 아닌 파일(.gitkeep 등)은 건드리지 않는다.
const NAME_RE = /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/;
const REF_RE = /\/uploads\/([0-9a-f-]{36}\.(?:jpg|png|webp))/g;

// 업로드 URL이 들어갈 수 있는 모든 텍스트에서 참조 중인 파일 이름을 모은다.
// 수정 이력도 포함(되돌리기에 필요).
async function referencedNames(): Promise<Set<string>> {
  const [feeds, revisions, users, comments, series, site] = await Promise.all([
    prisma.feed.findMany({ select: { content: true, summary: true } }),
    prisma.feedRevision.findMany({ select: { content: true, summary: true } }),
    prisma.user.findMany({
      where: { avatarUrl: { not: null } },
      select: { avatarUrl: true },
    }),
    prisma.comment.findMany({
      where: { content: { contains: "/uploads/" } },
      select: { content: true },
    }),
    prisma.series.findMany({ select: { description: true } }),
    prisma.siteConfig.findMany({ select: { aboutContent: true } }),
  ]);
  const texts = [
    ...feeds.flatMap((f) => [f.content, f.summary]),
    ...revisions.flatMap((r) => [r.content, r.summary]),
    ...users.map((u) => u.avatarUrl),
    ...comments.map((c) => c.content),
    ...series.map((s) => s.description),
    ...site.map((s) => s.aboutContent),
  ];
  const names = new Set<string>();
  for (const t of texts)
    for (const m of t?.matchAll(REF_RE) ?? []) names.add(m[1]);
  return names;
}

export async function pruneOrphanUploads(
  now: Date = new Date(),
  dir: string = uploadPath(""),
): Promise<{ deleted: number }> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => NAME_RE.test(f));
  } catch {
    return { deleted: 0 }; // 업로드 폴더가 아직 없음
  }
  const referenced = await referencedNames();
  const cutoff = now.getTime() - ORPHAN_GRACE_DAYS * DAY_MS;
  let deleted = 0;
  for (const name of files) {
    if (referenced.has(name)) continue;
    const path = join(dir, name);
    if ((await stat(path)).mtimeMs >= cutoff) continue;
    await unlink(path);
    await prisma.upload.deleteMany({ where: { name } });
    deleted++;
  }
  return { deleted };
}
