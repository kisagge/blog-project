import Link from "next/link";
import { getRogueLeaderboard } from "@/lib/rogue-score";

// 회원별 최고 점수 리더보드(서버 렌더). 점수 제출 후 router.refresh로 갱신.
export default async function Leaderboard({
  highlightUserId,
}: {
  highlightUserId?: string;
}) {
  const entries = await getRogueLeaderboard(20);

  return (
    <section
      aria-labelledby="leaderboard-heading"
      className="mt-10 border-t border-black/[.06] pt-6 dark:border-white/[.1]"
    >
      <h2 id="leaderboard-heading" className="text-lg font-semibold">
        리더보드
      </h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          아직 기록이 없습니다. 첫 도전자가 되어보세요.
        </p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">회원별 최고 점수 순위</caption>
          <thead>
            <tr className="text-left text-zinc-500">
              <th scope="col" className="py-1 pr-2 font-medium">
                순위
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                회원
              </th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">
                깊이
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                점수
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const me = e.userId === highlightUserId;
              return (
                <tr
                  key={e.userId}
                  className={
                    me
                      ? "bg-foreground/[.04] font-medium"
                      : "border-t border-black/[.04] dark:border-white/[.06]"
                  }
                >
                  <td className="py-1.5 pr-2 tabular-nums">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    <Link href={`/u/${e.userId}`} className="hover:underline">
                      {e.nickname}
                    </Link>
                    {me && (
                      <span className="ml-1 text-xs text-zinc-500">(나)</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {e.depth}층
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{e.score}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
