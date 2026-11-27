import { prisma } from "@/lib/prisma";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { getPublicEnabled } from "@/lib/site-config";

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
  // 공개 판정에 필요한 필드만(본문 등 전체 행은 불필요).
  const [feed, open] = await Promise.all([
    prisma.feed.findUnique({
      where: { slug },
      select: { title: true, visibility: true, status: true, hiddenAt: true },
    }),
    getPublicEnabled(),
  ]);
  // 점검 중엔 페이지가 막혀 있으니 제목도 노출하지 않는다(기본 카드).
  const title =
    open &&
    feed &&
    feed.visibility === "public" &&
    feed.status === "published" &&
    !feed.hiddenAt
      ? feed.title
      : "BY Playground";
  return ogImage(title);
}
