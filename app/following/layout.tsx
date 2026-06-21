import { guardPublicAccess } from "@/lib/site-config";

// 점검 모드 가드(비어드민은 /maintenance로). 회원 가드는 page에서 처리.
export default async function FollowingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardPublicAccess();
  return children;
}
