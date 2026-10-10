---
name: 'Adversarial Review — Motion Competitive Layer + iOS Client'
type: architecture-review
reviews: _bmad-output/planning-artifacts/architecture/architecture-MOTION-2026-10-10/ARCHITECTURE-SPINE.md
created: '2026-10-10'
method: construct pairs of one-level-down units that each satisfy every AD to the letter, yet build incompatibly
---

# Adversarial Review — Architecture Spine (Motion, 2026-10-10)

## Method

For each pair below I constructed two concrete, independently-buildable units (a client feature, a story, a migration, a screen) that an engineer could ship while honestly checking off every AD the spine states. I then traced the actual runtime/data outcome when both units exist in the same system. Grounding: `supabase/migrations/20260927165709_motion_initial.sql`, `supabase/migrations/20260927172350_harden_motion_access.sql`, `lib/domain.ts`, `supabase/migrations/20261010000000_challenges.sql`.

Verdict up front: **the spine's six ADs are individually sound, but at least five pairs of compliant units collide at the seams the spine leaves unaddressed** — mostly because AD-2 and AD-6 regulate the *creation* of a shared entity (the cloned habit, the rank) but say nothing about who else is allowed to mutate it afterward, and AD-1's "existing tables are never redefined" is ambiguous about whether existing *policies* on those tables are included.

---

## Finding 1 — HealthKit's "write as the authenticated user" (AD-4) is blocked by the entries RLS that AD-1 freezes

**Unit A — `HealthKitSync.swift` (iOS, built strictly to AD-4/AD-5).**
AD-4: *"HealthKit is device-pushed: the iOS app reads `HKObserverQuery` results itself and writes `entries` rows to Supabase as the authenticated user."* AD-5 requires this to happen unconditionally on every foreground/launch. A conforming implementation does a plain authenticated `insert` into `entries` with some `source_key` that identifies it as HealthKit-sourced (it must not be `'manual'`, or it would silently collide with/override the user's own manual check-ins via `dailyValue()`'s manual-precedence rule in `lib/domain.ts:116-120`).

**Unit B — the entries table's existing RLS, preserved per AD-1.**
AD-1: *"Existing tables ... are never dropped or redefined by this feature."* The existing policy, unmodified by the draft migration, is:
```sql
create policy entries_insert on public.entries for insert to authenticated
  with check(user_id=(select auth.uid()) and source_key='manual');
```
(`20260927172350_harden_motion_access.sql:33`)

**The collision:** Unit A's every write is rejected by Postgres RLS (`new row violates row-level security policy`), because the only values of `source_key` an authenticated client is allowed to insert are `'manual'`. The *only* non-manual writer permitted today is `service_role` (via `apply_whoop_entries`, used exclusively by the server-pulled WHOOP path). AD-4 licenses a second, structurally different write path into `entries` as an authenticated client, but the RLS boundary that AD-1 tells engineers to leave alone makes that path a no-op in production. Each unit, read in isolation, is spine-compliant; together, HealthKit sync builds and runs and silently fails every single write.

**The deeper trap:** the "obvious" fix — loosen `entries_insert` to also allow a `'healthkit'`-prefixed `source_key` — is itself an *edit to an existing policy on an existing table*, which is exactly what AD-1 says not to do, and it has to get the `source_key` naming convention right against `apply_whoop_entries`' hardcoded `source_key like 'whoop:%'` deletion filter (`20260927165709_motion_initial.sql:107`) or risk cross-deleting the wrong provider's rows during a later WHOOP resync. AD-1 has no carve-out for "this specific policy may be extended"; it just says tables aren't "redefined," leaving the policy question open.

**Close the hole with:** a new AD that (a) explicitly authorizes amending `entries_insert`/`entries_update`/`entries_delete` (not the table shape) to admit a reserved, enumerated set of non-manual `source_key` prefixes, and (b) fixes the HealthKit `source_key` naming convention (e.g. `healthkit:<hktype>`) in the same breath as the WHOOP one, so the two provider namespaces can never collide under `apply_whoop_entries`' pattern match.

