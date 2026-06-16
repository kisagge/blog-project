import { getFeedBySlug } from "@/lib/feeds";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "BY Playground";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-dynamic"; // 글 조회

// 글별 OG 이미지. 전체공개·게시 글만 제목 노출(회원공개·비공개·임시저장·없음은 기본 카드).
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feed = await getFeedBySlug(slug);
  const title =
    feed &&
    feed.visibility === "public" &&
    feed.status === "published" &&
    !feed.hiddenAt
      ? feed.title
      : "BY Playground";
  return ogImage(title);
}
