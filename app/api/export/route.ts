import { authenticated } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { db, user } = await authenticated();
    async function ownRows(table: string) {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db
          .from(table)
          .select("*")
          .eq("user_id", user.id)
          .order("id")
          .range(offset, offset + 999);
        if (error) throw Error("Export failed. Please retry.");
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    }
    const profile = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profile.error) throw Error("Could not load profile.");
    const tables = ["habits", "entries", "goals", "reviews", "messages"];
    const results = await Promise.all(tables.map(ownRows));
    return Response.json(
      {
        exported_at: new Date().toISOString(),
        profile: profile.data,
        ...Object.fromEntries(tables.map((t, i) => [t, results[i]])),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": 'attachment; filename="motion-my-data.json"',
        },
      },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 400 },
    );
  }
}
