# Motion product and architecture

## Brand

Motion is warm, fluid and personal. Cream holds the interface; apricot/coral and optical blue supply energy; restrained plum typography keeps controls readable. Fluid shapes represent movement and mutual support, not people or clay objects. The original generated field is used as a real app asset.

| State          | Visual response                               | Explicit meaning                       |
| -------------- | --------------------------------------------- | -------------------------------------- |
| Rest           | Soft cream and selected colour family         | No judgement or urgency                |
| Focus          | Gentle focus outline and local colour glow    | This control has focus                 |
| Saved          | Brief ambient bloom plus text toast           | The save succeeded                     |
| Target reached | Lavender surface, check and label             | The recorded amount met its target     |
| Maximum limit  | Progress shows amount used; separate label    | Within limit or above limit            |
| Missing        | Neutral card, “Not logged yet”                | Unknown, never assumed failure/success |
| Together       | Paired colour fields and readable shared rows | These records are deliberately shared  |

User-selectable families: Apricot & violet, Aqua & indigo, Rose & butter. Changing atmosphere never changes the meaning of a status. Respect reduced-motion settings. UI remains crisp over the gradients.

## Jobs and journeys

| Job                           | Route                      | Interaction and outcome                                                |
| ----------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| Know what matters today       | Today                      | Daily essentials plus habit cards; select week/month/category          |
| Record progress quickly       | Card → check-in dialog     | Toggle a boolean, or set a daily total; saved feedback; undo available |
| Correct yesterday             | Date selector → card       | Edit a past daily total; historical target retained                    |
| Keep a commitment realistic   | Habit menu → edit          | Rename, pause, change sharing or set next-period target                |
| Support my friend             | Together                   | Read only shared progress, send a short note or quick cheer            |
| Pair privately                | You → invite/join          | Generate a one-use link, share it yourself, friend signs in and joins  |
| Advance a larger goal         | Goals → new/edit           | Track quantities and milestones, set date and visibility               |
| Reflect without oversharing   | Review                     | Write wins and adjustments privately                                   |
| Reduce manual fitness logging | You → WHOOP                | Consent in WHOOP, import relevant totals, show sync/reconnect status   |
| Make this space mine          | You                        | Change name, colour family and timezone                                |
| Leave a partnership           | You → leave → confirmation | Remove shared access/messages, preserve both users’ personal records   |

First visit: Sign in or create account → confirm email → select starting habits/name/colour → Today. Demo is a separate, explicitly marked path. Invites are retained during sign-in; You → Invite or join shows the pending invitation. Desktop has Today/Together/Goals/Review/You navigation. Mobile exposes the same five destinations, including Review, in its bottom navigation.

## Architecture

Browser → same-origin Next.js API → authenticated Supabase client → RLS-protected Postgres. The browser receives only its own records and the friend's currently shared records. The browser never receives service-role credentials or WHOOP tokens.

WHOOP consent → server callback validates one-time state and signed-in identity → encrypted connection → v2 API. Signed webhooks and authenticated cron use restricted server functions. Manual and imported entries remain separate; calculations select the manual daily total when present. Reconciliation replaces an entire fetched window transactionally.

Main entities: profiles, habits, entries, goals, reviews, circles/memberships, hashed invitations, encouragement messages, encrypted provider connections. Target versions are stored with effective dates. Imports are keyed by source identity. Two-person joins use database locks to prevent a third member.

## Delivery gates

Local tests cover periods, daylight saving boundaries, manual overrides, maximum-limit semantics, WHOOP mapping/signatures/encryption, SQL privacy boundaries, pairing and import retries. Browser journeys cover desktop/mobile demo interactions. Cloud acceptance must still cover confirmation email, real sessions, two devices, production RLS, WHOOP grant/refresh/revoke, live webhook retries and cron logs. CI repair is opt-in and restricted to tested draft PRs.
