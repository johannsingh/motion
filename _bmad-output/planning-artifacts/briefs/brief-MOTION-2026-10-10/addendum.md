# Addendum: Motion

Supporting research and depth that informed the brief but didn't belong in its lean form. See `brief.md` for the brief itself and `.memlog.md` for the decision trail.

## Competitive Landscape — Full Research Digest

Researched 2026-10-10 to ground Motion's positioning and integration feasibility.

### Direct and adjacent comparables

- **Pact / Daily Pact** — closest direct comparable. 3–10 friends agree on the *same* habit; group streak resets if anyone fails (unless they spend a wildcard); "cheers and roasts" reactions; kick-votes for ghosters. This is Motion's core loop, already shipping at small scale. Free up to 3 pacts. Proof mechanism is manual (typically a photo) — this is the specific gap Motion's auto-verification targets.
- **HabitShare** — shares individual (not necessarily identical) habits with friends; sends gifs (high-five, chest bump) for encouragement. Low-friction social layer, no real competition/leaderboard. Useful contrast point: accountability vs. competition as distinct design choices.
- **StepBet/DietBet (Appex)** — money-pool model: stake cash, hit a personalized target, split the pot among everyone who succeeds (non-winner-take-all). Lesson: financial stakes plus a non-zero-sum payout structure drives completion; 2–6 week challenge windows balance urgency against burnout.
- **Strava** — segments/kudos/leaderboards are the gold standard for social-fitness virality: kudos-driven visibility flywheel (engagement → algorithmic push → followers), "local legend" status sustains repeat engagement on specific segments. Risk: leaderboards reward people with more free time/better gear, breeding resentment among casual users. Currently valued at ~$2.2B.
- **Duolingo** — leagues + streak-saver notifications cut churn from 47% to 28%; ~80% of growth is organic/viral. Lesson: loss-aversion mechanics (streak freeze, league demotion) outperform pure positive reinforcement.
- **Habitica** — RPG framing (parties, bosses, HP/XP) for accountability. Common complaints: streak data loss on sync/reinstall, paywalls mid-flow, gamification fatigue, notifications that spam or go silent. Cautionary notes for notification design.
- **Finch** — virtual pet that reacts to your care; 4.59★, 82% positive. Shows non-competitive emotional hooks can outperform competitive ones for retention, but still vulnerable to data-loss/support complaints.
- **BeReal** — cautionary tale. DAU collapsed from ~15M (Oct 2022) to <6M (Mar 2023) as the daily ritual became monotonous and notification fatigue set in. Novelty-driven social mechanics decay fast without deepening utility over time.
- **Fitbit Challenges** — Google discontinued Fitbit's group challenges/community features (March 2025) during the Google-account migration — a live example of platform fragility when a core loop depends on a hardware vendor's continued support. Also recurring complaints about step-count discrepancies between devices making challenges feel unfair, and users with physical limitations dropping out of pace-based competitions.
- **Step App** (move-to-earn) — shut down Aug 2026 despite 1M+ downloads; token-economy incentives didn't sustain engagement once crypto rewards lost value. Warns against financializing the core loop without a durable non-token hook.
- **WeWard** — streak-flame visual for "validated" steps; simple, but shows GPS/step verification is now a baseline users expect to prevent gaming.

### Funding climate (context, not a v1 concern)

Fitness-app VC funding fell to $1.26B in 2024 (lowest in 5 years, down from $6.27B in 2021), but social-fitness specifically still gets backing — Sweatpals raised a $12M seed (Oct 2025), Strava is valued at $2.2B. Reading: pure tracking apps aren't differentiated enough alone; the social/competitive angle is still the fundable wedge, if it ever gets there.

## Integration Feasibility — Detail

- **Whoop API**: v2 API (July 2025) with proper OAuth scopes (recovery, cycles, sleep, workout, body_measurement, profile). Dev access starts capped at 10 members; scaling beyond requires Whoop's manual approval, with community reports of 60+ day waits and no guaranteed SLA. Fine for a friend-group pilot; do not promise it as an open flagship integration at scale without planning around this bottleneck.
- **Apple HealthKit**: works well for a native iOS app (standard entitlement, per-data-type user consent) but has no server-side/remote API — no bulk export, no cloud polling. Data only flows device-side, which shapes the sync architecture (client-driven, not backend-polled). Apple also explicitly bans selling/exporting HealthKit data to ad platforms.
- **Google Health Connect**: Google Fit is being deprecated/replaced by Health Connect (on-device, encrypted, local storage). Google separately announced a broader "Google Health" API (2025) opening cross-device data (including Fitbit/Pixel Watch) to authorized third parties, positioning it to compete with HealthKit. Worth re-checking terms if/when Android becomes a priority.
- **iOS Screen Time (Family Controls / DeviceActivity / ManagedSettings)**: confirmed not viable for Motion's purpose. Since iOS 16, Family Controls can authorize an individual's own device, but the API intentionally returns only opaque tokens for selected apps/websites — no way to identify which app was used or get comparable usage-category data across users. No network access inside the DeviceActivity extension; reliability issues reported (45+ minute delays); unaddressed as of WWDC 2026 betas.
  - Follow-up check specifically on third-party screen-time apps (Opal, One Sec, ScreenZen, Jomo) as a possible workaround: **no viable path exists**. These apps are themselves thin UIs built on Apple's own restricted APIs, not independent data sources. Opal's own community forum confirms screen time data is sandboxed inside an Apple-owned extension and cannot be exported, saved locally, or sent to a server — this is an Apple-imposed restriction that blocks every app in this category identically. No public API or webhook exists from any of them.
  - Practical takeaway: the only viable v1-adjacent paths for a screen-time habit category are self-reported/manual entry, or a manual screenshot-confirm flow (i.e., falling back to exactly the kind of manual proof Motion is trying to differentiate away from). Treat screen time as a phase-2/uncertain category, not a committed integration.

## Risk Patterns Worth Tracking Post-Pilot

1. Leaderboard fairness is the #1 recurring complaint across Strava, Fitbit, and group fitness challenges generally — mismatched baselines (fitness level, device accuracy, disability, time availability) breed resentment and drop-off, even when the activity itself is matched.
2. Novelty decay — BeReal and similar daily-ritual apps show steep DAU collapse once the social mechanic becomes routine. Mechanics that deepen over time (Strava's segment history, Duolingo's league tiers) outlast one that just repeats.
3. Gaming/cheating — manual entry invites fraud; Motion's automatic-pull differentiator is only as credible as its weakest verified data point. Worth validating sources the way WeWard validates steps.
4. Notification fatigue is a top complaint in Habitica/BeReal reviews — loss-aversion nudges (Duolingo-style streak-saver) outperform generic reminders.
5. Platform dependency — Fitbit's challenges were killed by a Google platform decision; Whoop API access is approval-gated and terms could shift. Don't single-source the core loop to one wearable API long-term.
