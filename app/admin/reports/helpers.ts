// 댓글은 해당 댓글로 딥링크(?c=), 글은 상세로.
export function targetHref(targetType: string, slug: string, targetId: string) {
  return targetType === "comment"
    ? `/feed/${slug}?c=${targetId}`
    : `/feed/${slug}`;
}
