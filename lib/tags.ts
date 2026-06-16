import "server-only";
import { prisma } from "@/lib/prisma";

export const MAX_TAGS = 5; // 글당 최대 태그 수
export const MAX_TAG_LEN = 20; // 태그 1개 최대 길이

// 정규화 슬러그: trim → 소문자 → 내부 공백을 하이픈으로 → 연속/양끝 하이픈 정리.
// 한글 등 비ASCII는 보존(제거하지 않음).
export function slugifyTag(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 콤마 구분 입력 → 표시명 배열. slug 기준 중복 제거, 빈/초과길이 제외, 최대 MAX_TAGS개로 잘라냄.
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const name = part.trim();
    if (!name || name.length > MAX_TAG_LEN) continue;
    const slug = slugifyTag(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(name);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

// 한 글의 태그를 주어진 집합으로 교체. Tag는 slug로 upsert, FeedTag는 전량 삭제 후 재생성.
export async function setFeedTags(
  feedId: string,
  tagNames: string[],
): Promise<void> {
  const names = parseTags(tagNames.join(",")); // 방어적 재정규화
  await prisma.$transaction(async (tx) => {
    await tx.feedTag.deleteMany({ where: { feedId } });
    for (const name of names) {
      const tag = await tx.tag.upsert({
        where: { slug: slugifyTag(name) },
        create: { name, slug: slugifyTag(name) },
        update: {}, // 표시명은 최초 등록값 유지(경합 회피)
      });
      await tx.feedTag.create({ data: { feedId, tagId: tag.id } });
    }
  });
}
