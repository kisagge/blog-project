import { guardPublicAccess } from "@/lib/site-config";

// /archive 공개 접근 가드(점검 모드 시 비어드민은 /maintenance로). /feed·/series 레이아웃과 동일.
export default async function ArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardPublicAccess();
  return children;
}
