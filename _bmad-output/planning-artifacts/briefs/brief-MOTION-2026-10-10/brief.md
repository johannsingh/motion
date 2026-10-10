---
title: Product Brief: Motion
status: final
created: 2026-10-10
updated: 2026-10-10
---

# Product Brief: Motion

## Executive Summary

Motion is a mobile habit-tracking app that turns personal accountability into a friendly competition. Instead of logging habits alone and hoping willpower holds, friends commit to the *same* habit together, and Motion settles who's actually doing it — automatically, by pulling data from Apple Health and Whoop, not by asking people to self-report or send a photo as proof.

The idea came out of a real problem: the founder and a friend had no shared way to stay motivated or hold each other accountable to habits they both cared about. Turning it into a head-to-head competition, with a shared leaderboard and the ability to rib each other about it (including via a WhatsApp link), made the accountability stick in a way solo tracking apps don't.

This starts as a passion project — an MVP the two of them can play with their friend group within the week — but with an eye toward something bigger: a real app-store product, if the core loop proves fun enough to spread past the founding group.

## The Problem

People set habit goals constantly and abandon most of them — not for lack of knowing what to do, but for lack of someone watching. Solo habit trackers (streak counters, checklists) rely entirely on self-discipline and self-reported honesty; nothing changes when you miss a day except a private streak reset nobody else sees.

Group accountability apps exist, but the closest ones still rely on manual proof — typically a photo — to confirm you did the thing. That's friction, and it's gameable: a photo proves you have a device, not that you ran 10k. The founders felt this gap directly: they wanted to compete with each other on real habits and didn't trust a manual honor system to carry it.

## The Solution

Friends agree to do the *same* habit — same activity, same target — so everyone's on identical footing instead of comparing apples to oranges. Motion tracks progress automatically wherever possible, by connecting to Apple Health and Whoop, rather than relying on manual check-ins. Progress feeds a shared leaderboard or head-to-head view, and a WhatsApp-linked sharing flow lets friends send results (and trash talk) straight into the group chat they already use.

The bet is that automatic, hard-to-fake verification plus a real competitive format (not just encouragement emoji) is what makes the accountability loop actually bite.

## What Makes This Different

The closest existing product, Pact (Pact Boys), already proves the core format works: friends commit to a shared habit, group streak, roast-and-cheer social layer. But Pact's proof mechanism is manual (a photo), which is both friction and an honesty gap.

Motion's differentiator is **automatic verification** — plugging directly into Apple Health and Whoop so results update without anyone lifting a finger to prove anything. This is an execution and integration bet, not a secret-sauce algorithm: if Motion ships reliable auto-tracked competitions before anyone else nails the integration layer, that is the advantage. It is not a defensible long-term moat on its own — a well-resourced competitor (or Pact itself) could build the same integrations.

## Who This Serves

**Primary user, v1:** the founders' own friend group — people who already text/WhatsApp each other and would enjoy ribbing one another over who's slipping on a shared goal (steps, workouts, recovery metrics via Whoop, etc.). Success for them looks like: low-effort setup, a leaderboard that feels fair because everyone's doing the literal same thing, and banter that actually makes it into their existing group chat.

**Secondary/future:** broader app-store users who want a more competitive, socially-driven alternative to solo habit trackers — once the friend-group pilot validates the loop.

## Success Criteria

Since this is a passion-project MVP, success for v1 is binary and close to home:

- The founder's friend group actually uses it for at least one shared habit challenge, with automatic (not manual) progress updates.
- At least one habit challenge runs to completion with a working leaderboard/head-to-head view.
- The WhatsApp share/trash-talk flow gets used unprompted by the group, not just on launch day.

If those hold, the next bar is whether the loop survives past novelty — i.e., the group picks a second habit challenge without being asked.

## Scope

**In for v1 (target: playable by end of this week):**
- Shared habit commitment: friends join the same habit/challenge so progress is directly comparable.
- Automatic progress tracking via Apple HealthKit and the Whoop API (pilot-scale; Whoop's developer access is capped and gated, which is fine for a single friend-group pilot).
- Leaderboard or head-to-head view of progress.
- A way to share results/trash talk into WhatsApp.
- Mobile app, iOS first — HealthKit is iOS-native and the one-week timeline favors a single platform; Android is a later decision once the pilot validates.

**Explicitly out for v1:**
- Screen Time / digital-wellbeing integrations. Apple's Screen Time APIs (and every third-party screen-time app built on them, e.g. Opal, One Sec) sandbox usage data with no export path — there is currently no legitimate way to pull comparable cross-user screen time data automatically. Screen time stays a phase-2 idea, possibly via manual/self-reported entry, not a committed integration.
- Web app — deferred past v1 given the one-week target and two-person team; revisit once mobile is validated.
- Matchmaking with strangers — v1 is friend-group only, no public/stranger competition.
- Monetization mechanics — v1 ships free; a paid tier is a post-pilot decision, not designed yet.

## Risks & Open Questions

- **Timeline vs. scope tension:** "playable by end of the week" alongside two automatic integrations (HealthKit + Whoop) and a WhatsApp share flow is tight for a two-person team, even with a dev/design background on one side. Worth a quick gut-check on which single integration ships first if the week gets tight.
- **Whoop access is gated**, not open: fine for a friend-group pilot (dev access starts capped at a small number of members), but scaling past the pilot requires Whoop's manual approval, with reports of long wait times. Don't promise Whoop as a flagship integration beyond pilot scale without accounting for this.
- **HealthKit is device-side only** — no backend polling or bulk export — so sync has to happen from each person's phone, which shapes the technical approach even at MVP scale.
- **Leaderboard fairness** is the most common complaint in every comparable (Strava, Fitbit challenges, group fitness apps) even when habits are matched — baseline fitness, device accuracy, and life circumstances still create mismatches. Matching the *habit* (not the baseline) solves the obvious version of this but not all of it; worth watching once real usage starts.
- **Novelty decay** is the pattern that killed or shrank several comparables (BeReal's DAU collapse, Habitica's gamification fatigue). The WhatsApp trash-talk loop and shared-habit format are the current answer; whether that's enough to survive past the first few weeks is unproven and worth tracking once the pilot is live.
- **Monetization** is genuinely undecided beyond "free, then paid later" — not a gap to close now, just flagged as open.

## Vision

If the friend-group pilot proves the loop — automatic verification plus real competition beats manual honor-system accountability — Motion becomes a general-purpose app for competing on habits with anyone you know, not just the founding group: more integrations (wearables beyond Whoop, more granular Health data), more challenge formats beyond head-to-head, and eventually a path onto the app stores for people outside the friend circle. The founders haven't committed to monetization or growth mechanics yet, deliberately — the near-term goal is proving the core loop is genuinely fun before deciding what "bigger" means.
