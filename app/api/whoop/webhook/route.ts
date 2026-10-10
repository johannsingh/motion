import { z } from "zod";
import { adminClient } from "@/lib/server";
import { syncWhoop, validSignature } from "@/lib/whoop";
export const maxDuration = 60;
export async function POST(request: Request) {
  const raw = await request.text();
  if (
    raw.length > 20000 ||
    !validSignature(
      raw,
      request.headers.get("x-whoop-signature-timestamp"),
      request.headers.get("x-whoop-signature"),
    )
  )
    return new Response("Invalid signature", { status: 401 });
  let event;
  try {
    event = z
      .object({
        user_id: z.number().int(),
        id: z.string().uuid(),
        type: z.string(),
      })
      .parse(JSON.parse(raw));
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
  if (
    ![
      "sleep.updated",
      "sleep.deleted",
      "workout.updated",
      "workout.deleted",
    ].includes(event.type)
  )
    return Response.json({ ignored: true });
  try {
    const db = adminClient();
    const { data, error } = await db
      .from("provider_connections")
      .select("user_id")
      .eq("whoop_user_id", event.user_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ ignored: true });
    await syncWhoop(data.user_id, event);
    return Response.json({ ok: true });
  } catch {
    return new Response("Please retry", { status: 503 });
  }
}
