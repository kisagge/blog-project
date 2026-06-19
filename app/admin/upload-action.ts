"use server";
import { verifySession } from "@/lib/dal";
import { saveImage, type UploadResult } from "@/lib/save-image";

export type { UploadResult };

export async function uploadImage(formData: FormData): Promise<UploadResult> {
  await verifySession();
  return saveImage(formData.get("file"));
}
