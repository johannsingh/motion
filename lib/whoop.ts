import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { adminClient, appUrl } from "./server";
import { activityEntry, type WhoopActivity } from "./whoop-data";
import { dayInZone, shiftDay, type Habit } from "./domain";
const API = "https://api.prod.whoop.com/developer/v2";
type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};
function encryptionKey() {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw Error("WHOOP encryption is not configured.");
  return key;
}
export function seal(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function unseal(value: string): Tokens {
  const b = Buffer.from(value, "base64"),
    cipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      b.subarray(0, 12),
    );
  cipher.setAuthTag(b.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
}
export function whoopReady() {
  encryptionKey();
  if (!process.env.WHOOP_CLIENT_ID || !process.env.WHOOP_CLIENT_SECRET)
    throw Error("WHOOP is awaiting its developer app credentials.");
}
export async function exchangeToken(
  fields: Record<string, string>,
): Promise<Tokens> {
  whoopReady();
  const r = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...fields,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!r.ok)
    throw Error(
      r.status === 400 || r.status === 401
        ? "WHOOP authorization expired. Please reconnect."
        : "WHOOP is temporarily unavailable. Please retry.",
    );
  const t = await r.json();
  if (!t.access_token || !t.refresh_token || !t.expires_in)
    throw Error("WHOOP returned incomplete authorization.");
  return t;
}
export async function whoopFetch(path: string, token: string) {
  const r = await fetch(API + path, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw Error(
      r.status === 401
        ? "WHOOP authorization expired. Please reconnect."
        : "WHOOP request failed. Please retry.",
    );
  return r;
}
export async function storeConnection(
  uid: string,
  tokens: Tokens,
  whoopId: number,
) {
  const { error } = await adminClient()
    .from("provider_connections")
    .upsert({
      user_id: uid,
      whoop_user_id: whoopId,
      tokens: seal(tokens),
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      needs_reconnect: false,
    });
  if (error)
    throw Error(
      "Could not save WHOOP connection. This WHOOP account may already be linked.",
    );
}
export function callbackUrl() {
  return appUrl() + "/api/whoop/callback";
}
export function validSignature(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  now = Date.now(),
) {
  if (
    !timestamp ||
    !signature ||
    !process.env.WHOOP_CLIENT_SECRET ||
    Math.abs(now - Number(timestamp)) > 300000 ||
    !/^\d+$/.test(timestamp)
  )
    return false;
  const expected = createHmac("sha256", process.env.WHOOP_CLIENT_SECRET)
    .update(timestamp + raw)
    .digest();
  const given = Buffer.from(signature, "base64");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
async function withConnection<T>(
  uid: string,
  operation: (token: string) => Promise<T>,
) {
  const db = adminClient();
  const lock = await db.rpc("claim_whoop_sync", { uid });
  if (lock.error || !lock.data)
    throw Error("WHOOP is already syncing. Please retry shortly.");
  try {
    const { data: connection, error } = await db
      .from("provider_connections")
      .select("*")
      .eq("user_id", uid)
      .single();
    if (error || !connection) throw Error("Connect WHOOP first.");
    let tokens = unseal(connection.tokens);
    if (new Date(connection.expires_at).getTime() < Date.now() + 120000) {
      tokens = await exchangeToken({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      });
      await storeConnection(uid, tokens, connection.whoop_user_id);
    }
    return await operation(tokens.access_token);
  } catch (e) {
    if (e instanceof Error && e.message.includes("reconnect"))
      await db
        .from("provider_connections")
        .update({ needs_reconnect: true })
        .eq("user_id", uid);
    throw e;
  } finally {
    await db
      .from("provider_connections")
      .update({ lock_until: null })
      .eq("user_id", uid);
  }
}
export async function syncWhoop(
  uid: string,
  event?: { id: string; type: string },
) {
  return withConnection(uid, async (token) => {
    const db = adminClient();
    const [p, h] = await Promise.all([
      db.from("profiles").select("timezone").eq("id", uid).single(),
      db
        .from("habits")
        .select("*")
        .eq("user_id", uid)
        .eq("archived", false)
        .neq("provider", "manual"),
    ]);
    if (p.error || h.error)
      throw Error("Could not load your sync preferences.");
    const habits = h.data as Habit[],
      zone = p.data.timezone;
    let rows: ReturnType<typeof activityEntry>[] = [];
    let from: string | null = null,
      to: string | null = null,
      keys: string[] = [];
    if (event) {
      keys = ["whoop:" + event.id];
      if (event.type.endsWith(".updated")) {
        const kind = event.type.startsWith("sleep") ? "sleep" : "workout";
        const r = await whoopFetch("/activity/" + kind + "/" + event.id, token);
        const a = (await r.json()) as WhoopActivity;
        rows = habits
          .filter((h) =>
            kind === "sleep"
              ? h.provider === "whoop_sleep"
              : h.provider !== "whoop_sleep",
          )
          .map((h) => activityEntry(a, h, zone));
      }
    } else {
      const today = dayInZone(new Date(), zone);
      from = shiftDay(today, -28);
      to = today;
      const start = shiftDay(from, -3) + "T00:00:00Z",
        end = new Date().toISOString();
      for (const kind of ["sleep", "workout"]) {
        let next = "",
          pages = 0;
        do {
          const q = new URLSearchParams({
            limit: "25",
            start,
            end,
            ...(next ? { nextToken: next } : {}),
          });
          const response = await whoopFetch(
              "/activity/" + kind + "?" + q,
              token,
            ),
            page = await response.json();
          if (!Array.isArray(page.records))
            throw Error("WHOOP returned incomplete activity data.");
          for (const activity of page.records as WhoopActivity[])
            for (const habit of habits.filter((h) =>
              kind === "sleep"
                ? h.provider === "whoop_sleep"
                : h.provider !== "whoop_sleep",
            ))
              rows.push(activityEntry(activity, habit, zone));
          next = page.next_token || "";
          if (++pages >= 20 && next)
            throw Error(
              "WHOOP sync exceeded the page limit. No partial changes were saved.",
            );
        } while (next);
      }
    }
    const valid = rows.filter(
      (r): r is NonNullable<typeof r> =>
        r !== null && (!from || (r.day >= from && r.day <= to!)),
    );
    const saved = await db.rpc("apply_whoop_entries", {
      uid,
      rows: valid,
      from_day: from,
      to_day: to,
      source_keys: keys,
    });
    if (saved.error)
      throw Error("Could not save WHOOP activities. Please retry.");
    if (!event) {
      const result = await db
        .from("provider_connections")
        .update({ last_sync: new Date().toISOString(), needs_reconnect: false })
        .eq("user_id", uid);
      if (result.error) throw Error("Could not save sync status.");
    }
    return { imported: valid.length };
  });
}
export async function disconnectWhoop(uid: string) {
  return withConnection(uid, async (token) => {
    const r = await fetch(API + "/user/access", {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok && r.status !== 401)
      throw Error("WHOOP could not disconnect. Please retry.");
    const { error } = await adminClient()
      .from("provider_connections")
      .delete()
      .eq("user_id", uid);
    if (error) throw Error("Could not remove connection.");
  });
}
