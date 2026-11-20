import { guardPublicAccess } from "@/lib/site-config";

// 점검 모드: 비어드민은 /maintenance로. 페이지·메타데이터도 각자 가드한다(레이아웃·페이지 병렬 렌더).
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardPublicAccess();
  return children;
}
