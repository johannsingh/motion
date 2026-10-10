import {
  type AppData,
  type Entry,
  type Goal,
  type Habit,
  dayInZone,
  makeHabits,
  periodBounds,
  shiftDay,
} from "./domain";
export function applyDemo(
  data: AppData,
  action: string,
  payload: Record<string, any>,
): AppData {
  const d = structuredClone(data);
  const uid = d.profile.id;
  const stamp = new Date().toISOString();
  const today = dayInZone(new Date(), d.profile.timezone);
  switch (action) {
    case "log": {
      const i = d.entries.findIndex(
        (e) =>
          e.habit_id === payload.habit_id &&
          e.day === payload.day &&
          e.source_key === "manual",
      );
      const row = {
        ...payload,
        id: i >= 0 ? d.entries[i].id : crypto.randomUUID(),
        user_id: uid,
        source_key: "manual",
        created_at: stamp,
      } as Entry;
      if (i >= 0) d.entries[i] = row;
      else d.entries.push(row);
      break;
    }
    case "clear_log":
      d.entries = d.entries.filter(
        (e) =>
          !(
            e.habit_id === payload.habit_id &&
            e.day === payload.day &&
            e.source_key === "manual"
          ),
      );
      break;
    case "habit_create":
      d.habits.push({
        ...payload.habit,
        id: crypto.randomUUID(),
        user_id: uid,
        archived: false,
        created_at: stamp,
        versions: [
          {
            effective_on: periodBounds(today, payload.habit.period)[0],
            target: payload.habit.target,
          },
        ],
      } as Habit);
      break;
    case "habit_update":
      d.habits = d.habits.map((h) => {
        if (h.id !== payload.id) return h;
        const effective = shiftDay(periodBounds(today, h.period)[1], 1);
        return {
          ...h,
          title: payload.habit.title,
          shared: payload.habit.shared,
          archived: payload.habit.archived,
          versions: [
            ...h.versions.filter((v) => v.effective_on !== effective),
            { effective_on: effective, target: payload.habit.target },
          ],
        };
      });
      break;
    case "goal_create":
      d.goals.push({
        ...payload.goal,
        id: crypto.randomUUID(),
        user_id: uid,
        created_at: stamp,
      } as Goal);
      break;
    case "goal_update":
      d.goals = d.goals.map((g) =>
        g.id === payload.id ? { ...g, ...payload.goal } : g,
      );
      break;
    case "goal_delete":
      d.goals = d.goals.filter((g) => g.id !== payload.id);
      break;
    case "profile":
      d.profile = { ...d.profile, ...payload };
      break;
    case "onboard":
      d.profile = { ...d.profile, ...payload, onboarded: true };
      d.habits = makeHabits(uid, today, payload.indices);
      break;
    case "message":
      d.messages.unshift({
        id: crypto.randomUUID(),
        user_id: uid,
        pair_id: d.pairId!,
        body: payload.body,
        created_at: stamp,
      });
      break;
    case "review":
      d.reviews = d.reviews.filter((r) => r.week !== payload.week);
      d.reviews.unshift({
        ...payload,
        id: crypto.randomUUID(),
        user_id: uid,
        created_at: stamp,
      } as AppData["reviews"][number]);
      break;
    case "leave":
      d.friend = null;
      d.friendHabits = [];
      d.friendEntries = [];
      d.friendGoals = [];
      d.messages = [];
      d.pairId = null;
      break;
  }
  return d;
}
