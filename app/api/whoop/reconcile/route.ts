import { adminClient } from "@/lib/server";
import { syncWhoop } from "@/lib/whoop";
export const maxDuration = 120;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== "Bearer " + process.env.CRON_SECRET
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const { data, error } = await adminClient()
      .from("provider_connections")
      .select("user_id")
      .eq("needs_reconnect", false)
      .order("last_sync", { ascending: true, nullsFirst: true })
      .limit(2);
    if (error) throw error;
    let failed = 0;
    for (const connection of data) {
      try {
        await syncWhoop(connection.user_id);
      } catch {
        failed++;
      }
    }
    return Response.json(
      { processed: data.length, failed },
      { status: failed ? 503 : 200 },
    );
  } catch {
    return Response.json({ error: "Reconciliation failed" }, { status: 503 });
  }
}
