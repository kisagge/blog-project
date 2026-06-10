import { guardPublicAccess } from "@/lib/site-config";

// /feed 전체(목록·상세)의 공개 접근 가드. 레이아웃에서 처리해 (list)/loading.tsx의
// Suspense 경계보다 먼저 실행 → 점검 중 비어드민은 깔끔히 /maintenance로 리다이렉트.
export default async function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardPublicAccess();
  return children;
}
