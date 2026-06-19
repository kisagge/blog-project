"use client";
import { INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import { useActionState, useRef, useState } from "react";
import { updateProfileAction, type AccountState } from "./actions";
import { uploadAvatar } from "./avatar-action";
import Avatar from "@/app/avatar";

const inputCls = INPUT_CLASS;
const BIO_MAX = 160;

export default function AccountForm({
  email,
  nickname,
  bio,
  avatarUrl,
}: {
  email: string;
  nickname: string;
  bio: string;
  avatarUrl: string;
}) {
  const [state, action, pending] = useActionState<AccountState, FormData>(
    updateProfileAction,
    undefined,
  );
  const [nick, setNick] = useState(nickname);
  const [bioValue, setBioValue] = useState(bio);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    (nick.trim() !== nickname.trim() && nick.trim() !== "") ||
    bioValue.trim() !== bio.trim() ||
    avatar !== avatarUrl;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadAvatar(fd);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = ""; // 같은 파일 재선택 허용
    if ("error" in res) {
      setAvatarError(res.error);
      return;
    }
    setAvatar(res.url);
  }

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500">이메일</span>
        <input className={`${inputCls} opacity-60`} value={email} disabled />
      </label>

      {/* 아바타 */}
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-zinc-500">프로필 이미지</span>
        <div className="flex items-center gap-4">
          <Avatar src={avatar || null} nickname={nick} size={72} />
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPickFile}
              disabled={uploading}
              aria-label="프로필 이미지 업로드"
              className="text-xs file:mr-2 file:rounded-full file:border file:border-black/15 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:border-white/20"
            />
            {avatar && (
              <button
                type="button"
                onClick={() => setAvatar("")}
                className="self-start text-xs text-red-600 underline"
              >
                이미지 제거
              </button>
            )}
          </div>
        </div>
        {uploading && (
          <span role="status" className="text-xs text-zinc-500">
            업로드 중…
          </span>
        )}
        {avatarError && (
          <span role="alert" className="text-xs text-red-600">
            {avatarError}
          </span>
        )}
        <input type="hidden" name="avatarUrl" value={avatar} />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500">닉네임</span>
        <input
          name="nickname"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={20}
          aria-invalid={state?.errors?.nickname ? true : undefined}
          aria-describedby={
            state?.errors?.nickname ? "nickname-error" : undefined
          }
          className={inputCls}
        />
        {state?.errors?.nickname && (
          <span id="nickname-error" className="text-xs text-red-600">
            {state.errors.nickname[0]}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center justify-between text-zinc-500">
          자기소개
          <span className="text-xs">
            {bioValue.length}/{BIO_MAX}
          </span>
        </span>
        <textarea
          name="bio"
          value={bioValue}
          onChange={(e) => setBioValue(e.target.value)}
          maxLength={BIO_MAX}
          rows={3}
          placeholder="간단한 소개를 적어보세요."
          aria-invalid={state?.errors?.bio ? true : undefined}
          aria-describedby={state?.errors?.bio ? "bio-error" : undefined}
          className={`${inputCls} resize-y`}
        />
        {state?.errors?.bio && (
          <span id="bio-error" className="text-xs text-red-600">
            {state.errors.bio[0]}
          </span>
        )}
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.done && (
        <p role="status" className="text-sm text-green-600">
          프로필을 저장했습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || uploading || !dirty}
        className={PRIMARY_BTN}
      >
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
