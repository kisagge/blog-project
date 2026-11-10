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
  if (session?.role === "admin") return; // 어드민은 점검 중에도 정상 이용
  redirect("/maintenance");
}

// ── 소개 페이지(/about) — 관리자가 마크다운으로 편집. 본문이 비면 페이지·내비 링크를 숨긴다. ──

export type About = { content: string; updatedAt: Date | null };

// 편집기용 원본(비어 있어도 반환).
export async function readAboutRaw(): Promise<About> {
  const c = await prisma.siteConfig.findUnique({
    where: { id: SINGLETON_ID },
    select: { aboutContent: true, aboutUpdatedAt: true },
  });
  return {
    content: c?.aboutContent ?? "",
    updatedAt: c?.aboutUpdatedAt ?? null,
  };
}

// 공개 페이지용: 본문이 없으면 null. 같은 요청의 page·metadata가 공유하도록 cache.
export async function readAbout(): Promise<About | null> {
  const about = await readAboutRaw();
  return about.content ? about : null;
}
export const getAbout = cache(readAbout);

// 내비·sitemap·llms.txt용 존재 여부 — 본문을 읽지 않는 가벼운 조회(레이아웃에서 매 요청 실행).
export async function readHasAbout(): Promise<boolean> {
  const n = await prisma.siteConfig.count({
    where: { id: SINGLETON_ID, NOT: { aboutContent: "" } },
  });
  return n > 0;
}
export const hasAbout = cache(readHasAbout);

// 저장: 앞뒤 공백 제거 후 싱글톤 upsert. 비우면 갱신 시각도 null(페이지 비노출 상태).
export async function setAbout(content: string) {
  const aboutContent = content.trim();
  const aboutUpdatedAt = aboutContent ? new Date() : null;
  await prisma.siteConfig.upsert({
    where: { id: SINGLETON_ID },
    update: { aboutContent, aboutUpdatedAt },
    create: { id: SINGLETON_ID, aboutContent, aboutUpdatedAt },
  });
}
