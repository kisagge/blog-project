// 신고 사유 — 서버(reports.ts)·클라이언트(report-button) 공용이라 server-only 아님.
export type ReportReason = "spam" | "abuse" | "illegal" | "etc";
export type ReportTargetType = "comment" | "feed";

export const REPORT_REASONS: Record<ReportReason, string> = {
  spam: "스팸·광고",
  abuse: "욕설·혐오",
  illegal: "음란·불법",
  etc: "기타",
};

export const REPORT_REASON_ORDER: ReportReason[] = [
  "spam",
  "abuse",
  "illegal",
  "etc",
];
