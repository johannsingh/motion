import { describe, it, expect } from "vitest";
import {
  makeHabits,
  periodBounds,
  dayInZone,
  progress,
  dailyValue,
  type Entry,
} from "../lib/domain";
import { applyDemo } from "../lib/demo";
import { demoData } from "../lib/domain";
import { activityEntry } from "../lib/whoop-data";
const habits = makeHabits("u", "2026-09-27");
const row = (
  value: number,
  source_key = "manual",
  day = "2026-09-27",
): Entry => ({
  id: crypto.randomUUID(),
  user_id: "u",
  habit_id: habits[0].id,
  day,
  value,
  source_key,
  created_at: "",
});
describe("accountability calculations", () => {
  it("uses Monday weeks and real month ends, including leap years", () => {
    expect(periodBounds("2026-09-27", "weekly")).toEqual([
      "2026-09-21",
      "2026-09-27",
    ]);
    expect(periodBounds("2024-02-12", "monthly")).toEqual([
      "2024-02-01",
      "2024-02-29",
    ]);
  });
  it("assigns local dates across midnight and daylight saving", () => {
    expect(dayInZone(new Date("2026-09-26T23:30:00Z"), "Europe/London")).toBe(
      "2026-09-27",
    );
    expect(dayInZone(new Date("2026-10-25T23:30:00Z"), "Europe/London")).toBe(
      "2026-10-25",
    );
  });
  it("manual zero overrides imports, and removing it restores them", () => {
    const imported = [row(1, "whoop:1"), row(1, "whoop:2")];
    expect(dailyValue([...imported, row(0)], habits[0].id, "2026-09-27")).toBe(
      0,
    );
    expect(dailyValue(imported, habits[0].id, "2026-09-27")).toBe(2);
  });
  it("does not treat a missing limit log as success", () => {
    const h = {
      ...habits[0],
      kind: "maximum" as const,
      target: 20,
      versions: [],
      period: "daily" as const,
    };
    expect(progress(h, [], "2026-09-27").complete).toBe(false);
    expect(progress(h, [row(0)], "2026-09-27").complete).toBe(true);
    expect(progress(h, [row(21)], "2026-09-27").complete).toBe(false);
  });
  it("keeps prior targets when next week changes", () => {
    const h = {
      ...habits[0],
      versions: [
        { effective_on: "2026-09-21", target: 3 },
        { effective_on: "2026-09-28", target: 4 },
      ],
    };
    expect(progress(h, [row(3)], "2026-09-27").complete).toBe(true);
    expect(
      progress(h, [row(3, "manual", "2026-09-28")], "2026-09-28").complete,
    ).toBe(false);
  });
  it("updates a check-in rather than counting retries twice", () => {
    const d = demoData(),
      payload = { habit_id: d.habits[0].id, day: "2026-09-27", value: 2 };
    const x = applyDemo(applyDemo(d, "log", payload), "log", payload);
    expect(
      x.entries.filter(
        (e) => e.habit_id === payload.habit_id && e.day === payload.day,
      ),
    ).toHaveLength(1);
  });
});
describe("WHOOP mapping", () => {
  it("imports actual sleep on wake-up day, excludes naps and unscored sleep", () => {
    const a = {
      id: "s",
      start: "2026-09-26T22:00Z",
      end: "2026-09-27T06:00Z",
      score_state: "SCORED",
      nap: false,
      score: {
        stage_summary: {
          total_light_sleep_time_milli: 14400000,
          total_slow_wave_sleep_time_milli: 7200000,
          total_rem_sleep_time_milli: 3600000,
        },
      },
    };
    expect(activityEntry(a, habits[2], "Europe/London")).toMatchObject({
      day: "2026-09-27",
      value: 7,
    });
    expect(activityEntry({ ...a, nap: true }, habits[2], "UTC")).toBeNull();
    expect(
      activityEntry({ ...a, score_state: "PENDING_SCORE" }, habits[2], "UTC"),
    ).toBeNull();
  });
  it("maps only relevant workouts to gym and run habits", () => {
    const a = {
      id: "w",
      start: "2026-09-27T10:00Z",
      end: "2026-09-27T11:00Z",
      sport_name: "running",
    };
    expect(activityEntry(a, habits[1], "UTC")?.value).toBe(1);
    expect(activityEntry(a, habits[0], "UTC")).toBeNull();
    expect(
      activityEntry({ ...a, sport_name: "weightlifting" }, habits[0], "UTC")
        ?.value,
    ).toBe(1);
  });
});
