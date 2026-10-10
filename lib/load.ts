import { authenticated, adminClient } from "./server";
import { dayInZone, shiftDay, type AppData } from "./domain";
export async function loadData(): Promise<AppData> {
  const { db, user } = await authenticated();
  const { data: profile, error: pError } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (pError)
    throw new Error(
      "Your workspace is not ready. Apply the Motion database migration first.",
    );
  const since = shiftDay(dayInZone(new Date(), profile.timezone), -400);
  async function allEntries() {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const r = await db
        .from("entries")
        .select("*")
        .gte("day", since)
        .order("id")
        .range(offset, offset + 999);
      if (r.error) throw Error("Could not load your history.");
      rows.push(...r.data);
      if (r.data.length < 1000) break;
    }
    return { data: rows, error: null };
  }
  const queries = await Promise.all([
    db.from("habits").select("*").order("created_at"),
    allEntries(),
    db.from("goals").select("*").order("created_at"),
    db.from("memberships").select("*"),
    db
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("reviews")
      .select("*")
      .eq("user_id", user.id)
      .order("week", { ascending: false })
      .limit(12),
  ]);
  for (const result of queries)
    if (result.error)
      throw new Error("Could not load your workspace. Please retry.");
  const [habits, entries, goals, members, messages, reviews] = queries.map(
    (r) => r.data || [],
  );
  const peer = members.find((m) => m.user_id !== user.id);
  let friend = null;
  if (peer) {
    const r = await db
      .from("profiles")
      .select("*")
      .eq("id", peer.user_id)
      .single();
    friend = r.data;
  }
  let whoop = {
    connected: false,
    lastSync: null as string | null,
    needsReconnect: false,
  };
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const r = await adminClient()
      .from("provider_connections")
      .select("last_sync,needs_reconnect")
      .eq("user_id", user.id)
      .maybeSingle();
    if (r.error) throw new Error("Could not load your connection status.");
    if (r.data)
      whoop = {
        connected: true,
        lastSync: r.data.last_sync,
        needsReconnect: r.data.needs_reconnect,
      };
  }
  return {
    profile,
    habits: habits.filter((h) => h.user_id === user.id),
    entries: entries.filter((e) => e.user_id === user.id),
    goals: goals.filter((g) => g.user_id === user.id),
    friend,
    friendHabits: habits.filter((h) => h.user_id === peer?.user_id),
    friendEntries: entries.filter((e) => e.user_id === peer?.user_id),
    friendGoals: goals.filter((g) => g.user_id === peer?.user_id),
    messages,
    reviews,
    pairId: members.find((m) => m.user_id === user.id)?.pair_id ?? null,
    whoop,
  };
}
