import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/jwt";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const session = await decrypt(token);
  if (!session?.admin) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
