import Link from "next/link";
import { notFound } from "next/navigation";
import { characterImageUrl, getCharacterInfo } from "@/lib/neople";
import {
  getFeaturedByCharacter,
  listFeaturedVisible,
} from "@/lib/df-characters";
import { getViewerRole, isBlockedMember } from "@/lib/dal";
import { checkAccess, type Visibility } from "@/lib/visibility";
import MemberGate from "@/app/member-gate";
import ViewTracker from "@/app/view-tracker";
import ShareBar from "@/app/share-bar";
import { absoluteUrl } from "@/lib/share";
import Tabs from "./tabs";
import { guardPublicAccess } from "@/lib/site-config";
import { loadCharacterDetail } from "./load";
import { characterTabs } from "./character-tabs";
import { Header } from "./sections/header";

// 캐릭터 레벨/직업/명성 요약(공유 description·og 공용).
function dfDescription(d: {
  level: number;
  jobGrowName: string;
  fame?: number;
}): string {
  const base = `Lv${d.level} · ${d.jobGrowName}`;
  return typeof d.fame === "number"
    ? `${base} · 명성 ${d.fame.toLocaleString()}`
    : base;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ server: string; characterId: string }>;
}) {
  // 점검 중엔 레이아웃 가드보다 먼저 메타데이터가 만들어져 리다이렉트 응답에 제목·OG가 실렸다 → 여기서도 가드.
  await guardPublicAccess();
  const { server, characterId } = await params;
  // 본문과 같은 게이트: 미등록·비공개(비관리자)는 이름·이미지를 <head>로 내보내지 않고,
  // 회원공개는 비회원(=크롤러)에게 이름 없이 noindex. 공개 캐릭터만 Neople 조회.
  const [featured, role] = await Promise.all([
    getFeaturedByCharacter(server, characterId).catch(() => null),
    getViewerRole(),
  ]);
  if (!featured) return { title: "찾을 수 없음" };
  const access = checkAccess(featured.visibility as Visibility, role);
  if (access === "not-found") return { title: "찾을 수 없음" };
  if (access === "members-only")
    return { title: "회원 전용 · 던파", robots: { index: false } };
  const info = await getCharacterInfo(server, characterId).catch(() => null);
  const title = info ? `${info.characterName} · 던파` : "캐릭터 상세 · 던파";
  const description = info ? dfDescription(info) : undefined;
  return {
    title,
    description,
    openGraph: {
      type: "profile",
      title,
      description,
      images: [characterImageUrl(server, characterId, 2)],
    },
  };
}

export default async function DfDetailPage({
  params,
}: {
  params: Promise<{ server: string; characterId: string }>;
}) {
  // 레이아웃 가드는 페이지 렌더를 막지 못한다(레이아웃·페이지 병렬 렌더 — 리다이렉트 응답에 본문이 실림) → 페이지에서도 가드.
  await guardPublicAccess();
  const { server, characterId } = await params;
  // 등록된 쇼케이스 캐릭터만 상세 노출 + 공개 범위 접근 제어.
  const [featured, role, blocked] = await Promise.all([
    getFeaturedByCharacter(server, characterId).catch(() => null),
    getViewerRole(),
    isBlockedMember(),
  ]);
  if (!featured) notFound();
  const access = checkAccess(featured.visibility as Visibility, role);
  if (access === "not-found") notFound(); // 비공개: 관리자 외 404
  if (access === "members-only") {
    const related = await listFeaturedVisible("anon");
    return (
      <MemberGate
        title="회원에게만 공개된 캐릭터입니다"
        related={related.map((c) => ({
          href: `/df/${c.serverId}/${c.characterId}`,
          label: c.characterName,
        }))}
        backHref="/df"
        backLabel="던파 캐릭터"
      />
    );
  }

  const detail = await loadCharacterDetail(server, characterId);
  const { status } = detail;
  const tabs = status ? characterTabs({ ...detail, status }) : [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link
        href="/df"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← 목록
      </Link>

      {featured && <ViewTracker type="df" id={featured.id} />}

      {!status ? (
        <p className="mt-8 text-sm text-zinc-500">
          캐릭터 정보를 불러오지 못했습니다.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-8">
          <Header
            status={status}
            server={server}
            characterId={characterId}
            viewCount={featured?.viewCount}
          />
          {/* 비공개(초안)는 404, 차단 회원은 공유 불가 — 공유 버튼 비노출. */}
          {featured?.visibility !== "private" && !blocked && (
            <ShareBar
              url={absoluteUrl(`/df/${server}/${characterId}`)}
              title={status.characterName}
              description={dfDescription(status)}
              kakaoKey={process.env.KAKAO_JS_KEY}
              imageUrl={characterImageUrl(server, characterId, 2)}
            />
          )}
          <Tabs tabs={tabs} label="캐릭터 정보" />
        </div>
      )}
    </main>
  );
}
