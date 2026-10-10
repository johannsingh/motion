import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { authenticated, appUrl } from "@/lib/server";
import {
  exchangeToken,
  callbackUrl,
  whoopFetch,
  storeConnection,
  syncWhoop,
} from "@/lib/whoop";
export const maxDuration = 60;
export async function GET(request: Request) {
  const jar = await cookies();
  const saved = jar.get("motion-whoop-state");
  jar.delete({ name: "motion-whoop-state", path: "/api/whoop" });
  try {
    const { user } = await authenticated(),
      url = new URL(request.url),
      value = JSON.parse(saved?.value || "{}");
    if (
      !value.state ||
      value.state !== url.searchParams.get("state") ||
      value.uid !== user.id ||
      !url.searchParams.get("code")
    )
      throw Error("Invalid OAuth callback");
    const tokens = await exchangeToken({
      grant_type: "authorization_code",
      code: url.searchParams.get("code")!,
      redirect_uri: callbackUrl(),
    });
    const profile = await (
      await whoopFetch("/user/profile/basic", tokens.access_token)
    ).json();
    await storeConnection(user.id, tokens, profile.user_id);
    after(async () => {
      try {
        await syncWhoop(user.id);
      } catch {
        /* Connection stays saved; manual sync and cron retry. */
      }
    });
    return NextResponse.redirect(appUrl() + "/?whoop=connected");
  } catch {
    return NextResponse.redirect(appUrl() + "/?whoop=failed");
  }
}
