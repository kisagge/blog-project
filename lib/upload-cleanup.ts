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
// 이 파일을 참조하는 텍스트가 하나라도 있는지(글 본문·요약, 수정 이력 — 되돌리기에 필요, 아바타, 댓글,
// 시리즈 설명, 소개). 후보 파일마다 SQL 한 번 — 모든 본문을 메모리에 올리지 않는다.
async function isReferenced(name: string): Promise<boolean> {
  const needle = `/uploads/${name}`;
  const [row] = await prisma.$queryRaw<{ ref: number | bigint }[]>`
    SELECT (
      EXISTS (SELECT 1 FROM "Feed" WHERE instr("content", ${needle}) > 0 OR instr(IFNULL("summary", ''), ${needle}) > 0)
      OR EXISTS (SELECT 1 FROM "FeedRevision" WHERE instr("content", ${needle}) > 0 OR instr(IFNULL("summary", ''), ${needle}) > 0)
      OR EXISTS (SELECT 1 FROM "User" WHERE instr(IFNULL("avatarUrl", ''), ${needle}) > 0)
      OR EXISTS (SELECT 1 FROM "Comment" WHERE instr("content", ${needle}) > 0)
      OR EXISTS (SELECT 1 FROM "Series" WHERE instr(IFNULL("description", ''), ${needle}) > 0)
      OR EXISTS (SELECT 1 FROM "SiteConfig" WHERE instr("aboutContent", ${needle}) > 0)
    ) AS ref`;
  return Number(row?.ref ?? 0) === 1;
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
  // 유예 기간이 지난 파일만 후보 → 후보가 없으면 DB를 보지 않는다.
  const cutoff = now.getTime() - ORPHAN_GRACE_DAYS * DAY_MS;
  let deleted = 0;
  for (const name of files) {
    const path = join(dir, name);
    if ((await stat(path)).mtimeMs >= cutoff) continue;
    if (await isReferenced(name)) continue;
    await unlink(path);
    await prisma.upload.deleteMany({ where: { name } });
    deleted++;
  }
  return { deleted };
}
