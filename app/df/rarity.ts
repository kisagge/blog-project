// 던파 아이템 등급 → 텍스트 색상(대략적 매핑).
export function rarityColor(rarity?: string): string {
  switch (rarity) {
    case "태초":
      return "text-red-500";
    case "신화":
      return "text-rose-400";
    case "에픽":
      return "text-yellow-500";
    case "레전더리":
      return "text-orange-500";
    case "유니크":
      return "text-pink-500";
    case "크로니클":
      return "text-teal-500";
    case "레어":
      return "text-purple-500";
    case "언커먼":
      return "text-emerald-500";
    default:
      return "text-zinc-500";
  }
}
