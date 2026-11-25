import { characterImageUrl, type DfStatusResponse } from "@/lib/neople";

// 캐릭터 머리말: 이미지 + 이름(h1) + 레벨·직업·모험단·길드·명성·조회수.
export function Header({
  status,
  server,
  characterId,
  viewCount,
}: {
  status: DfStatusResponse;
  server: string;
  characterId: string;
  viewCount?: number;
}) {
  return (
    <div className="flex items-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={characterImageUrl(server, characterId, 2)}
        alt={status.characterName}
        className="h-28 w-28 shrink-0 rounded bg-black/[.03] object-contain dark:bg-white/[.04]"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {status.characterName}
        </h1>
        <p className="text-sm text-zinc-500">
          Lv{status.level} · {status.jobGrowName}
        </p>
        <p className="text-sm text-zinc-500">
          {status.adventureName && <>모험단 {status.adventureName}</>}
          {status.guildName && <> · 길드 {status.guildName}</>}
        </p>
        {typeof status.fame === "number" && (
          <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
            명성 {status.fame.toLocaleString()}
          </p>
        )}
        {typeof viewCount === "number" && (
          <p className="text-sm text-zinc-500">
            조회 {viewCount.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
