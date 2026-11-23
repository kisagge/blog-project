import LinkTabs from "@/app/ui/link-tabs";

// 신고 관리 탭(대기 중 / 가려진 콘텐츠). active·카운트는 각 페이지에서 지정.
export default function ReportTabs({
  active,
  queueCount,
  hiddenCount,
}: {
  active: "queue" | "hidden";
  queueCount: number;
  hiddenCount: number;
}) {
  return (
    <LinkTabs
      label="신고 관리"
      className="mb-6"
      tabs={[
        {
          href: "/admin/reports",
          label: `대기 중 (${queueCount})`,
          active: active === "queue",
        },
        {
          href: "/admin/reports/hidden",
          label: `가려진 콘텐츠 (${hiddenCount})`,
          active: active === "hidden",
        },
      ]}
    />
  );
}
