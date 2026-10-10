import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin } from "@/lib/server";
import { loadData } from "@/lib/load";
import { dayInZone, shiftDay, periodBounds, makeHabits } from "@/lib/domain";
export const dynamic = "force-dynamic";
const category = z.enum([
  "Fitness",
  "Health",
  "Routine",
  "Career",
  "Net worth",
]);
const uuid = z.string().uuid();
const date = z.iso.date();
const habitInput = z.object({
  title: z.string().trim().min(1).max(100),
  category,
  period: z.enum(["daily", "weekly", "monthly"]),
  kind: z.enum(["minimum", "maximum", "boolean"]),
  target: z.number().positive().max(1e9),
  unit: z.string().trim().min(1).max(30),
  icon: z.string().max(30).default("circle-check"),
  shared: z.boolean(),
  provider: z
    .enum(["manual", "whoop_sleep", "whoop_run", "whoop_gym"])
    .default("manual"),
});
const goalInput = z.object({
  title: z.string().trim().min(1).max(120),
  category,
  target: z.number().positive().max(1e9),
  value: z.number().nonnegative().max(1e9),
  unit: z.string().trim().min(1).max(30),
  due_date: date.nullable(),
  shared: z.boolean(),
  completed: z.boolean(),
  milestones: z
    .array(
      z.object({
        id: uuid,
        title: z.string().trim().min(1).max(120),
        done: z.boolean(),
      }),
    )
    .max(30),
});
export async function GET() {
  try {
    return NextResponse.json(await loadData(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load" },
      { status: 401 },
    );
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db, user } = await authenticated();
    const body = await request.json();
    const action = z.string().parse(body.action);
    let result: any;
    const profile = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profile.error) throw new Error("Workspace setup is incomplete.");
    const today = dayInZone(new Date(), profile.data.timezone);
    switch (action) {
      case "onboard": {
        const input = z
          .object({
            name: z.string().trim().min(1).max(60),
            colour: z.enum(["sunrise", "tide", "bloom"]),
            timezone: z.string().max(80),
            indices: z.array(z.number().int().min(0).max(12)).max(13),
          })
          .parse(body);
        new Intl.DateTimeFormat("en", { timeZone: input.timezone });
        const existing = await db
          .from("habits")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);
        if (existing.error) throw existing.error;
        if (!existing.data?.length) {
          const r = await db
            .from("habits")
            .insert(makeHabits(user.id, today, [...new Set(input.indices)]));
          if (r.error) throw r.error;
        }
        result = await db
          .from("profiles")
          .update({
            name: input.name,
            colour: input.colour,
            timezone: input.timezone,
            onboarded: true,
          })
          .eq("id", user.id);
        break;
      }
      case "profile": {
        const input = z
          .object({
            name: z.string().trim().min(1).max(60),
            colour: z.enum(["sunrise", "tide", "bloom"]),
            timezone: z.string().max(80),
          })
          .parse(body);
        new Intl.DateTimeFormat("en", { timeZone: input.timezone });
        result = await db.from("profiles").update(input).eq("id", user.id);
        break;
      }
      case "log": {
        const input = z
          .object({
            habit_id: uuid,
            day: date,
            value: z.number().nonnegative().max(1e9),
          })
          .parse(body);
        if (input.day > today || input.day < shiftDay(today, -365))
          throw new Error("Choose a date within the past year.");
        const h = await db
          .from("habits")
          .select("*")
          .eq("id", input.habit_id)
          .eq("user_id", user.id)
          .single();
        if (h.error || !h.data) throw new Error("Habit not found.");
        if (h.data.kind === "boolean" && ![0, 1].includes(input.value))
          throw new Error("Choose done or missed.");
        result = await db
          .from("entries")
          .upsert(
            { ...input, user_id: user.id, source_key: "manual" },
            { onConflict: "habit_id,day,source_key" },
          );
        break;
      }
      case "clear_log": {
        const input = z.object({ habit_id: uuid, day: date }).parse(body);
        result = await db
          .from("entries")
          .delete()
          .eq("user_id", user.id)
          .eq("habit_id", input.habit_id)
          .eq("day", input.day)
          .eq("source_key", "manual");
        break;
      }
      case "habit_create": {
        const input = habitInput.parse(body.habit);
        result = await db
          .from("habits")
          .insert({
            ...input,
            user_id: user.id,
            archived: false,
            versions: [
              {
                effective_on: periodBounds(today, input.period)[0],
                target: input.target,
              },
            ],
          });
        break;
      }
      case "habit_update": {
        const id = uuid.parse(body.id);
        const input = z
          .object({
            title: z.string().trim().min(1).max(100),
            shared: z.boolean(),
            archived: z.boolean(),
            target: z.number().positive().max(1e9),
          })
          .parse(body.habit);
        const current = await db
          .from("habits")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .single();
        if (current.error) throw new Error("Habit not found.");
        const effective = shiftDay(
          periodBounds(today, current.data.period)[1],
          1,
        );
        const versions = [
          ...current.data.versions.filter(
            (v: { effective_on: string }) => v.effective_on !== effective,
          ),
          { effective_on: effective, target: input.target },
        ];
        result = await db
          .from("habits")
          .update({
            title: input.title,
            shared: input.shared,
            archived: input.archived,
            versions,
          })
          .eq("id", id)
          .eq("user_id", user.id);
        break;
      }
      case "goal_create": {
        result = await db
          .from("goals")
          .insert({ ...goalInput.parse(body.goal), user_id: user.id });
        break;
      }
      case "goal_update": {
        result = await db
          .from("goals")
          .update(goalInput.parse(body.goal))
          .eq("id", uuid.parse(body.id))
          .eq("user_id", user.id);
        break;
      }
      case "goal_delete": {
        result = await db
          .from("goals")
          .delete()
          .eq("id", uuid.parse(body.id))
          .eq("user_id", user.id);
        break;
      }
      case "invite": {
        result = await db.rpc("create_invite");
        if (result.error) throw new Error(result.error.message);
        return NextResponse.json({ invite: result.data });
      }
      case "join": {
        result = await db.rpc("accept_invite", {
          token: z
            .string()
            .regex(/^[a-f0-9]{48}$/)
            .parse(body.token),
        });
        break;
      }
      case "leave": {
        result = await db.rpc("leave_pair");
        break;
      }
      case "message": {
        const member = await db
          .from("memberships")
          .select("pair_id")
          .eq("user_id", user.id)
          .single();
        if (member.error) throw new Error("Invite your friend first.");
        result = await db
          .from("messages")
          .insert({
            user_id: user.id,
            pair_id: member.data.pair_id,
            body: z.string().trim().min(1).max(500).parse(body.body),
          });
        break;
      }
      case "review": {
        const input = z
          .object({
            week: date,
            win: z.string().max(2000),
            adjustment: z.string().max(2000),
          })
          .parse(body);
        result = await db
          .from("reviews")
          .upsert(
            { ...input, user_id: user.id },
            { onConflict: "user_id,week" },
          );
        break;
      }
      default:
        throw new Error("Unknown action.");
    }
    if (result?.error) throw new Error(result.error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Please check the fields and try again."
            : e instanceof Error
              ? e.message
              : "Could not save. Please retry.",
      },
      { status: 400 },
    );
  }
}
