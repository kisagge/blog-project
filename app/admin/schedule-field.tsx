"use client";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 관리자 글 작성(생성) 전용 예약 발행 필드. 선택값을 "YYYY-MM-DDTHH:MM"(KST 벽시계)로
// hidden input(name="scheduledAt")에 직렬화. 미체크/미선택이면 빈값(=즉시 게시).
export default function ScheduleField() {
  const [enabled, setEnabled] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const value = enabled && date && time ? `${fmtDate(date)}T${time}` : "";

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="scheduledAt" value={value} />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        예약 발행 (미설정 시 즉시 게시)
      </label>
      {enabled && (
        <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15">
          <DayPicker
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={{ before: today }}
            aria-label="예약 발행 날짜"
          />
          <label className="flex items-center gap-2">
            시간 (KST)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
            />
          </label>
          {value ? (
            <p className="text-zinc-500" aria-live="polite">
              예약: {fmtDate(date!)} {time} (KST)
            </p>
          ) : (
            <p role="alert" className="text-amber-600">
              날짜를 선택하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
