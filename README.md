# Motion

A private accountability app for two people. Built with Next.js, React, Supabase Auth/Postgres and Vercel, with server-side WHOOP v2 OAuth and activity sync.

## What works

- Today: quick check-ins, editable daily totals, undo, backdating, daily/weekly/monthly targets, maximum limits, grouped daily essentials, habit creation, pause and visibility.
- Together: single-use expiring invitations, a two-person circle, shared progress and encouragement. Leaving immediately revokes mutual access.
- Goals: quantities, currencies/units, target dates, milestones, private/shared visibility and completion.
- Review: weekly progress and private written reflections.
- You: palette, timezone, WHOOP controls, habit library and personal export.
- Three atmospheric colour families, original generated artwork, save feedback, responsive layouts and reduced-motion support. Meaningful statuses always have text.
- Explicit demo mode with device-local persistence and example friend data. It is separate from real accounts.

## Current delivery status

Recovered the exact original source from the Build Accountability App conversation on 27 September 2026. The archive checksum was verified before extraction.

Source repository: https://github.com/johannsingh/motion. The current app is deployed at https://motion-accountability.vercel.app; the local development server uses http://localhost:3000. Both use the existing Motion Supabase project in London (`venujhemegflfiszhtec`). No database migrations were rerun. The production URL returns HTTP 200 and displays the account sign-in screen.

The September delivery passed 16 domain, database privacy, and WHOOP security tests; eight desktop/mobile demo journeys; six responsive/accessibility checks; TypeScript; and a production build. Mobile and desktop share the wordmark, artwork and five navigation destinations. See `docs/ui-system.md` for the current design system and verification scope.

Supabase Site URL and the exact production/local callback URLs are configured and verified after a dashboard reload. Still pending: test real signup/sign-in, confirmation email delivery, and two-person sharing. WHOOP developer credentials and the server-only Supabase key are not configured, so live WHOOP is not ready. CI runs on pushes to main and pull requests. Deployment requires manual dispatch and configured secrets; automated repair remains opt-in. See `docs/local-handoff.md` and `docs/cloud-state.json`.

## Run locally

Requires Node 22+.

```sh
git clone https://github.com/johannsingh/motion.git
cd motion
npm ci
npm run dev
```

Open http://localhost:3000. Without Supabase configuration it opens the clearly labelled demo. To use accounts, copy `.env.example` to `.env.local`, fill the values and restart. Never commit `.env.local`.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests exercise demo mode against a production build on port 3001. They enter the demo explicitly when public Supabase variables are present; cloud account tests are a separate deployment acceptance step. A restricted runner can set `CHROMIUM_PATH` to an installed Chromium binary.

## Existing database and new environments

The existing Motion database is already provisioned. Do not recreate it or rerun its migrations. The following steps apply only when intentionally setting up an independent environment.

1. Create a Supabase project in a suitable region. Keep email confirmation enabled and anonymous sign-in disabled.
2. For a new environment, apply every SQL file in `supabase/migrations/` in filename order, or use Supabase CLI linking and `db push`. Both migrations are already applied to the Motion project. Do not rerun them over existing tables.
3. Set Auth Site URL to the final Motion domain. Add `https://YOUR_DOMAIN/auth/callback` and the localhost callback as allowed redirects. Configure custom SMTP before relying on invitations/sign-up emails for regular use.
4. Add the project URL and publishable key to the two `NEXT_PUBLIC_SUPABASE_*` variables. Add the service-role secret as `SUPABASE_SERVICE_ROLE_KEY` on the server only.
5. Create two test accounts and check the full pairing/visibility journey on the deployed app. Run Supabase advisors before production use.

Every personal table has RLS. Shared progress is authorized through current circle membership and per-record visibility. Entries have a compound owner/habit foreign key. Raw provider tokens and connections are inaccessible to browser roles. Helpers live in a non-exposed private schema; public pairing RPCs are invoker wrappers over private functions with explicit permissions and ownership checks. Server-only import RPCs are restricted to the service role.

## Vercel deployment

For the existing app, link the existing `motion-accountability` Vercel project. Create a new project only for an independent deployment. Framework: Next.js; root: this folder; install: `npm ci`; build: `npm run build`. Do not publish an unconfigured deployment as a working shared app: it will display demo mode.

```sh
npx vercel@60.1.3 login
npx vercel@60.1.3 link
npx vercel@60.1.3 env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel@60.1.3 env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel@60.1.3 env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel@60.1.3 env add APP_URL production
npx vercel@60.1.3 deploy --prod
```

