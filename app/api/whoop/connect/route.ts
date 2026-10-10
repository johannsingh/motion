import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { authenticated, appUrl } from "@/lib/server";
import { whoopReady, callbackUrl } from "@/lib/whoop";
export async function GET() {
  try {
    const { user } = await authenticated();
    whoopReady();
    const state = randomBytes(32).toString("hex");
    (await cookies()).set(
      "motion-whoop-state",
      JSON.stringify({ state, uid: user.id }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/api/whoop",
      },
    );
    const url = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
    url.search = new URLSearchParams({
      client_id: process.env.WHOOP_CLIENT_ID!,
      redirect_uri: callbackUrl(),
      response_type: "code",
      scope: "offline read:profile read:sleep read:workout",
      state,
    }).toString();
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(appUrl() + "/?whoop=unavailable");
  }
}
