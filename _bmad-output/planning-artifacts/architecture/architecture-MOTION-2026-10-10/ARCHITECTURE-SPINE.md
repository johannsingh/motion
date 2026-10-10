---
name: 'Motion — Competitive Layer + iOS Client'
type: architecture-spine
purpose: build-substrate
altitude: feature
paradigm: 'thin-client over RLS-enforced BaaS, secrets-mediated'
scope: 'Adding competitive habit-matching (challenges, leaderboard, WhatsApp share) to the existing Motion backend, and a new native iOS client consuming it directly'
status: final
created: '2026-10-10'
updated: '2026-10-10'
binds: []
sources:
  - _bmad-output/planning-artifacts/briefs/brief-MOTION-2026-10-10/brief.md
  - supabase/migrations/20260927165709_motion_initial.sql
  - supabase/migrations/20260927172350_harden_motion_access.sql
  - lib/domain.ts
  - docs/product.md
companions: []
---

# Architecture Spine — Motion: Competitive Layer + iOS Client

## Design Paradigm

Thin-client over a Row-Level-Security-enforced Backend-as-a-Service, with a thin secrets-mediation layer for the one integration (WHOOP) that needs server-held credentials.

- **iOS client** (SwiftUI) — presentation + local device boundaries (HealthKit) only. No business logic that duplicates server-enforced rules.
- **Supabase** (Postgres + RLS + Auth + Realtime) — the single source of truth for data, authorization, and now leaderboard ranking. Both the existing web app and the new iOS app are RLS-equal peers of it.
- **Next.js API** (existing, unchanged in role) — not a general backend; it exists *only* where a secret can't live on a client: WHOOP OAuth code exchange, WHOOP webhook receipt, cron-driven WHOOP sync.

```mermaid
flowchart LR
    subgraph Clients
      Web[Next.js Web App]
      iOS[iOS App - SwiftUI]
    end
    subgraph Secrets[Secret-holding, server-only]
      API[Next.js API routes]
    end
    HK[(HealthKit - device-local)]
    WH[(WHOOP API)]
    SB[(Supabase: Postgres + RLS + Auth)]

    Web -->|same-origin, session-authenticated| API
    API -->|service-role, RLS bypass via function| SB
    iOS -->|supabase-swift SDK, user-authenticated, RLS-enforced| SB
    iOS -->|reads locally, writes as itself| SB
    HK -.->|local read| iOS
    API <-->|OAuth exchange, webhook, cron sync| WH
```

## Invariants & Rules

### AD-1 — Backend of record stays Supabase; extended additively

- **Binds:** all
- **Prevents:** a parallel backend, or a destructive schema rewrite that discards the working auth/pairing/WHOOP system already in production.
- **Rule:** new capability lands as additive migrations (new tables/functions/policies) in `supabase/migrations/`. Existing tables (`pairs`, `memberships`, `habits`, `entries`, `goals`, `messages`, `reviews`, `provider_connections`) are never dropped or redefined by this feature.

### AD-2 — A challenge is one habit definition, cloned per member

- **Binds:** `challenges`, `challenge_members`, leaderboard
- **Prevents:** per-member target drift that would force ratio/percentage normalization to rank fairly. [ADOPTED — user: "everyone should have the same habits in the group."]
- **Rule:** `challenges` holds exactly one `{title, category, period, kind, target, unit}`. Joining a challenge clones that definition verbatim into a new row in the member's own `habits`, tagged via `challenge_members.habit_id`. Ranking never compares across differing targets.

### AD-3 — Clients reach Supabase directly; Next.js is secrets-only

- **Binds:** iOS client, Next.js API
- **Prevents:** a duplicate "mobile API" layer whose contract can drift from Supabase's own RLS-enforced one.
- **Rule:** the iOS app authenticates and queries Supabase directly via `supabase-swift`. It calls the Next.js API only for the three WHOOP operations that require a server-held secret (OAuth code exchange, webhook, cron sync trigger). No new Next.js endpoint may be added solely to serve the iOS app data Supabase could serve directly under RLS.

### AD-4 — Two integration sync mechanisms, by necessity

- **Binds:** WHOOP integration, HealthKit integration
- **Prevents:** a future attempt to build a server-side HealthKit poller — Apple provides no such access.
- **Rule:** WHOOP stays server-pulled (webhook + cron, service-role, as already built). HealthKit is device-pushed: the iOS app reads `HKObserverQuery` results itself and writes `entries` rows to Supabase as the authenticated user. These are different mechanisms serving the same `entries` table — not two ad hoc variants of one.

### AD-5 — HealthKit background delivery is a latency optimization, not the sync path

- **Binds:** iOS HealthKit sync
- **Prevents:** shipping a leaderboard that silently goes stale on devices where background delivery throttles or stalls. [Verified via web research, Oct 2026: `enableBackgroundDelivery` frequency is inconsistent across devices — reports of ~hourly throttling and watchOS 26 delivery silently stopping until restart.]
- **Rule:** `HKObserverQuery` + `enableBackgroundDelivery` registers for opportunistic updates, but every app foreground/launch triggers an unconditional, synchronous HealthKit → Supabase sync. The guaranteed path is foreground sync; background delivery only improves on it when the OS cooperates.

