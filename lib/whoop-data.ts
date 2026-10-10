import { dayInZone, type Habit } from "./domain";
export type WhoopActivity = {
  id: string;
  start: string;
  end: string;
  nap?: boolean;
  sport_name?: string;
  score_state?: string;
  score?: {
    stage_summary?: {
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
    };
  };
};
export function activityEntry(
  activity: WhoopActivity,
  habit: Habit,
  timezone: string,
) {
  let value: number;
  if (habit.provider === "whoop_sleep") {
    if (
      activity.nap ||
      activity.score_state !== "SCORED" ||
      !activity.score?.stage_summary
    )
      return null;
    const s = activity.score.stage_summary;
    value =
      (s.total_light_sleep_time_milli +
        s.total_slow_wave_sleep_time_milli +
        s.total_rem_sleep_time_milli) /
      3600000;
  } else {
    const sport = activity.sport_name?.toLowerCase().replace(/[_-]/g, " ");
    const match =
      habit.provider === "whoop_run"
        ? ["running", "trail running"]
        : habit.provider === "whoop_gym"
          ? [
              "weightlifting",
              "strength trainer",
              "functional fitness",
              "powerlifting",
            ]
          : [];
    if (!sport || !match.includes(sport)) return null;
    value = 1;
  }
  if (!Number.isFinite(value) || value < 0) return null;
  return {
    habit_id: habit.id,
    day: dayInZone(
      new Date(
        habit.provider === "whoop_sleep" ? activity.end : activity.start,
      ),
      timezone,
    ),
    value,
    source_key: "whoop:" + activity.id,
  };
}
