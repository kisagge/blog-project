import Link from "next/link";
import { listFeatured } from "@/lib/df-characters";
import { getCharacterInfo, characterImageUrl } from "@/lib/neople";

export const metadata = { title: "던파 캐릭터" };

export default async function DfPage() {
  const featured = await listFeatured();
  // 각 캐릭터 기본정보를 병렬 조회. 실패해도 카드가 깨지지 않게 개별 처리.
  const cards = await Promise.all(
    featured.map(async (c) => {
      try {
        return { c, info: await getCharacterInfo(c.serverId, c.characterId) };
      } catch {
        return { c, info: null };
      }
    }),
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        던파 캐릭터
      </h1>

      {cards.length === 0 ? (
        <p className="text-sm text-zinc-500">아직 등록된 캐릭터가 없습니다.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map(({ c, info }) => (
            <li
              key={c.id}
              className="rounded-lg border border-black/[.08] dark:border-white/[.145]"
            >
              <Link
                href={`/df/${c.serverId}/${c.characterId}`}
                className="flex items-center gap-4 p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={characterImageUrl(c.serverId, c.characterId, 1)}
                  alt={c.characterName}
                  className="h-20 w-20 shrink-0 rounded bg-black/[.03] object-contain dark:bg-white/[.04]"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-semibold">
                    {info?.characterName ?? c.characterName}
                  </span>
                  {info ? (
                    <>
                      <span className="truncate text-sm text-zinc-500">
                        Lv{info.level} · {info.jobGrowName}
                      </span>
                      {typeof info.fame === "number" && (
                        <span className="text-sm text-amber-600 dark:text-amber-500">
                          명성 {info.fame.toLocaleString()}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-zinc-400">
                      정보를 불러오지 못했습니다
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
