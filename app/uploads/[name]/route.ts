import { readFile } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "data/uploads";
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(join(UPLOAD_DIR, name));
    const ext = name.split(".").pop()!.toLowerCase();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=2592000",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
