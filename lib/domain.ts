export type Period = "daily" | "weekly" | "monthly";
export type Category =
  "Fitness" | "Health" | "Routine" | "Career" | "Net worth";
export type Habit = {
  id: string;
  user_id: string;
  title: string;
  category: Category;
  period: Period;
  kind: "minimum" | "maximum" | "boolean";
  target: number;
  unit: string;
  icon: string;
  shared: boolean;
  archived: boolean;
  provider: "manual" | "whoop_sleep" | "whoop_run" | "whoop_gym";
  versions: { effective_on: string; target: number }[];
  created_at: string;
};
export type Entry = {
  id: string;
  user_id: string;
  habit_id: string;
  day: string;
  value: number;
  source_key: string;
  created_at: string;
};
export type Goal = {
  id: string;
  user_id: string;
  title: string;
  category: Category;
  target: number;
  value: number;
  unit: string;
  due_date: string | null;
  shared: boolean;
  completed: boolean;
  milestones: { id: string; title: string; done: boolean }[];
  created_at: string;
};
export type Profile = {
  id: string;
  name: string;
  colour: string;
  timezone: string;
  onboarded: boolean;
};
export type Message = {
  id: string;
  user_id: string;
  pair_id: string;
  body: string;
  created_at: string;
};
export type Review = {
  id: string;
  user_id: string;
  week: string;
  win: string;
  adjustment: string;
  created_at: string;
};
export type AppData = {
  profile: Profile;
  habits: Habit[];
  entries: Entry[];
  goals: Goal[];
  friend: Profile | null;
  friendHabits: Habit[];
  friendEntries: Entry[];
  friendGoals: Goal[];
  messages: Message[];
  reviews: Review[];
  pairId: string | null;
  whoop: {
    connected: boolean;
    lastSync: string | null;
    needsReconnect: boolean;
  };
};
export function dayInZone(date: Date, timezone = "Europe/London") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function shiftDay(day: string, offset: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function periodBounds(day: string, period: Period): [string, string] {
  if (period === "daily") return [day, day];
  const d = new Date(day + "T12:00:00Z");
  if (period === "weekly") {
    const start = shiftDay(day, -((d.getUTCDay() + 6) % 7));
    return [start, shiftDay(start, 6)];
  }
  return [
    day.slice(0, 7) + "-01",
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12))
      .toISOString()
      .slice(0, 10),
  ];
}
export function targetOn(h: Habit, day: string) {
  const versions = h.versions
    .filter((v) => v.effective_on <= day)
    .sort((a, b) => b.effective_on.localeCompare(a.effective_on));
  return versions[0]?.target ?? h.target;
}
export function dailyValue(entries: Entry[], habitId: string, day: string) {
  const rows = entries.filter((e) => e.habit_id === habitId && e.day === day);
  const manual = rows.find((e) => e.source_key === "manual");
  return manual ? manual.value : rows.reduce((n, e) => n + e.value, 0);
}
export function progress(h: Habit, entries: Entry[], day: string) {
  const [start, end] = periodBounds(day, h.period);
  const relevant = entries.filter(
    (e) => e.habit_id === h.id && e.day >= start && e.day <= end,
  );
  const days = [...new Set(relevant.map((e) => e.day))];
  const value = days.reduce((sum, d) => sum + dailyValue(relevant, h.id, d), 0);
  const target = targetOn(h, start);
  const logged = relevant.length > 0;
  const complete =
    logged && (h.kind === "maximum" ? value <= target : value >= target);
  return {
    value,
    target,
    logged,
    complete,
    ratio: Math.min(1, target ? value / target : 0),
    start,
    end,
  };
}
export function displayNumber(n: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(n);
}
export const categories: Category[] = [
  "Fitness",
  "Health",
  "Routine",
  "Career",
  "Net worth",
];
export const colours = [
  { id: "sunrise", label: "Apricot & violet" },
  { id: "tide", label: "Aqua & indigo" },
  { id: "bloom", label: "Rose & butter" },
];
export const templateDefinitions: Omit<
  Habit,
  "id" | "user_id" | "created_at" | "versions"
