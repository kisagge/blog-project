"use client";
import { FIELD_ERROR, INPUT_CLASS } from "@/lib/ui";
import { useActionState, useEffect, useRef } from "react";
import type { FeedFormState } from "@/app/admin/feed-actions";
import { uploadImage } from "@/app/admin/upload-action";
import { ToastViewport, useToast } from "@/app/toast";
import DraftRestoreBanner from "@/app/draft-restore-banner";
import ScheduleField from "@/app/admin/schedule-field";
import { draftKey } from "@/lib/draft-store";
import { useDraft } from "@/app/ui/use-draft";
import { imageMarkdown, IMAGE_ALT_HINT } from "@/lib/textarea";
import type { Visibility } from "@/lib/visibility";
import FormField from "@/app/ui/form-field";
import { takeFile, useImageUpload } from "@/app/ui/use-image-upload";

type FeedDraft = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  visibility: string;
  tags: string;
};

type Props = {
  action: (state: FeedFormState, formData: FormData) => Promise<FeedFormState>;
  defaultValues?: {
    title?: string;
    slug?: string;
    summary?: string | null;
    content?: string;
    visibility?: Visibility;
    tags?: string;
    seriesId?: string | null;
  };
  seriesOptions?: { id: string; title: string }[];
  submitLabel: string;
  allowSchedule?: boolean; // 생성 폼에서만 예약 발행 노출(수정은 불가)
};

export default function FeedForm({
  action,
  defaultValues,
  seriesOptions = [],
  submitLabel,
  allowSchedule = false,
}: Props) {
  const [state, formAction, pending] = useActionState<FeedFormState, FormData>(
    action,
    undefined,
  );
  const d = defaultValues ?? {};
  // 입력 기본값: 실패 응답의 제출값이 있으면 그것으로(폼 초기화 후 입력 유지), 없으면 초기값.
  const v = { ...d, ...state?.values };
  const err = state?.errors ?? {};

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { uploading, uploadFile } = useImageUpload(uploadImage);
  const { toasts, show } = useToast();
  const key = draftKey("admin", d.slug ?? "new");

  const draft = useDraft<FeedDraft>(key, {
    title: d.title ?? "",
    slug: d.slug ?? "",
    summary: d.summary ?? "",
    content: d.content ?? "",
    visibility: d.visibility ?? "private",
    tags: d.tags ?? "",
  });

  // uncontrolled 폼의 현재 값을 초안 형태로 읽음(input·실패 복구 공용).
  function readForm(): FeedDraft | null {
    const f = formRef.current;
    if (!f) return null;
    const fd = new FormData(f);
    return {
      title: String(fd.get("title") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      summary: String(fd.get("summary") ?? ""),
      content: String(fd.get("content") ?? ""),
      visibility: String(fd.get("visibility") ?? ""),
      tags: String(fd.get("tags") ?? ""),
    };
  }

  // 제출 실패(검증 에러 반환) 시 제출할 때 지운 초안을 되살림.
  useEffect(() => {
    if (state?.errors || state?.error) draft.save(readForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // 비제어 폼이라 저장본을 각 입력의 value에 직접 넣음.
  function restore() {
    const f = formRef.current;
    const saved = draft.accept();
    if (f && saved) {
      for (const [name, val] of Object.entries(saved)) {
        const el = f.elements.namedItem(name);
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        )
          el.value = val;
      }
    }
  }

  // caret: 삽입 후 캐럿을 둘 text 안의 위치(기본 = 끝).
  function insertAtCursor(text: string, caret = text.length) {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    const pos = start + caret;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
    // .value 직접 변경은 input 이벤트가 안 나므로, 자동저장이 잡도록 수동 디스패치.
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = takeFile(e);
    if (!file) return;
    const res = await uploadFile(file);
    if ("error" in res) return show(res.error);
    const { text, caret } = imageMarkdown(res.url);
    insertAtCursor(text, caret); // 캐럿을 대체 텍스트 자리([ ] 안)로
    show(IMAGE_ALT_HINT, "success");
  }

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        onInput={() => draft.saveSoon(readForm)}
        onSubmit={draft.clear}
        className="flex flex-col gap-5"
      >
        {draft.restorable && (
          <DraftRestoreBanner onRestore={restore} onDismiss={draft.dismiss} />
        )}
        <FormField id="feed-title" label="제목" error={err.title}>
          {(control) => (
            <input
              {...control}
              name="title"
              defaultValue={v.title}
              className={INPUT_CLASS}
            />
          )}
        </FormField>
        <FormField
          id="feed-slug"
          label="slug (소문자·숫자·하이픈)"
          error={err.slug}
        >
          {(control) => (
            <input
              {...control}
              name="slug"
              defaultValue={v.slug}
              className={INPUT_CLASS}
            />
          )}
        </FormField>
        <FormField id="feed-summary" label="요약 (선택)" error={err.summary}>
          {(control) => (
            <input
              {...control}
              name="summary"
              defaultValue={v.summary ?? ""}
              className={INPUT_CLASS}
            />
          )}
        </FormField>
        <FormField
          id="feed-tags"
          label="태그 (쉼표로 구분, 최대 5개)"
          error={err.tags}
        >
          {(control) => (
            <input
              {...control}
              name="tags"
              defaultValue={v.tags ?? ""}
              placeholder="던파, 개발 후기"
              className={INPUT_CLASS}
            />
          )}
        </FormField>
        <FormField
          id="feed-content"
          label="본문 (마크다운)"
          error={err.content}
        >
          {(control) => (
            <>
              <textarea
                {...control}
                ref={contentRef}
                name="content"
                defaultValue={v.content}
                rows={12}
                className={INPUT_CLASS}
              />
              <div className="mt-2 flex items-center gap-3 text-sm">
                <label className="cursor-pointer rounded border border-black/15 px-2 py-1 dark:border-white/20">
                  이미지 첨부
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImage}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {uploading && <span className="text-zinc-500">업로드 중…</span>}
              </div>
            </>
          )}
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          공개 범위
          <select
            name="visibility"
            // select는 마운트 후 defaultValue 변경을 반영하지 않아, 값이 바뀌면 다시 마운트.
            key={`visibility-${v.visibility}`}
            defaultValue={v.visibility ?? "private"}
            className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
          >
            <option value="public">전체 공개</option>
            <option value="members">회원 공개</option>
            <option value="private">비공개(초안)</option>
          </select>
        </label>
        {seriesOptions.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            시리즈
            <select
              name="seriesId"
              key={`series-${v.seriesId}`}
              defaultValue={v.seriesId ?? ""}
              className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
            >
              <option value="">없음</option>
              {seriesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {allowSchedule && (
          <Fieldset label="예약 발행 (선택)" error={err.scheduledAt}>
            <ScheduleField />
          </Fieldset>
        )}
        {state?.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background w-fit rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "저장 중…" : submitLabel}
        </button>
      </form>
      <ToastViewport toasts={toasts} />
    </>
  );
}

// 여러 입력을 묶는 필드(예약 발행: 날짜·시각) — legend로 이름 붙임.
function Fieldset({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {children}
      {error && (
        <p role="alert" className={FIELD_ERROR}>
          {error.join(" ")}
        </p>
      )}
    </fieldset>
  );
}
