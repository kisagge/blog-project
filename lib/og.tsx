import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

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

export async function ogImage(
  title: string,
  subtitle = "BY Playground",
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
      <div style={{ fontSize: 26, color: "#64748b" }}>by-jang-blog.xyz</div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [{ name: "Pretendard", data: font, weight: 600, style: "normal" }],
    },
  );
}