>[] = [
  {
    title: "Gym",
    category: "Fitness",
    period: "weekly",
    kind: "minimum",
    target: 3,
    unit: "sessions",
    icon: "dumbbell",
    shared: true,
    archived: false,
    provider: "whoop_gym",
  },
  {
    title: "Running",
    category: "Fitness",
    period: "weekly",
    kind: "minimum",
    target: 3,
    unit: "runs",
    icon: "footprints",
    shared: true,
    archived: false,
    provider: "whoop_run",
  },
  {
    title: "Sleep",
    category: "Health",
    period: "daily",
    kind: "minimum",
    target: 7,
    unit: "hours",
    icon: "moon",
    shared: true,
    archived: false,
    provider: "whoop_sleep",
  },
  ...["Multivitamin", "Creatine", "Electrolyte", "Protein", "Skincare"].map(
    (title) => ({
      title,
      category: "Health" as Category,
      period: "daily" as Period,
      kind: "boolean" as const,
      target: 1,
      unit: "done",
      icon: "sun",
      shared: true,
      archived: false,
      provider: "manual" as const,
    }),
  ),
  {
    title: "Phone-free morning",
    category: "Routine",
    period: "daily",
    kind: "boolean",
    target: 1,
    unit: "done",
    icon: "smartphone",
    shared: true,
    archived: false,
    provider: "manual",
  },
  {
    title: "Read or journal",
    category: "Routine",
    period: "daily",
    kind: "minimum",
    target: 15,
    unit: "minutes",
    icon: "book-open",
    shared: true,
    archived: false,
    provider: "manual",
  },
  {
    title: "Doomscrolling",
    category: "Routine",
    period: "daily",
    kind: "maximum",
    target: 20,
    unit: "minutes",
    icon: "smartphone",
    shared: false,
    archived: false,
    provider: "manual",
  },
  {
    title: "AI practice",
    category: "Career",
    period: "daily",
    kind: "minimum",
    target: 30,
    unit: "minutes",
    icon: "laptop",
    shared: true,
    archived: false,
    provider: "manual",
  },
  {
    title: "Job strategy",
    category: "Career",
    period: "weekly",
    kind: "minimum",
    target: 60,
    unit: "minutes",
    icon: "briefcase",
    shared: true,
    archived: false,
    provider: "manual",
  },
];
export function makeHabits(
  userId: string,
  today: string,
  indices = templateDefinitions.map((_, i) => i),
): Habit[] {
  return indices.map((i) => ({
    ...templateDefinitions[i],
    id: crypto.randomUUID(),
    user_id: userId,
    versions: [
      {
        effective_on: periodBounds(today, templateDefinitions[i].period)[0],
        target: templateDefinitions[i].target,
      },
    ],
    created_at: new Date().toISOString(),
  }));
}
export function demoData(): AppData {
  const today = dayInZone(new Date());
  const profile = {
    id: "demo-alex",
    name: "Alex",
    colour: "sunrise",
    timezone: "Europe/London",
    onboarded: true,
  };
  const habits = makeHabits(profile.id, today);
  const friend = {
    ...profile,
    id: "demo-friend",
    name: "Your friend",
    colour: "tide",
  };
  const friendHabits = makeHabits(friend.id, today, [0, 1, 9, 11]);
  const entry = (h: Habit, value: number): Entry => ({
    id: crypto.randomUUID(),
    user_id: h.user_id,
    habit_id: h.id,
    day: today,
    value,
    source_key: "manual",
    created_at: new Date().toISOString(),
  });
  return {
    profile,
    habits,
    entries: [
      entry(habits[0], 2),
      entry(habits[1], 3),
      entry(habits[2], 7.4),
      entry(habits[3], 1),
      entry(habits[4], 1),
    ],
    goals: [
      {
        id: crypto.randomUUID(),
        user_id: profile.id,
        title: "Build an AI portfolio",
        category: "Career",
        target: 3,
        value: 1,
        unit: "projects",
        due_date: shiftDay(today, 60),
        shared: true,
        completed: false,
        milestones: [
          {
            id: crypto.randomUUID(),
            title: "Choose a problem worth solving",
            done: true,
          },
          {
            id: crypto.randomUUID(),
            title: "Ship one working prototype",
            done: false,
          },
          { id: crypto.randomUUID(), title: "Write a case study", done: false },
        ],
        created_at: new Date().toISOString(),
      },
    ],
    friend,
    friendHabits,
    friendEntries: [entry(friendHabits[0], 3), entry(friendHabits[2], 20)],
    friendGoals: [],
    messages: [],
    reviews: [],
    pairId: "demo-pair",
    whoop: { connected: false, lastSync: null, needsReconnect: false },
  };
}
