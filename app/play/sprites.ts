// 유닛 플레이스홀더 스프라이트(코드 생성 텍스처). 실 스프라이트시트는 추후 public/games/srpg/로 교체.
// 색맹 안전: 진영=색 + 모양(아군 원 / 적 마름모), 클래스=글리프. 클라 전용(document·three).
import * as THREE from "three";
import type { Faction, UnitClass } from "@/lib/game/srpg/types";

const FACTION_COLOR: Record<Faction, string> = {
  dawn: "#3b82f6", // 여명단 — 푸른
  ashen: "#ef4444", // 잿더미단 — 적
};
const GLYPH: Record<UnitClass, string> = {
  warrior: "전",
  archer: "궁",
  mage: "법",
  cleric: "치",
};

const cache = new Map<string, THREE.CanvasTexture>();

export function unitTexture(
  faction: Faction,
  cls: UnitClass,
): THREE.CanvasTexture {
  const key = `${faction}:${cls}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const r = size * 0.42;

  // 진영 배경 도형
  ctx.fillStyle = FACTION_COLOR[faction];
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  if (faction === "dawn") {
    ctx.arc(c, c, r, 0, Math.PI * 2); // 아군 = 원
  } else {
    ctx.moveTo(c, c - r); // 적 = 마름모
    ctx.lineTo(c + r, c);
    ctx.lineTo(c, c + r);
    ctx.lineTo(c - r, c);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  // 클래스 글리프
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(GLYPH[cls], c, c + 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}
