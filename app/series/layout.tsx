import { guardPublicAccess } from "@/lib/site-config";

// /series 전체의 공개 접근 가드(점검 중 비어드민은 /maintenance로).
export default async function SeriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardPublicAccess();
  return children;
}
