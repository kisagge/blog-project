import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";
import { SITE_NAME, SITE_ORIGIN } from "@/lib/share";
import { createTtlCache } from "@/lib/ttl-cache";

const SITE_HOST = new URL(SITE_ORIGIN).host;

// 동적 OG 이미지 공용 렌더(1200x630, 한글 헤딩 Pretendard).
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// 폰트는 public/og/ 에 두어 Docker 이미지에 포함(Dockerfile이 public 복사). 1회 로드 캐시.
let fontPromise: Promise<Buffer> | null = null;
function loadFont(): Promise<Buffer> {
  if (!fontPromise) {
    fontPromise = readFile(
      join(process.cwd(), "public", "og", "Pretendard-SemiBold.otf"),
    );
  }
  return fontPromise;
}

// 렌더 결과(PNG) 캐시. 출력은 (제목, 부제)로만 정해지는데, 카카오·슬랙·X 크롤러가 공유될 때마다 와서
// 매번 satori+resvg로 다시 그리면 CPU·메모리 순간 부담이 크다. 제목이 바뀌면 키가 달라져 바로 새로 그림.
const pngCache = createTtlCache<ArrayBuffer>({ ttlMs: 6 * 3600_000, max: 100 });
const CACHE_SECONDS = 3600; // 크롤러·CDN 쪽 캐시(제목 수정이 최대 1시간 늦게 반영될 수 있음)

export async function ogImage(
  title: string,
  subtitle = SITE_NAME,
): Promise<Response> {
  const png = await pngCache.getOrSet(`${subtitle}\n${title}`, async () =>
    (await renderOg(title, subtitle)).arrayBuffer(),
  );
  return new Response(png, {
    headers: {
      "Content-Type": OG_CONTENT_TYPE,
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    },
  });
}

async function renderOg(
  title: string,
  subtitle: string,
): Promise<ImageResponse> {
  const font = await loadFont();
  const text = title.length > 70 ? `${title.slice(0, 70)}…` : title;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0F172A",
        color: "#ffffff",
        padding: "72px 80px",
        fontFamily: "Pretendard",
      }}
    >
      <div style={{ fontSize: 30, color: "#94a3b8" }}>{subtitle}</div>
      <div style={{ display: "flex", fontSize: 64, lineHeight: 1.25 }}>
        {text}
      </div>
      <div style={{ fontSize: 26, color: "#64748b" }}>{SITE_HOST}</div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [{ name: "Pretendard", data: font, weight: 600, style: "normal" }],
    },
  );
}