---

## Finding 2 — Two owners of the same `habits` row: the pre-existing Habit editor vs. the Challenge/Leaderboard invariant

AD-2's whole justification is: *"everyone should have the same habits in the group"* and *"ranking never compares across differing targets."* It enforces this only at **join time** — `join_challenge()` clones `{title, category, period, kind, target, unit}` once into a fresh row the member now owns outright in `public.habits`.

**Unit A — the existing "edit a habit" screen (Today feature), unchanged per AD-1.**
`habits_update` and `habits_delete` are untouched by the draft migration:
```sql
create policy habits_update on public.habits for update to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy habits_delete on public.habits for delete to authenticated
  using(user_id=(select auth.uid()));
```
Nothing distinguishes a challenge-cloned habit from an ordinary one — there isn't even a column on `habits` that says "this one belongs to a challenge." A user opens the ordinary Edit Habit sheet (a feature AD-1 says keeps its existing, unmodified role) and lowers their cloned habit's `target` from 10,000 steps to 100, or changes its `period` from `weekly` to `daily`.

**Unit B — the Leaderboard ranking view/function, built strictly to AD-6.**
AD-6 ports `lib/domain.ts`'s `progress()`/`targetOn()` logic server-side and computes rank by joining `challenge_members → habits → entries`. It has no way to know, and AD-2 gives it no mechanism to check, that a member's `habits.target` no longer matches `challenges.target`. The two units are each perfectly correct relative to their own AD. Together: a member can trivially make themselves un-losable, and the leaderboard will rank them as "ahead" using the deflated target with full apparent legitimacy — exactly the failure mode AD-2 says it exists to prevent, reopened by a feature AD-1 explicitly declared out of scope to touch.

**A second, sharper version of the same hole — delete, not edit:** `challenge_members.habit_id` is declared `not null references public.habits on delete cascade` (`20261010000000_challenges.sql:23`), and `entries.habit_id` already cascades on habit delete (`20260927165709_motion_initial.sql:11`). So the *same* "delete habit" button on the *same* pre-existing Today screen that deletes any ordinary habit will, for a challenge-cloned habit, silently: drop the member from `challenge_members` (no "leave challenge" confirmation, no notice to the group), and permanently destroy every `entries` row the member logged for that habit, including entries from before they joined if the cloned habit happened to reuse a day a manual entry already existed on. A feature that is contractually "unchanged in role" (AD-1) now has a blast radius — exiting a live social competition and erasing its own history — that its own UI copy ("Delete habit?") gives no hint of.

