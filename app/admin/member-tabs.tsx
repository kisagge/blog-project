import LinkTabs from "@/app/ui/link-tabs";

// 회원 관리 탭(가입 대기 / 회원). active·카운트는 각 페이지에서 지정.
export default function MemberTabs({
  active,
  pendingCount,
  memberCount,
}: {
  active: "pending" | "members";
  pendingCount: number;
  memberCount: number;
}) {
  return (
    <LinkTabs
      label="회원 관리"
      className="mb-6"
      tabs={[
        {
          href: "/admin/members/pending",
          label: `가입 대기 (${pendingCount})`,
          active: active === "pending",
        },
        {
          href: "/admin/members",
          label: `회원 (${memberCount})`,
          active: active === "members",
        },
      ]}
    />
  );
}
