import { getTagBySlug } from "@/lib/tags";
import { countFeedsByTag } from "@/lib/feeds";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "BY Playground";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-dynamic"; // 태그/글 수 조회

// 태그별 OG 이미지(태그명 + 공개 글 수). 없는 태그·공개 글 0개는 기본 카드로 폴백
// (글 OG 폴백 + 태그 페이지의 비공개 전용 태그 은닉과 일관). 글 수는 공개(anon) 기준.
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug); // 디코딩·NFC/NFD 정규화 내장
  if (!tag) return ogImage("BY Playground");
  const count = await countFeedsByTag(tag.slug, "anon");
  if (count === 0) return ogImage("BY Playground");
  return ogImage(`#${tag.name}`, `BY Playground · 태그 ${count}편`);
}
