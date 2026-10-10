"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  Heart,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Target,
  Users,
  X,
  Sparkles,
  CalendarDays,
  Link2,
  LockKeyhole,
  Pencil,
  CircleHelp,
  ClipboardCheck,
} from "lucide-react";
import { browserClient, configured } from "@/lib/supabase";
import {
  type AppData,
  type Habit,
  type Goal,
  type Entry,
  type Period,
  categories,
  colours,
  dayInZone,
  shiftDay,
  periodBounds,
  targetOn,
  progress,
  dailyValue,
  displayNumber,
  demoData,
  templateDefinitions,
} from "@/lib/domain";
import { applyDemo } from "@/lib/demo";
import { Icon, Modal, Empty, Wordmark } from "./ui";
type Tab = "today" | "together" | "goals" | "review" | "settings";
type Dialog =
  | { type: "log"; habit: Habit }
  | { type: "habit"; habit?: Habit }
  | { type: "goal"; goal?: Goal }
  | { type: "routine" }
  | { type: "invite" }
  | { type: "leave" }
  | null;
const essentials = [
  "Multivitamin",
  "Creatine",
  "Electrolyte",
  "Protein",
  "Skincare",
];
const blankGoal = {
  title: "",
  category: "Career" as Goal["category"],
  target: 1,
  value: 0,
  unit: "milestones",
  due_date: null,
  shared: true,
  completed: false,
  milestones: [],
};
const nav = [
  { id: "today", name: "Today", icon: CircleCheck },
  { id: "together", name: "Together", icon: Users },
  { id: "goals", name: "Goals", icon: Target },
  { id: "review", name: "Review", icon: ClipboardCheck },
  { id: "settings", name: "You", icon: Settings },
] as const;
export default function MotionApp() {
  const [data, setData] = useState<AppData | null>(null),
    [demo, setDemo] = useState(false),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState<Tab>("today"),
    [dialog, setDialog] = useState<Dialog>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [pulse, setPulse] = useState(0),
    [date, setDate] = useState(""),
    [period, setPeriod] = useState<Period>("daily"),
    [category, setCategory] = useState("All"),
    [authView, setAuthView] = useState(false),
    [invite, setInvite] = useState("");
  const mutationLock = useRef(false);
  const dataRef = useRef<AppData | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const flash = (message: string) => {
    setToast(message);
    setPulse((p) => p + 1);
  };
  const load = useCallback(async () => {
    const r = await fetch("/api/motion", { cache: "no-store" });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error);
    setData(json);
    return json as AppData;
  }, []);
  const startDemo = useCallback(() => {
    let d: AppData;
    try {
      const saved = localStorage.getItem("motion-demo-v1");
      d = saved ? JSON.parse(saved) : demoData();
      if (!d.profile || !d.habits) throw Error();
    } catch {
      d = demoData();
    }
    setData(d);
    setDemo(true);
    setAuthView(false);
    setLoading(false);
    setDate(dayInZone(new Date(), d.profile.timezone));
    setError("");
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("invite");
    if (code && /^[a-f0-9]{48}$/.test(code))
      sessionStorage.setItem("motion-invite", code);
    const pending = sessionStorage.getItem("motion-invite");
    if (pending) setInvite(pending);
    if (params.get("auth_error"))
      setError("That sign-in link could not be used. Please sign in again.");
    if (params.get("whoop")) {
      setToast(
        params.get("whoop") === "connected"
          ? "WHOOP connected. Your data is ready to sync."
          : "WHOOP could not connect. You can retry in You.",
      );
    }
    if (!configured()) {
      startDemo();
      return;
    }
    const client = browserClient();
    client.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setAuthView(true);
        setLoading(false);
        return;
      }
      try {
        const d = await load();
        setDate(dayInZone(new Date(), d.profile.timezone));
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      }
      setLoading(false);
    });
  }, [load, startDemo]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!data || demo) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && !mutationLock.current)
        load().catch(() => {});
    };
    const id = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [data?.profile.id, demo, load]);
  async function act(
    action: string,
    payload: Record<string, any> = {},
    message = "Saved",
  ) {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    try {
      if (demo) {
        const next = applyDemo(dataRef.current!, action, payload);
        localStorage.setItem("motion-demo-v1", JSON.stringify(next));
        dataRef.current = next;
        setData(next);
      } else {
        const r = await fetch("/api/motion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        if (action === "invite") {
          setInvite(json.invite);
        } else {
          await load();
        }
        if (action === "join") {
          sessionStorage.removeItem("motion-invite");
          setInvite("");
          history.replaceState(null, "", "/");
        }
      }
      flash(demo ? message + " · Demo" : message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please retry.",
      );
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  async function signout() {
    if (!demo) await browserClient().auth.signOut();
    setData(null);
    setDemo(false);
    setAuthView(true);
  }
  if (loading)
    return (
      <div className="loading">
        <Wordmark />
        <LoaderCircle className="spin" />
        <p>Finding your rhythm…</p>
      </div>
    );
  if (authView || (!data && !error))
    return (
      <AuthScreen
        onDemo={startDemo}
        onSignedIn={async () => {
          setDemo(false);
          setAuthView(false);
          const d = await load();
          setDate(dayInZone(new Date(), d.profile.timezone));
        }}
        error={error}
      />
    );
  if (!data)
    return (
      <div className="loading">
        <h1>Let’s reconnect</h1>
        <p role="alert">{error}</p>
        <button className="primary" onClick={() => location.reload()}>
          Retry
        </button>
        <button onClick={startDemo}>Explore the demo</button>
      </div>
    );
  if (!data.profile.onboarded)
    return (
      <Onboarding
        profile={data.profile}
        busy={busy}
        error={error}
        onSave={(p) => act("onboard", p, "Welcome to Motion")}
      />
    );
  const today = dayInZone(new Date(), data.profile.timezone);
  const selected = date || today;
  const active = data.habits.filter((h) => !h.archived);
  const daily = active.filter((h) => h.period === "daily");
  const complete = daily.filter(
    (h) => progress(h, data.entries, selected).complete,
  ).length;
  const routine = active.filter((h) => essentials.includes(h.title));
  const filtered = active.filter(
    (h) =>
      h.period === period &&
      (category === "All" || h.category === category) &&
      !(
        period === "daily" &&
        category === "All" &&
        essentials.includes(h.title)
      ),
  );
  const week = periodBounds(today, "weekly")[0];
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(selected + "T12:00:00Z"));
  async function connection(action: "sync" | "disconnect") {
    if (demo) {
      flash("WHOOP connects to a real account after sign-in.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/whoop/" + action, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      flash(action === "sync" ? "WHOOP is up to date" : "WHOOP disconnected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="motion-shell" data-palette={data.profile.colour}>
      <div className="ambient" aria-hidden>
        <Image src="/motion-field.png" alt="" fill sizes="100vw" priority />
        <div className="save-wave" key={pulse} />
      </div>
      <aside className="sidebar">
        <Wordmark home />
        <div className="nav-label">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              aria-label={n.name}
              aria-current={tab === n.id ? "page" : undefined}
              className={tab === n.id ? "selected" : ""}
              onClick={() => {
                setTab(n.id);
                setError("");
              }}
            >
              <n.icon size={20} />
              <span>{n.name}</span>
              {tab === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="tiny-pair">
            <span className="avatar">{data.profile.name[0]}</span>
            {data.friend && (
              <span className="avatar friend">{data.friend.name[0]}</span>
            )}
          </div>
          <p>
            {data.friend
              ? "A little support. Every day."
              : "Your own pace. Shared support."}
          </p>
          <span className="small muted">
            {demo ? "Demo workspace" : "Private workspace"}
          </span>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <Wordmark className="mobile-wordmark" home />
          <span className="crumb">
            Your space <ChevronRight size={16} />{" "}
            {nav.find((n) => n.id === tab)?.name}
          </span>
          <div className="top-actions">
            {demo ? (
              <button className="demo-badge" onClick={() => setAuthView(true)}>
                Demo · Sign in <ArrowRight size={16} />
              </button>
            ) : (
              <span className="private-badge">
                <ShieldCheck size={16} /> Just your circle
              </span>
            )}
            <button
              className="avatar"
              onClick={() => setTab("settings")}
              aria-label="Your settings"
            >
              {data.profile.name[0]}
            </button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={20} />
            </button>
          </div>
        )}
        {tab === "today" && (
          <>
            <section className="hero today-hero">
              <div className="hero-copy">
                <div className="eyebrow">{dateLabel}</div>
                <h1>
                  A little more
                  <br />
                  <em>in motion.</em>
                </h1>
                <p>
                  Make room for what matters, {data.profile.name.split(" ")[0]}.
                </p>
                <div className="hero-status">
                  <div className="progress-dots" aria-hidden>
                    {daily.map((h) => (
                      <span
                        key={h.id}
                        className={
                          progress(h, data.entries, selected).complete
                            ? "filled"
                            : ""
                        }
                      />
                    ))}
                  </div>
                  <span>
                    <strong>{complete}</strong> of {daily.length} daily habits
                    complete
                  </span>
                </div>
              </div>
              <div className="hero-art">
                <Image
                  src="/motion-field.png"
                  alt="Soft apricot and blue colour fields moving alongside each other"
                  fill
                  sizes="(max-width:700px) 100vw, 50vw"
                  priority
                />
                <span className="art-label">FIND YOUR RHYTHM</span>
              </div>
            </section>
            <div className="section-bar">
              <div>
                <h2>Your commitments</h2>
                <p>Small actions. A direction of your own.</p>
              </div>
              <button
                className="primary compact"
                onClick={() => setDialog({ type: "habit" })}
              >
                <Plus size={20} /> Add habit
              </button>
            </div>
            <div className="controls-row">
              <div className="segmented" aria-label="Habit frequency">
                {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
                  <button
                    key={p}
                    aria-pressed={period === p}
                    onClick={() => setPeriod(p)}
                  >
                    {p === "daily"
                      ? "Today"
                      : p === "weekly"
                        ? "This week"
                        : "This month"}
                  </button>
                ))}
              </div>
              <label className="date-control">
                <CalendarDays size={16} />
                <input
                  type="date"
                  value={selected}
                  max={today}
                  min={shiftDay(today, -365)}
                  aria-label="Check-in date"
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                />
              </label>
            </div>
            <div className="category-tabs" aria-label="Categories">
              {["All", ...categories].map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="habit-grid">
              {period === "daily" &&
                category === "All" &&
                routine.length > 0 && (
                  <article className="habit-card routine-card">
                    <div className="habit-top">
                      <span className="habit-icon warm">
                        <Icon name="sun" size={24} />
                      </span>
                      <button
                        className="round-action"
                        onClick={() => setDialog({ type: "routine" })}
                        aria-label="Log daily essentials"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <span className="eyebrow">Health · Daily</span>
                    <h3>Daily essentials</h3>
                    <p>
                      {
                        routine.filter(
                          (h) => progress(h, data.entries, selected).complete,
                        ).length
                      }{" "}
                      of {routine.length} complete
                    </p>
                    <div className="mini-routine">
                      {routine.map((h) => (
                        <span
                          key={h.id}
                          className={
                            progress(h, data.entries, selected).complete
                              ? "done"
                              : ""
                          }
                          title={h.title}
                        >
                          <Icon
                            name={h.title === "Skincare" ? "sparkles" : "sun"}
                            size={16}
                          />
                        </span>
                      ))}
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setDialog({ type: "routine" })}
                    >
                      Open routine <ArrowRight size={16} />
                    </button>
                  </article>
                )}
              {filtered.map((h) => (
                <HabitCard
                  key={h.id}
                  habit={h}
                  entries={data.entries}
                  day={selected}
                  busy={busy}
                  onOpen={() => setDialog({ type: "log", habit: h })}
                  onEdit={() => setDialog({ type: "habit", habit: h })}
                  onQuick={() => {
                    if (h.kind === "boolean") {
                      const p = progress(h, data.entries, selected);
                      act(
                        p.complete ? "clear_log" : "log",
                        { habit_id: h.id, day: selected, value: 1 },
                        p.complete ? "Check-in undone" : "Check-in saved",
                      );
                    } else setDialog({ type: "log", habit: h });
                  }}
                />
              ))}
            </div>
            {filtered.length === 0 &&
              !(
                period === "daily" &&
                category === "All" &&
                routine.length > 0
              ) && (
                <Empty
                  title="Make space for a new habit"
                  body="Choose a target, a limit or a simple daily check-in."
                >
                  <button
                    className="primary"
                    onClick={() => setDialog({ type: "habit" })}
                  >
                    <Plus size={20} /> Create a habit
                  </button>
                </Empty>
              )}
            {period === "monthly" && (
              <p className="footnote">
                Your pints and clipping goals are not preconfigured. Add them
                once you’ve decided the measure, direction and currency.
              </p>
            )}
          </>
        )}
        {tab === "together" && (
          <>
            <section className="hero together-hero">
              <div className="hero-copy">
                <div className="eyebrow">Two rhythms. One circle.</div>
                <h1>
                  Better,
                  <br />
                  <em>together.</em>
                </h1>
                <p>See the effort. Celebrate the little things.</p>
                <div className="tiny-pair large">
                  <span className="avatar">{data.profile.name[0]}</span>
                  <span className="avatar friend">
                    {data.friend?.name[0] || "+"}
                  </span>
                </div>
              </div>
              <div className="hero-art">
                <Image
                  src="/motion-field.png"
                  alt="Two warm and cool colour fields meeting"
                  fill
                  sizes="(max-width: 600px) 100vw, 50vw"
                />
              </div>
            </section>
            {!data.friend ? (
              <Empty
                title="A space for the two of you"
                body="Invite your friend. You each choose which commitments to share."
              >
                <button
                  className="primary"
                  onClick={() => setDialog({ type: "invite" })}
                >
                  <Link2 size={20} /> Pair with a friend
                </button>
              </Empty>
            ) : (
              <>
                <div className="section-bar">
                  <div>
                    <h2>Your circle</h2>
                    <p>Only the habits you each choose to share.</p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Refresh shared progress"
                    onClick={() =>
                      demo
                        ? flash("Demo progress is up to date")
                        : load().catch((e) => setError(e.message))
                    }
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
                <div className="people-grid">
                  <PersonCard
                    name={data.friend.name}
                    initial={data.friend.name[0]}
                    habits={data.friendHabits.filter((h) => !h.archived)}
                    entries={data.friendEntries}
                    day={dayInZone(new Date(), data.friend.timezone)}
                    friend
                  />
                </div>
                <div className="together-bottom">
                  <section className="surface">
                    <div className="section-bar small-bar">
                      <h2>Shared moments</h2>
                      <span className="eyebrow">Your circle</span>
                    </div>
                    {data.messages.length === 0 ? (
                      <p className="muted">
                        A small note can make someone’s day.
                      </p>
                    ) : (
                      data.messages.slice(0, 8).map((m) => (
                        <div className="message" key={m.id}>
                          <span
                            className={
                              "avatar " +
                              (m.user_id !== data.profile.id ? "friend" : "")
                            }
                          >
                            {m.user_id === data.profile.id
                              ? data.profile.name[0]
                              : data.friend!.name[0]}
                          </span>
                          <div>
                            <strong>
                              {m.user_id === data.profile.id
                                ? "You"
                                : data.friend!.name}
                            </strong>
                            <p>{m.body}</p>
                            <time>
                              {new Date(m.created_at).toLocaleDateString(
                                "en-GB",
                                { day: "numeric", month: "short" },
                              )}
                            </time>
                          </div>
                        </div>
                      ))
                    )}
                    <form
                      className="message-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const body = String(new FormData(form).get("message"));
                        if (
                          await act("message", { body }, "Encouragement sent")
                        )
                          form.reset();
                      }}
                    >
                      <label className="sr-only" htmlFor="message">
                        Your message
                      </label>
                      <input
                        id="message"
                        name="message"
                        placeholder="A little encouragement…"
                        maxLength={500}
                        required
                      />
                      <button
                        className="primary square"
                        disabled={busy}
                        aria-label="Send encouragement"
                      >
                        <ArrowRight size={20} />
                      </button>
                    </form>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        act(
                          "message",
                          { body: "Cheering you on. You’ve got this!" },
                          "Encouragement sent",
                        )
                      }
                    >
                      <Heart size={16} /> Send a quick cheer
                    </button>
                  </section>
                  <section className="surface">
                    <h2>What they’re working towards</h2>
                    {data.friendGoals.length ? (
                      data.friendGoals.map((g) => (
                        <div key={g.id} className="shared-goal">
                          <Icon name="target" />
                          <div>
                            <strong>{g.title}</strong>
                            <p>
                              {displayNumber(g.value)} /{" "}
                              {displayNumber(g.target)} {g.unit}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        Their shared goals will appear here.
                      </p>
                    )}
                    <p className="footnote">
                      <LockKeyhole size={16} /> Private notes and hidden habits
                      stay private.
                    </p>
                  </section>
                </div>
                <details className="own-sharing">
                  <summary>What my friend sees</summary>
                  <PersonCard
                    name={data.profile.name + " · You"}
                    initial={data.profile.name[0]}
                    habits={active.filter((h) => h.shared)}
                    entries={data.entries}
                    day={today}
                  />
                </details>
              </>
            )}
          </>
        )}
        {tab === "goals" && (
          <>
            <section className="page-heading">
              <div className="eyebrow">The bigger picture</div>
              <h1>
                Where you’re
                <br />
                <em>heading.</em>
              </h1>
              <p>Turn the things you want into steps you can take.</p>
            </section>
            <div className="section-bar">
              <h2>Your goals</h2>
              <button
                className="primary compact"
                onClick={() => setDialog({ type: "goal" })}
              >
                <Plus size={20} /> New goal
              </button>
            </div>
            <div className="goals-grid">
              {data.goals.map((g) => (
                <button
                  className={
                    "goal-card " + (g.completed ? "goal-complete" : "")
                  }
                  key={g.id}
                  onClick={() => setDialog({ type: "goal", goal: g })}
                >
                  <div className="goal-art" aria-hidden />
                  <div className="goal-body">
                    <span className="eyebrow">
                      {g.category} · {g.shared ? "Shared" : "Private"}
                    </span>
                    <h2>{g.title}</h2>
                    <p>
                      {g.completed
                        ? "Complete"
                        : `${displayNumber(g.value)} / ${displayNumber(g.target)} ${g.unit}`}
                    </p>
                    <progress
                      value={g.value}
                      max={g.target}
                      aria-label={g.title + " progress"}
                    />
                    <div className="goal-footer">
                      <span>
                        {g.due_date
                          ? new Date(
                              g.due_date + "T12:00:00Z",
                            ).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })
                          : "At your own pace"}
                      </span>
                      <ArrowRight size={20} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {!data.goals.length && (
              <Empty
                title="Give your next chapter a direction"
                body="Add a project, a milestone or a measurable outcome."
              >
                <button
                  className="primary"
                  onClick={() => setDialog({ type: "goal" })}
                >
                  Create your first goal
                </button>
              </Empty>
            )}
            <button className="review-banner" onClick={() => setTab("review")}>
              <div>
                <span className="eyebrow">A moment to reflect</span>
                <h3>How did your week feel?</h3>
                <p>Keep what worked. Adjust what didn’t.</p>
              </div>
              <ArrowRight />
            </button>
          </>
        )}
        {tab === "review" && (
          <>
            <section className="page-heading">
              <div className="eyebrow">A fresh perspective</div>
              <h1>
                Pause.
                <br />
                <em>Then move.</em>
              </h1>
              <p>A private weekly check-in. There’s room to adjust.</p>
            </section>
            <div className="review-grid">
              <section className="surface">
                <h2>This week’s commitments</h2>
                {active
                  .filter((h) => h.period === "weekly")
                  .map((h) => {
                    const p = progress(h, data.entries, today);
                    return (
                      <div className="review-habit" key={h.id}>
                        <span className="habit-icon">
                          <Icon name={h.icon} />
                        </span>
                        <div className="grow">
                          <strong>{h.title}</strong>
                          <p>
                            {displayNumber(p.value)} / {p.target} {h.unit}
                          </p>
                        </div>
                        {p.complete && <Check size={20} />}
                      </div>
                    );
                  })}
                <h3 className="subheading">Daily check-ins</h3>
                <div className="week-days">
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = shiftDay(week, i);
                    const n = daily.filter(
                      (h) => progress(h, data.entries, d).complete,
                    ).length;
                    return (
                      <div key={d}>
                        <span>
                          {new Date(d + "T12:00Z").toLocaleDateString("en-GB", {
                            weekday: "narrow",
                          })}
                        </span>
                        <b className={n ? "logged" : ""}>
                          {d > today ? "—" : n}
                        </b>
                      </div>
                    );
                  })}
                </div>
                <p className="footnote">
                  Completed daily habits. Unlogged days aren’t assumed to be
                  missed.
                </p>
              </section>
              <ReviewForm
                key={week + data.reviews[0]?.id}
                review={data.reviews.find((r) => r.week === week)}
                week={week}
                busy={busy}
                onSave={(p) => act("review", p, "Weekly reflection saved")}
              />
            </div>
            {data.reviews.length > 0 && (
              <section className="surface past-reviews">
                <h2>Past reflections</h2>
                {data.reviews.map((r) => (
                  <details key={r.id}>
                    <summary>
                      Week of{" "}
                      {new Date(r.week + "T12:00Z").toLocaleDateString("en-GB")}
                    </summary>
                    <p>
                      <strong>What worked</strong>
                      <br />
                      {r.win || "—"}
                    </p>
                    <p>
                      <strong>Next week</strong>
                      <br />
                      {r.adjustment || "—"}
                    </p>
                  </details>
                ))}
              </section>
            )}
          </>
        )}
        {tab === "settings" && (
          <>
            <section className="page-heading">
              <div className="eyebrow">Make it yours</div>
              <h1>
                Your rhythm.
                <br />
                <em>Your space.</em>
              </h1>
            </section>
            <div className="settings-grid">
              <ProfileForm
                profile={data.profile}
                busy={busy}
                onSave={(p) => act("profile", p, "Your space updated")}
              />
              <section className="surface">
                <h2>Connections</h2>
                <div className="connection">
                  <span className="connection-logo">W</span>
                  <div className="grow">
                    <strong>WHOOP</strong>
                    <p>
                      {data.whoop.needsReconnect
                        ? "Reconnect to continue syncing"
                        : data.whoop.connected
                          ? "Sleep and workouts connected"
                          : "Sleep and workouts, automatically"}
                    </p>
                  </div>
                  <span className="status-chip">
                    {data.whoop.connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                {data.whoop.lastSync && (
                  <p className="small muted">
                    Last sync{" "}
                    {new Date(data.whoop.lastSync).toLocaleString("en-GB")}
                  </p>
                )}
                <div className="button-row">
                  {!data.whoop.connected || data.whoop.needsReconnect ? (
                    <button
                      className="primary"
                      onClick={() =>
                        demo
                          ? flash("Sign in to connect your real WHOOP account.")
                          : location.assign("/api/whoop/connect")
                      }
                    >
                      Connect WHOOP <ArrowRight size={16} />
                    </button>
                  ) : (
                    <>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => connection("sync")}
                      >
                        <RefreshCw size={16} /> Sync now
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => connection("disconnect")}
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
                <p className="footnote">
                  Sleep uses actual time asleep. Manual daily totals override
                  imported totals for that day. Disconnecting keeps existing
                  history.
                </p>
                <hr />
                <div className="connection">
                  <Icon name="smartphone" />
                  <div>
                    <strong>Phone habits</strong>
                    <p>Manual check-ins</p>
                  </div>
                </div>
                <p className="footnote">
                  The web app can’t read your phone’s Screen Time. Log
                  phone-free mornings and scrolling minutes yourself.
                </p>
              </section>
              <section className="surface">
                <h2>Your circle</h2>
                <p>
                  {data.friend
                    ? `Paired with ${data.friend.name}. You each control what you share.`
                    : "Invite one friend to build habits alongside you."}
                </p>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() => setDialog({ type: "invite" })}
                  >
                    {data.friend ? "Pairing details" : "Invite or join"}{" "}
                    <Link2 size={16} />
                  </button>
                  {data.pairId && (
                    <button
                      className="text-button danger"
                      onClick={() => setDialog({ type: "leave" })}
                    >
                      Leave circle
                    </button>
                  )}
                </div>
                <p className="footnote">
                  Leaving removes mutual access and shared messages. Your own
                  habits, goals and check-ins remain.
                </p>
              </section>
              <section className="surface">
                <h2>Habit library</h2>
                <p>
                  Choose visibility, adjust future targets or bring a paused
                  habit back.
                </p>
                <div className="manage-habits">
                  {data.habits.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setDialog({ type: "habit", habit: h })}
                    >
                      <Icon name={h.icon} size={20} />
                      <span>{h.title}</span>
                      <span className="small muted">
                        {h.archived
                          ? "Paused"
                          : h.shared
                            ? "Shared"
                            : "Private"}
                      </span>
                      <Pencil size={16} />
                    </button>
                  ))}
                </div>
                <button
                  className="text-button"
                  onClick={() => setDialog({ type: "habit" })}
                >
                  <Plus size={16} /> Add habit
                </button>
              </section>
            </div>
            <div className="settings-bottom">
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    let payload: unknown = {
                      profile: data.profile,
                      habits: data.habits,
                      entries: data.entries,
                      goals: data.goals,
                      reviews: data.reviews,
                    };
                    if (!demo) {
                      const response = await fetch("/api/export", {
                        cache: "no-store",
                      });
                      payload = await response.json();
                      if (!response.ok)
                        throw Error("Export failed. Please retry.");
                    }
                    const file = new Blob([JSON.stringify(payload, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(file),
                      a = document.createElement("a");
                    a.href = url;
                    a.download = "motion-my-data.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Export failed");
                  }
                }}
              >
                Export my data
              </button>
              <button className="text-button" onClick={signout}>
                <LogOut size={16} />
                {demo ? "Exit demo" : "Sign out"}
              </button>
            </div>
          </>
        )}
        <footer className="app-footer">
          <Wordmark />
          <span>
            {demo
              ? "Demo data stays on this device."
              : "Your goals. Your pace. Your circle."}
          </span>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <button
            key={n.id}
            aria-current={tab === n.id ? "page" : undefined}
            onClick={() => setTab(n.id)}
          >
            <n.icon size={20} />
            <span>{n.name}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {busy && (
        <div className="saving" role="status">
          <LoaderCircle className="spin" size={16} /> Saving…
        </div>
      )}
      {dialog && (
        <Modal
          title={
            dialog.type === "log"
              ? dialog.habit.title
              : dialog.type === "habit"
                ? dialog.habit
                  ? "Edit habit"
                  : "A new commitment"
                : dialog.type === "goal"
                  ? dialog.goal
                    ? "Your goal"
                    : "A bigger goal"
                  : dialog.type === "routine"
                    ? "Daily essentials"
                    : dialog.type === "leave"
                      ? "Leave your circle?"
                      : "Your private circle"
          }
          onClose={() => !busy && setDialog(null)}
        >
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {dialog.type === "log" && (
            <LogForm
              habit={dialog.habit}
              entries={data.entries}
              day={selected}
              today={today}
              busy={busy}
              onSave={async (payload) => {
                if (await act("log", payload, "Check-in saved"))
                  setDialog(null);
              }}
              onClear={async (d) => {
                if (
                  await act(
                    "clear_log",
                    { habit_id: dialog.habit.id, day: d },
                    "Manual entry removed",
                  )
                )
                  setDialog(null);
              }}
            />
          )}
          {dialog.type === "routine" && (
            <>
              <p className="muted">
                {dateLabel} · Each step is saved individually.
              </p>
              <div className="routine-list">
                {routine.map((h) => (
                  <div key={h.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={progress(h, data.entries, selected).complete}
                        disabled={busy}
                        onChange={(e) =>
                          act(
                            e.target.checked ? "log" : "clear_log",
                            { habit_id: h.id, day: selected, value: 1 },
                            "Routine updated",
                          )
                        }
                      />
                      <span>{h.title}</span>
                    </label>
                    <button
                      className="icon-button"
                      aria-label={"Edit " + h.title}
                      onClick={() => setDialog({ type: "habit", habit: h })}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="primary full" onClick={() => setDialog(null)}>
                Done
              </button>
            </>
          )}
          {dialog.type === "habit" && (
            <HabitForm
              habit={dialog.habit}
              busy={busy}
              onSave={async (h) => {
                if (
                  await act(
                    dialog.habit ? "habit_update" : "habit_create",
                    { id: dialog.habit?.id, habit: h },
                    dialog.habit
                      ? "Habit updated. New targets start next period."
                      : "Habit added",
                  )
                )
                  setDialog(null);
              }}
            />
          )}
          {dialog.type === "goal" && (
            <GoalForm
              goal={dialog.goal}
              busy={busy}
              onSave={async (g) => {
                if (
                  await act(
                    dialog.goal ? "goal_update" : "goal_create",
                    { id: dialog.goal?.id, goal: g },
                    "Goal saved",
                  )
                )
                  setDialog(null);
              }}
              onDelete={
                dialog.goal
                  ? async () => {
                      if (
                        await act(
                          "goal_delete",
                          { id: dialog.goal!.id },
                          "Goal deleted",
                        )
                      )
                        setDialog(null);
                    }
                  : undefined
              }
            />
          )}
          {dialog.type === "invite" && (
            <>
              <p className="muted">
                Your circle has room for you and one friend. An invitation lasts
                seven days and can be used once.
              </p>
              {data.friend ? (
                <div className="pair-details">
                  <Users />
                  <h3>You and {data.friend.name}</h3>
                  <p>Choose what to share from each habit or goal.</p>
                </div>
              ) : (
                <>
                  <button
                    className="primary full"
                    disabled={busy || demo}
                    onClick={() => act("invite", {}, "Invitation created")}
                  >
                    Create invitation
                  </button>
                  {demo && (
                    <p className="footnote">
                      Real invitations are available after signing in.
                    </p>
                  )}
                  {invite && (
                    <div className="invite-link">
                      <label>Invitation link</label>
                      <input
                        readOnly
                        value={
                          typeof window !== "undefined"
                            ? location.origin + "/?invite=" + invite
                            : ""
                        }
                      />
                      <button
                        className="secondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              location.origin + "/?invite=" + invite,
                            );
                            flash("Invitation copied");
                          } catch {
                            flash("Select and copy the invitation link.");
                          }
                        }}
                      >
                        Copy link
                      </button>
                    </div>
                  )}
                  <hr />
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const value = String(
                        new FormData(e.currentTarget).get("invite"),
                      ).trim();
                      let token = value;
                      try {
                        if (value.includes("?"))
                          token =
                            new URL(value).searchParams.get("invite") || "";
                      } catch {
                        setError("Paste a valid invitation link or code.");
                        return;
                      }
                      if (!/^[a-f0-9]{48}$/.test(token)) {
                        setError("Paste a valid invitation link or code.");
                        return;
                      }
                      if (await act("join", { token }, "You’re paired"))
                        setDialog(null);
                    }}
                  >
                    <label>
                      Have an invitation?
                      <input
                        name="invite"
                        placeholder="Paste the invitation link or code"
                        defaultValue={invite}
                        required
                      />
                    </label>
                    <button className="secondary full" disabled={busy || demo}>
                      Join your friend
                    </button>
                  </form>
                </>
              )}
            </>
          )}
          {dialog.type === "leave" && (
            <>
              <p>
                Your friend will lose access to your shared progress, and you’ll
                lose access to theirs. Your personal records remain.
              </p>
              <button
                className="primary full"
                disabled={busy}
                onClick={async () => {
                  if (await act("leave", {}, "Circle closed")) setDialog(null);
                }}
              >
                Leave circle
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function HabitCard({
  habit: h,
  entries,
  day,
  busy,
  onOpen,
  onEdit,
  onQuick,
}: {
  habit: Habit;
  entries: Entry[];
  day: string;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onQuick: () => void;
}) {
  const p = progress(h, entries, day);
  const status = !p.logged
    ? h.provider !== "manual"
      ? "Awaiting check-in or sync"
      : "Not logged yet"
    : h.kind === "maximum"
      ? p.value > p.target
        ? "Over your limit"
        : "Within your limit"
      : p.complete
        ? "Complete"
        : "In progress";
  return (
    <article className={"habit-card " + (p.complete ? "complete" : "")}>
      <div className="habit-top">
        <span
          className={
            "habit-icon " +
            (h.category === "Fitness"
              ? "cool"
              : h.category === "Health"
                ? "warm"
                : "violet")
          }
        >
          <Icon name={h.icon} size={24} />
        </span>
        <button
          className={"round-action " + (p.complete ? "done" : "")}
          disabled={busy}
          onClick={onQuick}
          aria-label={
            (h.kind === "boolean" && p.complete ? "Undo " : "Log ") + h.title
          }
        >
          {p.complete ? <Check size={20} /> : <Plus size={20} />}
        </button>
      </div>
      <span className="eyebrow">
        {h.category} · {h.period}
      </span>
      <button className="habit-title" onClick={onOpen}>
        <h3>{h.title}</h3>
      </button>
      <div className="habit-value">
        {h.kind === "boolean" ? (
          <span>
            {p.complete ? "Done" : p.logged ? "Missed" : "Ready when you are"}
          </span>
        ) : (
          <>
            <strong>{displayNumber(p.value)}</strong>
            <span>
              {" "}
              / {p.target} {h.unit}
              {h.kind === "maximum" ? " max" : ""}
            </span>
          </>
        )}
      </div>
      {h.kind !== "boolean" && (
        <progress
          value={p.value}
          max={p.target}
          aria-label={h.title + " progress"}
          className={h.kind === "maximum" ? "limit" : ""}
        />
      )}
      <div className="habit-foot">
        <span
          className={
            h.kind === "maximum" && p.value > p.target ? "over-limit" : ""
          }
        >
          {status}
        </span>
        <button
          className="icon-button"
          onClick={onEdit}
          aria-label={"Edit " + h.title}
        >
          <Pencil size={16} />
        </button>
      </div>
    </article>
  );
}
function PersonCard({
  name,
  initial,
  habits,
  entries,
  day,
  friend = false,
}: {
  name: string;
  initial: string;
  habits: Habit[];
  entries: Entry[];
  day: string;
  friend?: boolean;
}) {
  return (
    <section className="person-card">
      <header>
        <span className={"avatar " + (friend ? "friend" : "")}>{initial}</span>
        <div>
          <h2>{name}</h2>
          <p>
            {friend ? "Their shared commitments" : "What your friend can see"}
          </p>
        </div>
      </header>
      {habits.length === 0 ? (
        <p className="muted">No shared habits yet.</p>
      ) : (
        habits.map((h) => {
          const p = progress(h, entries, day);
          return (
            <div className="person-habit" key={h.id}>
              <span className="habit-icon small">
                <Icon name={h.icon} size={20} />
              </span>
              <div className="grow">
                <strong>{h.title}</strong>
                <p>
                  {h.period === "daily"
                    ? "Today"
                    : h.period === "weekly"
                      ? "This week"
                      : "This month"}
                </p>
              </div>
              <span className={"person-value " + (p.complete ? "is-done" : "")}>
                {!p.logged
                  ? "No check-in"
                  : h.kind === "boolean"
                    ? p.complete
                      ? "Done"
                      : "Missed"
                    : `${displayNumber(p.value)} / ${p.target}`}{" "}
                {p.complete && <Check size={16} />}
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}
function LogForm({
  habit: h,
  entries,
  day,
  today,
  busy,
  onSave,
  onClear,
}: {
  habit: Habit;
  entries: Entry[];
  day: string;
  today: string;
  busy: boolean;
  onSave: (p: any) => void;
  onClear: (day: string) => void;
}) {
  const [selected, setSelected] = useState(day),
    [value, setValue] = useState(
      String(
        entries.some((e) => e.habit_id === h.id && e.day === day)
          ? dailyValue(entries, h.id, day)
          : h.kind === "boolean"
            ? 1
            : h.kind === "maximum"
              ? 0
              : h.period === "daily"
                ? targetOn(h, day)
                : 1,
      ),
    );
  const manual = entries.some(
    (e) =>
      e.habit_id === h.id && e.day === selected && e.source_key === "manual",
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ habit_id: h.id, day: selected, value: Number(value) });
      }}
    >
      <div className="log-icon habit-icon">
        <Icon name={h.icon} size={24} />
      </div>
      <p className="muted">
        {h.kind === "maximum"
          ? "Log the amount used. Staying below your limit counts."
          : "Every check-in is a little step forward."}
      </p>
      <label>
        Date
        <input
          type="date"
          value={selected}
          max={today}
          min={shiftDay(today, -365)}
          onChange={(e) => {
            setSelected(e.target.value);
            setValue(String(dailyValue(entries, h.id, e.target.value)));
          }}
          required
        />
      </label>
      {h.kind === "boolean" ? (
        <div className="segmented">
          <button
            type="button"
            aria-pressed={value === "1"}
            onClick={() => setValue("1")}
          >
            Done
          </button>
          <button
            type="button"
            aria-pressed={value === "0"}
            onClick={() => setValue("0")}
          >
            Missed
          </button>
        </div>
      ) : (
        <>
          <label>
            Total {h.unit} on this day
            <input
              type="number"
              min="0"
              max="1000000000"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              autoFocus
            />
          </label>
          {h.unit === "minutes" && (
            <div className="presets">
              {[0, 15, 30, 60].map((n) => (
                <button
                  className="secondary"
                  type="button"
                  key={n}
                  onClick={() => setValue(String(n))}
                >
                  {n} min
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {h.provider !== "manual" && (
        <p className="footnote">
          This manual daily total takes priority over WHOOP. Remove it to use
          imported data again.
        </p>
      )}
      <div className="sharing-label">
        {h.shared ? <Users size={16} /> : <LockKeyhole size={16} />}{" "}
        {h.shared ? "Progress shared with your friend" : "Only visible to you"}
      </div>
      <button className="primary full" disabled={busy}>
        Save check-in <Check size={20} />
      </button>
      {manual && (
        <button
          type="button"
          className="text-button full"
          disabled={busy}
          onClick={() => onClear(selected)}
        >
          Remove manual entry
        </button>
      )}
      <h3 className="subheading">Last seven days</h3>
      <div className="week-days">
        {Array.from({ length: 7 }, (_, i) => {
          const d = shiftDay(today, i - 6);
          const rows = entries.filter(
            (e) => e.habit_id === h.id && e.day === d,
          );
          return (
            <div key={d}>
              <span>
                {new Date(d + "T12:00Z").toLocaleDateString("en-GB", {
                  weekday: "narrow",
                })}
              </span>
              <b className={rows.length ? "logged" : ""}>
                {rows.length
                  ? displayNumber(dailyValue(entries, h.id, d))
                  : "—"}
              </b>
            </div>
          );
        })}
      </div>
    </form>
  );
}
function HabitForm({
  habit: h,
  busy,
  onSave,
}: {
  habit?: Habit;
  busy: boolean;
  onSave: (h: any) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const kind = String(f.get("kind") || h?.kind);
        onSave({
          title: f.get("title"),
          category: f.get("category") || h?.category,
          period: f.get("period") || h?.period,
          kind,
          target: kind === "boolean" ? 1 : Number(f.get("target")),
          unit: kind === "boolean" ? "done" : String(f.get("unit") || h?.unit),
          icon: f.get("icon") || h?.icon || "circle-check",
          shared: f.get("shared") === "on",
          archived: f.get("archived") === "on",
          provider: f.get("provider") || h?.provider || "manual",
        });
      }}
    >
      <label>
        Habit name
        <input
          name="title"
          defaultValue={h?.title}
          required
          maxLength={100}
          placeholder="What do you want to make time for?"
        />
      </label>
      {!h && (
        <>
          <div className="form-grid">
            <label>
              Category
              <select name="category" defaultValue="Routine">
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Frequency
              <select name="period" defaultValue="daily">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
          <label>
            Tracking style
            <select name="kind" defaultValue="minimum">
              <option value="minimum">A target to reach</option>
              <option value="maximum">A limit to stay within</option>
              <option value="boolean">Done / not done</option>
            </select>
          </label>
        </>
      )}
      {h?.kind !== "boolean" && (
        <div className="form-grid">
          <label>
            Target
            <input
              name="target"
              type="number"
              min="0.01"
              step="any"
              defaultValue={h?.versions.at(-1)?.target ?? h?.target ?? 1}
              required
            />
          </label>
          <label>
            Unit
            <input
              name="unit"
              defaultValue={h?.unit || "minutes"}
              maxLength={30}
              readOnly={!!h}
              required
            />
          </label>
        </div>
      )}
      {!h && (
        <div className="form-grid">
          <label>
            Icon
            <select name="icon">
              {[
                "circle-check",
                "book-open",
                "dumbbell",
                "footprints",
                "moon",
                "sun",
                "smartphone",
                "laptop",
                "briefcase",
                "wallet",
                "heart",
              ].map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>
          <label>
            Data source
            <select name="provider">
              <option value="manual">Manual</option>
              <option value="whoop_sleep">WHOOP sleep</option>
              <option value="whoop_run">WHOOP running</option>
              <option value="whoop_gym">WHOOP gym</option>
            </select>
          </label>
        </div>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          name="shared"
          defaultChecked={h?.shared ?? true}
        />
        Share progress with my friend
      </label>
      {h && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              name="archived"
              defaultChecked={h.archived}
            />
            Pause this habit
          </label>
          <p className="footnote">
            Target changes start next{" "}
            {h.period === "daily"
              ? "day"
              : h.period === "weekly"
                ? "week"
                : "month"}
            . Past targets remain in your history. Create a new habit to change
            its tracking style.
          </p>
        </>
      )}
      <button className="primary full" disabled={busy}>
        {h ? "Save changes" : "Add habit"}
      </button>
    </form>
  );
}
function GoalForm({
  goal,
  busy,
  onSave,
  onDelete,
}: {
  goal?: Goal;
  busy: boolean;
  onSave: (g: any) => void;
  onDelete?: () => void;
}) {
  const [g, setG] = useState({ ...blankGoal, ...goal }),
    [milestone, setMilestone] = useState(""),
    [confirm, setConfirm] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(g);
      }}
    >
      <label>
        Goal
        <input
          value={g.title}
          onChange={(e) => setG({ ...g, title: e.target.value })}
          required
          maxLength={120}
          placeholder="Something worth working towards"
        />
      </label>
      <div className="form-grid">
        <label>
          Category
          <select
            value={g.category}
            onChange={(e) =>
              setG({ ...g, category: e.target.value as Goal["category"] })
            }
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Target date
          <input
            type="date"
            value={g.due_date || ""}
            onChange={(e) => setG({ ...g, due_date: e.target.value || null })}
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Current amount
          <input
            type="number"
            min="0"
            step="any"
            value={g.value}
            onChange={(e) => setG({ ...g, value: Number(e.target.value) })}
            required
          />
        </label>
        <label>
          Target amount
          <input
            type="number"
            min="0.01"
            step="any"
            value={g.target}
            onChange={(e) => setG({ ...g, target: Number(e.target.value) })}
            required
          />
        </label>
      </div>
      <label>
        Unit
        <input
          value={g.unit}
          onChange={(e) => setG({ ...g, unit: e.target.value })}
          maxLength={30}
          required
          placeholder="projects, GBP, milestones…"
        />
      </label>
      <h3 className="subheading">Milestones</h3>
      <div className="milestones">
        {g.milestones.map((m, i) => (
          <div key={m.id}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={m.done}
                onChange={(e) =>
                  setG({
                    ...g,
                    milestones: g.milestones.map((x, j) =>
                      j === i ? { ...x, done: e.target.checked } : x,
                    ),
                  })
                }
              />
              {m.title}
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={"Remove " + m.title}
              onClick={() =>
                setG({
                  ...g,
                  milestones: g.milestones.filter((_, j) => j !== i),
                })
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="message-form">
        <input
          aria-label="New milestone"
          value={milestone}
          onChange={(e) => setMilestone(e.target.value)}
          placeholder="Add a step"
          maxLength={120}
        />
        <button
          type="button"
          className="secondary square"
          disabled={!milestone.trim() || g.milestones.length >= 30}
          onClick={() => {
            setG({
              ...g,
              milestones: [
                ...g.milestones,
                {
                  id: crypto.randomUUID(),
                  title: milestone.trim(),
                  done: false,
                },
              ],
            });
            setMilestone("");
          }}
          aria-label="Add milestone"
        >
          <Plus size={20} />
        </button>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={g.completed}
          onChange={(e) => setG({ ...g, completed: e.target.checked })}
        />
        Goal complete
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={g.shared}
          onChange={(e) => setG({ ...g, shared: e.target.checked })}
        />
        Share with my friend
      </label>
      <button className="primary full" disabled={busy}>
        Save goal
      </button>
      {onDelete && (
        <button
          type="button"
          className="text-button danger full"
          disabled={busy}
          onClick={() => (confirm ? onDelete() : setConfirm(true))}
        >
          {confirm ? "Confirm delete goal" : "Delete goal"}
        </button>
      )}
    </form>
  );
}
function ProfileForm({
  profile,
  busy,
  onSave,
}: {
  profile: AppData["profile"];
  busy: boolean;
  onSave: (p: any) => void;
}) {
  return (
    <form
      className="surface"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave(Object.fromEntries(f));
      }}
    >
      <h2>Your colour, your pace</h2>
      <label>
        Name
        <input
          name="name"
          defaultValue={profile.name}
          required
          maxLength={60}
        />
      </label>
      <fieldset className="colour-options">
        <legend>Your colour family</legend>
        {colours.map((c) => (
          <label key={c.id}>
            <input
              name="colour"
              type="radio"
              value={c.id}
              defaultChecked={profile.colour === c.id}
            />
            <span className={"colour-swatch " + c.id} />
            <span>{c.label}</span>
          </label>
        ))}
      </fieldset>
      <label>
        Timezone
        <select name="timezone" defaultValue={profile.timezone}>
          {[
            ...new Set([
              profile.timezone,
              Intl.DateTimeFormat().resolvedOptions().timeZone,
              "Europe/London",
              "Asia/Singapore",
              "Australia/Sydney",
              "America/New_York",
              "UTC",
            ]),
          ].map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </label>
      <button className="primary" disabled={busy}>
        Save preferences
      </button>
      <p className="footnote">
        Colour responds to your actions. It doesn’t judge your mood or health.
      </p>
    </form>
  );
}
function ReviewForm({
  review,
  week,
  busy,
  onSave,
}: {
  review?: AppData["reviews"][number];
  week: string;
  busy: boolean;
  onSave: (p: any) => void;
}) {
  return (
    <form
      className="surface"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({ week, win: f.get("win"), adjustment: f.get("adjustment") });
      }}
    >
      <h2>Your reflection</h2>
      <label>
        What worked this week?
        <textarea
          name="win"
          rows={4}
          defaultValue={review?.win}
          maxLength={2000}
          placeholder="A small win, a moment of progress…"
        />
      </label>
      <label>
        What would help next week?
        <textarea
          name="adjustment"
          rows={4}
          defaultValue={review?.adjustment}
          maxLength={2000}
          placeholder="A different target, more rest, a little support…"
        />
      </label>
      <div className="sharing-label">
        <LockKeyhole size={16} />
        Only visible to you
      </div>
      <button className="primary" disabled={busy}>
        Save reflection
      </button>
    </form>
  );
}
function AuthScreen({
  onDemo,
  onSignedIn,
  error,
}: {
  onDemo: () => void;
  onSignedIn: () => Promise<void>;
  error: string;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login"),
    [notice, setNotice] = useState(error),
    [busy, setBusy] = useState(false);
  return (
    <main className="auth-layout">
      <section className="auth-art">
        <Image
          src="/motion-field.png"
          alt="Fluid warm and cool colour fields"
          fill
          sizes="(max-width: 600px) 100vw, 50vw"
          priority
        />
        <Wordmark />
        <div>
          <h1>
            Your life.
            <br />
            In motion.
          </h1>
          <p>
            A private space to build habits
            <br />
            and move forward together.
          </p>
        </div>
      </section>
      <section className="auth-form">
        <span className="eyebrow">A little progress starts here</span>
        <h1>{mode === "login" ? "Welcome back." : "Make it yours."}</h1>
        <p>
          {mode === "login"
            ? "Sign in to your space."
            : "Start with your goals. Invite your person."}
        </p>
        {notice && (
          <p className="form-notice" role="status">
            {notice}
          </p>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!configured()) {
              setNotice(
                "Account services are not connected on this deployment yet. You can explore the demo.",
              );
              return;
            }
            setBusy(true);
            try {
              const f = new FormData(e.currentTarget);
              const client = browserClient();
              const email = String(f.get("email")),
                password = String(f.get("password"));
              const result =
                mode === "login"
                  ? await client.auth.signInWithPassword({ email, password })
                  : await client.auth.signUp({
                      email,
                      password,
                      options: {
                        data: { name: String(f.get("name")) },
                        emailRedirectTo: location.origin + "/auth/callback",
                      },
                    });
              if (result.error) throw result.error;
              if (result.data.session) await onSignedIn();
              else
                setNotice(
                  "Check your email to confirm your account, then come back to sign in.",
                );
            } catch (e) {
              setNotice(e instanceof Error ? e.message : "Could not sign in");
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "signup" && (
            <label>
              Name
              <input
                name="name"
                autoComplete="given-name"
                required
                maxLength={60}
              />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={10}
              required
            />
          </label>
          <button className="primary full" disabled={busy}>
            {busy
              ? "One moment…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}{" "}
            <ArrowRight size={20} />
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setNotice("");
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
        <hr />
        <button className="secondary full" onClick={onDemo}>
          Explore the demo
        </button>
        <p className="footnote">
          Demo data stays on this device. Real accounts sync across devices.
        </p>
      </section>
    </main>
  );
}
function Onboarding({
  profile,
  busy,
  error,
  onSave,
}: {
  profile: AppData["profile"];
  busy: boolean;
  error: string;
  onSave: (p: any) => void;
}) {
  const [selected, setSelected] = useState(
    templateDefinitions.map((_, i) => i),
  );
  return (
    <main className="onboarding">
      <Wordmark />
      <div className="eyebrow">Your first step</div>
      <h1>Find your rhythm.</h1>
      <p>Choose a starting routine. You can change every habit later.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            name: f.get("name"),
            colour: f.get("colour"),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            indices: selected,
          });
        }}
      >
        <div className="form-grid">
          <label>
            Name
            <input
              name="name"
              defaultValue={profile.name}
              required
              maxLength={60}
            />
          </label>
          <label>
            Colour family
            <select name="colour">
              {colours.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="onboarding-habits">
          {templateDefinitions.map((h, i) => (
            <label className="check-label" key={h.title}>
              <input
                type="checkbox"
                checked={selected.includes(i)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, i]
                      : selected.filter((x) => x !== i),
                  )
                }
              />
              <Icon name={h.icon} size={20} />
              <span>
                {h.title}
                <small>
                  {h.kind === "boolean"
                    ? "Daily check-in"
                    : `${h.target} ${h.unit} · ${h.period}`}
                  {!h.shared ? " · Private" : ""}
                </small>
              </span>
            </label>
          ))}
        </div>
        <p className="footnote">
          Selected habits are shared with your paired friend except
          Doomscrolling, which starts private. Change visibility in any habit.
          Running starts at 3 per week; reading or journaling counts towards the
          same 15-minute target.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          Open my space <ArrowRight size={20} />
        </button>
      </form>
    </main>
  );
}
