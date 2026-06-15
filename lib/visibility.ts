// 공개 범위(피드·던파 공용). 서버/클라이언트 공용 — server-only 아님.
export type Visibility = "public" | "members" | "private";

export const VISIBILITIES: Visibility[] = ["public", "members", "private"];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "전체 공개",
  members: "회원 공개",
  private: "비공개",
};

export type ViewerRole = "anon" | "member" | "admin";

// 공개 목록(피드/캐릭터 리스트)에 노출할 visibility.
// 관리자는 비공개(초안)도 목록에서 볼 수 있고, 그 외엔 비공개를 절대 노출하지 않는다.
export function listableVisibilities(role: ViewerRole): Visibility[] {
  if (role === "admin") return ["public", "members", "private"];
  return role === "anon" ? ["public"] : ["public", "members"];
}

// 단건 접근 판정.
export type Access = "ok" | "members-only" | "not-found";
export function checkAccess(visibility: Visibility, role: ViewerRole): Access {
  if (visibility === "public") return "ok";
  if (visibility === "members") return role === "anon" ? "members-only" : "ok";
  // private: 관리자만.
  return role === "admin" ? "ok" : "not-found";
}

export function isVisibility(v: unknown): v is Visibility {
  return v === "public" || v === "members" || v === "private";
}