**Close the hole with:** a new AD that either (a) forbids editing/deleting a habit referenced by `challenge_members` through the generic habit-editor RLS (requires a trigger or a `challenge_id` marker column plus an updated `habits_update`/`habits_delete` policy — itself requiring the Finding 1 carve-out to AD-1's "no redefinition" reading), or (b) makes `join_challenge` store the frozen target/period in `challenge_members` itself (not read live off `habits`), so drift in the member's own copy can't affect ranking, and defines a real `leave_challenge()` function that detaches without cascading entry deletion.

---

## Finding 3 — Challenge-creator self-membership: two RLS-equal clients, two defensible (and divergent) mutation paths

AD-3 makes the point explicit: iOS and web are "RLS-equal peers" of Supabase, each calling it directly, with **no server arbitrating between them**. AD-2 defines joining only via `join_challenge(token)`, and the grants confirm it's the *only* way to get a `challenge_members` row — `grant select on public.challenge_members to authenticated` with no `insert` grant, so a client cannot insert that row itself; only the `security definer` function can.

But nothing in `challenges_insert` or anywhere else enrolls the creator as a member:
```sql
create policy challenges_insert on public.challenges for insert to authenticated
  with check (creator_id = (select auth.uid()));
```
Creating a challenge and being *in* it (ranked, with a cloned habit) are two separate acts, and the spine never says the first implies the second.

**Unit A — Web "Create Challenge" flow**, built by one engineer who reads AD-2 ("challenges holds exactly one definition... joining clones it") and reasonably concludes the creator must also join: after inserting the `challenges` row, it immediately calls `create_challenge_invite`, then `join_challenge` on that same token for the creator, so the creator gets a cloned habit and a leaderboard row like everyone else.

**Unit B — iOS "Challenges" feature**, built by a different engineer (per the Structural Seed, iOS development is a separate workstream) who reads the same AD-2 and reasonably concludes the creator is the *host* of the competition, not necessarily a *racer* in it — many real leaderboard apps work this way — and never calls `join_challenge` for the creator.

**The collision:** both units are fully RLS-compliant, AD-3-compliant (no server coordination needed or used), and AD-2-compliant (the clone-on-join rule is honored exactly when it fires). But the same logical action — "create a challenge" — produces structurally different data depending only on which client did it: a web-created challenge has `N+1` members including the creator; an iOS-created challenge has `N` members, and the creator sees no rank, no personal progress, and (worse) if they later tap "Join" on their own invite link from the other client, `join_challenge` raises `'Already in this challenge'` or, if no self-invite was ever created, has no entry point to join at all. There is no single answer visible in the spine for "is the creator a member," so two compliant teams will ship two different answers.

**Close the hole with:** a new AD (or tightened AD-2) that pins creator self-membership as a server-enforced invariant — e.g., `challenges_insert` becomes impossible directly and is replaced by a single `create_challenge(...)` `security definer` function (mirroring `create_invite`'s pattern) that inserts the challenge row *and* the creator's `challenge_members`/cloned-habit row in one transaction, closing off the two-client ambiguity at the only point that can actually enforce it — the database, not client conventions.

---

## Finding 4 — AD-6 bars computing "rank," not "period boundaries" — the WhatsApp share card's loophole

AD-6's rule, read literally: *"ranking is a Postgres view/function... Neither client computes its own ranking; both read the same ranked result."* Its *prevents* clause names the actual risk: *"the existing TypeScript `progress()` logic (period bounds, manual-vs-imported precedence) and an independent Swift reimplementation diverging on edge cases (DST boundaries, period rollover, etc.)."* Note the rule is narrower than the rationale: it forbids computing *rank*, not computing *period bounds* — and period bounds are precisely the thing called out as the danger.

**Unit A — the server-side ranking view, built to AD-6's letter.** It ports `periodBounds()`/`targetOn()`/`dailyValue()` from `lib/domain.ts` verbatim into SQL, correctly handling each member's own `profiles.timezone` (`habits`/`entries` carry no timezone of their own; "today" for period-bounds purposes is necessarily evaluated per-member).

**Unit B — `ChallengeShareCard.swift`, built to be instant (a WhatsApp share sheet shouldn't block on a round trip).** It already has the member's rank and value in hand from the last leaderboard fetch (satisfying AD-6 to the letter — it reads, never computes, the rank). But the share copy wants a line like *"2 days left — catch up!"*, so it computes `periodBounds(today, habit.period)` **locally in Swift**, reimplementing exactly the logic AD-6's rationale warns against, because AD-6's *rule* text never actually says "don't reimplement period-bounds arithmetic on the client" — only "don't compute rank." This is enforceable-on-paper (an architecture reviewer checking AD-6 compliance sees "client reads server rank, doesn't rank itself" ✓) with a real loophole (the client still reimplements the exact DST/period-rollover-sensitive arithmetic AD-6 exists to prevent duplicating) — and because the share card runs at point-of-share using `Date()` on the device's clock/timezone while the server computed its bounds using the member's stored `profiles.timezone`, a traveling user (device timezone ≠ stored `profiles.timezone`) gets a share card whose "days left" disagrees with the leaderboard's own period boundary for the same challenge.

**Close the hole with:** reword AD-6's rule to cover "any period/target arithmetic that determines progress or standing," not just the final rank ordering, or — better — have the ranking view/function also expose `period_start`/`period_end`/`seconds_remaining` as columns so no client, including the share card, ever has a reason to compute them.

---

## Finding 5 — AD-6 ("server-side ranking") and the Deferred "Realtime subscriptions" option are jointly unsatisfiable by any one implementation

The Deferred section explicitly punts: *"Realtime leaderboard updates (Supabase Realtime subscriptions vs. pull-to-refresh) — either fits AD-6 without changing it; pick at implementation time."* This is presented as a free choice. It isn't.

**Unit A — the leaderboard ranking artifact, built to AD-6's letter ("a Postgres view/function").** Supabase Realtime's `postgres_changes` channel streams row-level WAL events from **physical tables** added to a publication; it has no mechanism to subscribe to a view's or function's recomputed output — a view generates no WAL of its own, there is nothing to replicate.

**Unit B — the iOS Leaderboard screen, built to the Deferred section's letter, choosing "Realtime subscriptions" over pull-to-refresh** for the live, snappy competitive feel the feature is supposed to deliver. Since it cannot subscribe to the ranking view (Unit A), the only way to get "live" updates via Realtime is to subscribe directly to `entries`/`habits` INSERT/UPDATE events for the challenge's members and derive an updated order *on the device* from the raw deltas as they arrive, falling back to a full re-fetch of the server view only periodically.

**The collision:** Unit B, built to satisfy a choice the spine itself calls equally valid, can only deliver what it promises by doing the exact thing AD-6 forbids — "neither client computes its own ranking" — the moment a Realtime event arrives and the UI needs to reflect it before the next poll of the real ranking view. The Deferred section and AD-6 look independent in the document but are not independent in implementation; whichever engineer picks "Realtime" first silently reopens AD-6.

**Close the hole with:** resolve the Deferred item now, not later — state plainly that Realtime, if used, only triggers a re-fetch of the ranking view/function (never informs client-side order directly), or drop Realtime from the option set and standardize on pull-to-refresh / polling the view.

---

## Summary Table

| # | Unit A | Unit B | AD(s) each honors to the letter | Incompatible outcome |
|---|---|---|---|---|
| 1 | iOS `HealthKitSync.swift` writes `entries` as authenticated user | Frozen `entries_insert` RLS (`source_key='manual'` only) | AD-4 / AD-1 | Every HealthKit write is RLS-rejected; AD-5's "guaranteed foreground sync" never lands a row |
| 2 | Existing Habit editor/delete (Today) | Leaderboard ranking view + AD-2's "same targets" invariant | AD-1 / AD-2, AD-6 | Member edits deflate their own target to win; or deletes the habit, silently exiting the challenge and erasing their own entry history |
| 3 | Web "Create Challenge" (auto-joins creator) | iOS "Create Challenge" (creator is host, not racer) | AD-2 / AD-3 | Same action produces different member counts and creator visibility depending on which client created the challenge |
| 4 | Server ranking view (ports `periodBounds`) | `ChallengeShareCard.swift` locally recomputing "days left" | AD-6 (rank only) | Share card and leaderboard disagree on period end for travelling users; reintroduces the exact DST/timezone divergence AD-6 exists to prevent |
| 5 | Server ranking view/function | iOS Leaderboard using Realtime subscriptions (per Deferred) | AD-6 / Deferred section | Realtime can't observe a view's output; a "live" implementation is forced into client-side rank derivation, violating AD-6 |

---

## Note on scope

Two more minor seams were noticed but are already self-acknowledged by the spine's own Deferred section ("Challenge lifecycle detail... left to story-level detail") and so aren't counted as new findings: there is no `leave_challenge()` function at all in the draft migration, and `challenges.ends_on` is nullable with no job that does anything when it passes. Both will intersect with Finding 2's ownership problem once built, and should be designed together with this review's recommended fix, not independently.
