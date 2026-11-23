import LinkTabs from "@/app/ui/link-tabs";

const TABS = [
  { key: "info", href: "/account", label: "내 정보" },
  { key: "posts", href: "/account/posts", label: "내 글" },
  { key: "saved", href: "/account/saved", label: "저장한 글" },
] as const;

// 내 계정 영역 탭(내 정보 / 내 글 / 저장한 글). active는 각 페이지에서 지정.
// (알림 설정은 알림 센터의 톱니바퀴로 진입 — 별도 탭 없음.)
export default function AccountTabs({
  active,
}: {
  active: "info" | "posts" | "saved";
}) {
  return (
    <LinkTabs
      label="내 계정"
      tabs={TABS.map((t) => ({
        href: t.href,
        label: t.label,
        active: t.key === active,
      }))}
    />
  );
}
