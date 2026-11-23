import { isoInstant, kstDate, kstDateTime } from "@/lib/kst";

// 시각 표시 공용: 기계용 dateTime(UTC ISO) + 사람용 KST 표기. withTime이면 날짜+시각.
export default function KstTime({
  value,
  withTime = false,
  className,
}: {
  value: Date | string | number;
  withTime?: boolean;
  className?: string;
}) {
  return (
    <time dateTime={isoInstant(value)} className={className}>
      {withTime ? kstDateTime(value) : kstDate(value)}
    </time>
  );
}
