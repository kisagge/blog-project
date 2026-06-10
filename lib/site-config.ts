import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/dal";

const SINGLETON_ID = 1;

// 공개 사이트 접근 허용 여부. 설정 row가 없으면 기본 허용(true).
export const getPublicEnabled = cache(async () => {
  const config = await prisma.siteConfig.findUnique({
    where: { id: SINGLETON_ID },
    select: { publicEnabled: true },
  });
  return config?.publicEnabled ?? true;
});

// 어드민 토글용: 싱글톤 upsert.
export async function setPublicEnabled(enabled: boolean) {
  await prisma.siteConfig.upsert({
    where: { id: SINGLETON_ID },
    update: { publicEnabled: enabled },
    create: { id: SINGLETON_ID, publicEnabled: enabled },
  });
}

// 공개 페이지 가드: 점검 모드면서 어드민이 아니면 /maintenance로 보낸다.
export async function guardPublicAccess() {
  if (await getPublicEnabled()) return;
  const session = await getSession();
  if (session?.admin) return; // 어드민은 점검 중에도 정상 이용
  redirect("/maintenance");
}
