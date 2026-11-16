import "server-only";
import { prisma } from "@/lib/prisma";
import {
  saveImage,
  deleteUpload,
  uploadNameFromUrl,
  type UploadResult,
} from "@/lib/save-image";

// 업로드 소유 기록. URL 형식만으론 누가 올렸는지 알 수 없어, 남의 업로드(다른 회원 아바타·
// 관리자 본문 이미지)를 아바타로 지정한 뒤 교체하면 그 파일이 지워졌다. 아바타 지정과 교체 시
// 삭제를 본인 기록과 일치할 때만 허용한다. ownerId null = 관리자 업로드.
export type UploadKind = "avatar" | "post" | "admin";

// 저장 + 소유 기록. 기록에 실패하면 방금 쓴 파일도 지워 고아 파일을 남기지 않는다.
export async function saveOwnedImage(
  file: unknown,
  ownerId: string | null,
  kind: UploadKind,
): Promise<UploadResult> {
  const res = await saveImage(file);
  if (!("url" in res)) return res;
  const name = uploadNameFromUrl(res.url)!;
  try {
    await prisma.upload.create({ data: { name, ownerId, kind } });
  } catch (e) {
    await deleteUpload(res.url);
    throw e;
  }
  return res;
}

export async function isOwnedUpload(
  url: string,
  ownerId: string | null,
  kind: UploadKind,
): Promise<boolean> {
  const name = uploadNameFromUrl(url);
  if (!name) return false;
  const row = await prisma.upload.findUnique({
    where: { name },
    select: { ownerId: true, kind: true },
  });
  return !!row && row.ownerId === ownerId && row.kind === kind;
}

// 아바타로 지정 가능한지: 본인이 아바타로 올린 파일, 또는 이미 지정돼 있던 현재 아바타
// (소유 기록 도입 전 파일 — 백필하지 않으므로 기록이 없다). 본문 이미지는 아바타 교체 시
// 지워지면 글이 깨지므로 허용하지 않는다.
export async function canUseAsAvatar(
  userId: string,
  url: string,
): Promise<boolean> {
  const name = uploadNameFromUrl(url);
  if (!name) return false;
  if (await isOwnedUpload(url, userId, "avatar")) return true;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  return !!u?.avatarUrl && uploadNameFromUrl(u.avatarUrl) === name;
}

// 본인 기록과 일치할 때만 기록·파일을 지운다. 기록 없는(소유 불명) 파일은 건드리지 않음 —
// 고아 파일 정리는 별도 작업으로.
export async function deleteOwnedUpload(
  url: string,
  ownerId: string | null,
  kind: UploadKind,
): Promise<boolean> {
  const name = uploadNameFromUrl(url);
  if (!name) return false;
  const { count } = await prisma.upload.deleteMany({
    where: { name, ownerId, kind },
  });
  if (count === 0) return false;
  await deleteUpload(url);
  return true;
}