`APP_URL` must equal the canonical domain, including https and no trailing path. It protects write endpoints against cross-origin requests and constructs trusted OAuth redirects. Assign the domain before final deployment; update Supabase and WHOOP redirects to match. Use separate preview environment variables and a separate Supabase project for any account-enabled previews. Never give repair-branch previews production credentials.

## WHOOP setup

Create an app in the WHOOP developer dashboard. Configure:

- Redirect: `https://YOUR_DOMAIN/api/whoop/callback`
- v2 webhook URL: `https://YOUR_DOMAIN/api/whoop/webhook`
- Scopes: `offline read:profile read:sleep read:workout`
- Server secrets: `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`.

Generate a 32-byte base64 encryption key with `openssl rand -base64 32`. Keep it in your secret manager; changing it without re-encrypting stored tokens requires reconnecting WHOOP. Generate a separate random cron secret. Do not prefix any of these secrets with NEXT_PUBLIC.

Each person connects their own WHOOP account in You. The callback starts a sync; Sync now retries if needed. Vercel Cron runs daily at 07:00 UTC on production; signed webhooks handle changes between reconciliations. Cron processes two accounts per invocation, matching this app's two-person scope. It must be redesigned before expanding to many circles.

Imports: primary sleep (not naps), actual light + slow-wave + REM duration assigned to wake-up day; running/trail running; weightlifting, strength trainer, functional fitness and powerlifting mapped to Gym. Other workouts can be logged manually. Recent 28-day sync paginates fully before atomically replacing imported values. Targeted webhooks also handle older activity updates/deletions. A manual daily total overrides imported totals; removing it restores WHOOP values. Replayed events do not double-count. Refresh tokens rotate under a database lease and are AES-256-GCM encrypted at rest. Disconnect revokes WHOOP access and removes tokens while retaining imported history.

The live provider flow is not verified until real app credentials and a consenting WHOOP account are available. Do not mark this integration production-verified based only on mocked/local tests.

## CI, deployment and repair agent

`.github/workflows/ci.yml` runs type checks, calculation and database privacy tests, a production build, and desktop/mobile browser journeys on PRs and main.

`.github/workflows/deploy.yml` deploys main only on manual dispatch after checks pass. Configure the `production` environment and `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets. Add required reviewers if desired. Disable Vercel's automatic Git deployments when using this workflow, so agent branches cannot deploy with production secrets.

`.github/workflows/repair.yml` is opt-in. Set repository variable `MOTION_REPAIR_ENABLED=true`, `REPAIR_MODEL` to a structured-output-capable OpenAI model available to your project, and secret `OPENAI_API_KEY`. Set an API project budget. The workflow:

1. Responds only to failed CI on trusted main pushes, never fork or PR code.
2. Sends bounded CI logs and an explicit source allowlist to the model. No production data or deployment secrets are provided.
3. Produces one candidate of at most four existing UI/domain files; auth, SQL, dependencies, CI and tests cannot be edited.
4. Tests the candidate in a separate job without provider or repository-write secrets.
5. A fresh publishing job applies the original immutable candidate and opens a draft PR only if main is unchanged.

It never merges or deploys. A failure outside its scope ends without a proposal. Generation is API-backed; the workflow has not been live-executed without a configured key/repository. Protect main and require CI plus human review. GitHub must permit Actions to create PRs.

## Product decisions still open

- Running defaults to 3/week; change to 4 if desired.
- AI practice defaults to 30 minutes daily. Job strategy is 60 minutes weekly.
- Reading or journaling counts toward one 15-minute daily target.
- “40 pints/month” is deliberately unconfigured until its meaning and direction are confirmed.
- “Clipping 2k/month” needs its measure/currency defined; create a monthly custom habit or quantity goal.
- Completing the budgeting app fits a milestone goal; no bank-account integration is included.
- Phone-free mornings and doomscrolling are manual. A web app cannot read iOS Screen Time. Native device permissions require a later mobile app.
- Reminders, push notifications and focus timers are later additions. The app currently records minutes directly.
- Habit targets take effect next day/week/month; periods start Monday and use the profile timezone. History retains previous targets. Timezone changes affect future imports; existing manual dates remain as entered.
- No global score, health advice, punitive streak resets or mood inference from colour.

## Design and journey map

`docs/product.md` captures screen flows, state rules and architecture. `motion-desktop.png` and `motion-mobile.png` show the verified demo UI. Original colour artwork is in `public/motion-field.png`.
