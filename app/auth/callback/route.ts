import { NextResponse } from "next/server";
import { appUrl, serverClient } from "@/lib/server";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(appUrl());
  }
  return NextResponse.redirect(appUrl() + "/?auth_error=1");
}
