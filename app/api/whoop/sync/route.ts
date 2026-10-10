import { authenticated, sameOrigin } from "@/lib/server";
import { syncWhoop } from "@/lib/whoop";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await authenticated();
    return Response.json(await syncWhoop(user.id));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 400 },
    );
  }
}
