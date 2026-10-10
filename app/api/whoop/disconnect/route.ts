import { authenticated, sameOrigin } from "@/lib/server";
import { disconnectWhoop } from "@/lib/whoop";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await authenticated();
    await disconnectWhoop(user.id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not disconnect" },
      { status: 400 },
    );
  }
}
