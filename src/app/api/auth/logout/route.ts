import { NextResponse } from "next/server";
import { signOut } from "@/server/auth";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason") || undefined;
  await signOut(reason);
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason") || undefined;
  await signOut(reason);
  return NextResponse.redirect(new URL("/?updated=1", request.url));
}
