// 던파 서버 ID → 한글 이름(서버/클라이언트 공용 정적 매핑).
export const DF_SERVER_NAMES: Record<string, string> = {
  cain: "카인",
  diregie: "디레지에",
  siroco: "시로코",
  prey: "프레이",
  casillas: "카시야스",
  hilder: "힐더",
  anton: "안톤",
  bakal: "바칼",
};

export function serverName(id: string): string {
  return DF_SERVER_NAMES[id] ?? id;
}