### AD-6 — Leaderboard ranking is computed server-side

- **Binds:** leaderboard / challenge progress
- **Prevents:** the existing TypeScript `progress()` logic (period bounds, manual-vs-imported precedence) and an independent Swift reimplementation diverging on edge cases (DST boundaries, period rollover, etc.).
- **Rule:** ranking is a Postgres view/function joining `challenge_members → habits → entries`, porting the period-bounds and value-precedence rules already proven in `lib/domain.ts`. Neither client computes its own ranking; both read the same ranked result.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Naming (entities, files, interfaces, events) | New tables/functions follow existing snake_case SQL conventions (`challenge_members`, `join_challenge`). Swift types mirror server entity names in UpperCamelCase (`ChallengeMember`), matching the existing TS convention of 1:1 server-entity-to-client-type naming in `lib/domain.ts`. |
| Data & formats (ids, dates, error shapes, envelopes) | UUIDs for all ids (`gen_random_uuid()`), `date` (not timestamp) for the day-granularity fields already used by `entries.day`, ISO-8601 via Supabase's default Postgres↔JSON encoding — no new date format introduced for the iOS client. |
| State & cross-cutting (mutation, errors, logging, config, auth) | All writes go through RLS-checked client calls or `security definer` functions (`join_challenge`, `create_challenge_invite`), mirroring the existing `create_invite`/`accept_invite` pattern — no direct unguarded table writes for multi-step operations. Auth session persistence uses `supabase-swift`'s default Keychain-backed storage. |

## Stack

| Name | Version |
| --- | --- |
| supabase-swift | v2.50+ (verified current, July 2026) |
| Swift | 6.1+ (SDK minimum) |
| Xcode | 16.3+ (SDK minimum); install current App Store release |
| iOS deployment target | 17.0+ (project choice, above the SDK's 16.0 floor — unlocks `@Observable`) |
| UI framework | SwiftUI |
| Existing backend (unchanged) | Supabase Postgres + Auth + Realtime; Next.js (Vercel) for WHOOP secrets-mediation |

## Structural Seed

```text
ios/
  Motion/
    MotionApp.swift          # app entry, Supabase client init, session bootstrap
    Models/                  # Swift structs mirroring server entities (Habit, Entry, Challenge, ChallengeMember, Profile)
    Services/
      SupabaseClient.swift   # single shared client instance (auth + postgrest + realtime)
      HealthKitSync.swift    # HKObserverQuery setup, background delivery registration, foreground sync trigger
      WhoopLink.swift         # thin wrapper calling the existing Next.js WHOOP routes (connect/disconnect/sync)
    Features/
      Today/                 # own habits + check-in (mirrors existing Today job)
      Challenges/            # browse/create/join a challenge, invite-link flow
      Leaderboard/           # ranked view for one challenge, reads the server-side ranking view
      Together/               # existing pairing/support feature, unchanged in shape
      You/                    # profile, WHOOP connect, settings
    Share/
      ChallengeShareCard.swift # builds the shareable result text/image for the native share sheet (WhatsApp target)
supabase/migrations/
  20261010000000_challenges.sql   # draft from this session - review before applying
```

```mermaid
erDiagram
    CHALLENGES ||--o{ CHALLENGE_MEMBERS : has
    CHALLENGE_MEMBERS }o--|| HABITS : clones_into
    HABITS ||--o{ ENTRIES : logs
    CHALLENGES ||--o{ CHALLENGE_INVITES : issues
    PROFILES ||--o{ CHALLENGE_MEMBERS : joins
```

## Deployment & Environments

- **Dev:** iOS Simulator / a device wired to Xcode, pointed at the existing Supabase project (same one the web app uses — no separate dev project).
- **Pilot distribution:** TestFlight internal testing track — up to 100 testers, no App Review wait. Requires enrollment in the Apple Developer Program (paid, ~$99/year) before any build can be distributed beyond a device connected directly to Xcode. **Open question, not yet resolved:** does the team already have an Apple Developer account? If not, that enrollment should start immediately — it can gate the whole "playable by end of week" target independent of how fast the app itself gets built.
- **Production (future):** public App Store release, once the pilot validates the loop — out of scope for this spine.

## Deferred

- **Android client, web parity for the competitive layer** — out of scope per the product brief; revisit once the iOS pilot validates the loop.
- **Screen Time integration** — confirmed not viable (no cross-user export path on Apple's API); stays out.
- **Monetization** — not designed; free for v1.
- **Challenge lifecycle detail** (ending/archiving a challenge, re-matching after a target change, leaving a challenge mid-run) — left to story-level detail; AD-2's "one definition, cloned" rule constrains it but doesn't fully specify it yet.
- **Realtime leaderboard updates** (Supabase Realtime subscriptions vs. pull-to-refresh) — either fits AD-6 without changing it; pick at implementation time based on how much polish the pilot week allows.
- **Testing strategy for the iOS app** — the web app has an established Vitest/Playwright culture; the Swift equivalent (XCTest/Swift Testing for the ranking/HealthKit-mapping logic at minimum) is a story-level decision, not fixed here.
