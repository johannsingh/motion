# Motion — laptop handoff

Updated 27 September 2026.

## Recovered source

The original `motion-source.zip` was recovered by messaging the existing **Build Accountability App** conversation, then downloading its authenticated Library attachment through Arc. It was not reconstructed.

- Original downloaded file: `Motion Source.zip` (original local download)
- SHA256: `66ce71e8dae63bc5753196c1c9708f7d06c12b23bbe357c61aa343b740e1672d`
- Project: the repository root
- Local app: http://localhost:3000
- Production app: https://motion-accountability.vercel.app
- Vercel project: `motion-accountability`

Run `npm run dev` in the project directory if the local server has stopped. Dependencies are already installed.

## Existing services

Supabase project `venujhemegflfiszhtec` is healthy in London (`eu-west-2`). Both existing migrations remain in place; none were rerun. The URL and publishable key are configured in the ignored local environment file and in Vercel production. Production `APP_URL` is `https://motion-accountability.vercel.app`; local `APP_URL` is `http://localhost:3000`.

Email authentication is enabled, email confirmation is required, and anonymous sign-in is disabled. A read-only request to the live authentication settings endpoint succeeded.

## Verified in this task

- Exact source archive checksum matched.
- `npm ci` completed.
- All 16 domain, local database privacy, and WHOOP security tests passed. Database tests use an isolated in-memory database.
- All eight desktop/mobile demo browser journeys passed.
- TypeScript and local production build passed.
- Vercel production build completed and deployment reached READY.
- Production homepage returned HTTP 200 and the account sign-in screen rendered in a browser.
- Unauthenticated account-data and export requests were rejected.
- Production dependency audit reported zero vulnerabilities.

Demo browser checks do not verify real account creation, confirmation emails, two-person sharing, or WHOOP consent.

## Authentication redirects configured

Supabase dashboard settings were saved and verified after reloading the page:

- Site URL: `https://motion-accountability.vercel.app`
- Allowed callback: `https://motion-accountability.vercel.app/auth/callback`
- Allowed callback: `http://localhost:3000/auth/callback`

No existing redirect entries were removed. Email confirmation remains enabled. The production callback without a code returns HTTP 307 to the production homepage with `auth_error=1`, as expected.

Next, verify a real account's confirmation email and sign-in, then two-user pairing, habit persistence, private reflections, and leaving the circle. SMTP configuration should be reviewed before regular use by both users. These real-account checks have not yet been completed.

## Remaining WHOOP and CI work

WHOOP backend code is included, but these server-only settings are not yet configured: `SUPABASE_SERVICE_ROLE_KEY`, `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `CRON_SECRET`.

The final WHOOP callback is `https://motion-accountability.vercel.app/api/whoop/callback`; the webhook is `https://motion-accountability.vercel.app/api/whoop/webhook`. Configure the developer app, securely provision its credentials, and test real consent, sync, refresh, webhook updates, and disconnect before describing the integration as working.

GitHub CI and optional repair-agent workflows exist in the source. No new GitHub repository was created and no workflow credentials were provisioned in this task.

Do not commit `.env.local` or `.vercel/`; both are ignored. Do not recreate the Supabase project or reapply its existing migrations.

## UI review fixes — 27 September 2026

All 17 grouped UI findings were addressed and deployed to the existing production URL. See `docs/ui-system.md` for tokens, responsive behaviour and verification. Production deployment: `dpl_wybpKUujJLLhaVb6Q2uMxYMJ6jXE`. Checks: 16 logic/privacy/security tests, 8 demo browser journeys and 6 UI regression checks, plus production build and typecheck. Browser regression tests run the production build on port 3001. No database migration or account configuration changed. Native iOS Safari and real-account integration acceptance remain separate checks.

## Mobile visual parity follow-up

Restored the shared dotted wordmark, hero artwork, two-line heading treatment and all five navigation destinations on phones. The existing images sit below opaque copy to retain contrast. Readable text, touch targets and one-column cards remain. Build/typecheck and all 14 browser checks passed, including explicit mobile artwork/logo and navigation checks. Production deployment: `dpl_Eqd2iWc1Etex92BvtRi68Zp9pLA3`.

## GitHub source repository — 10 October 2026

The current application source is stored in `https://github.com/johannsingh/motion` on `main`, preserving the existing starter commit. Local credentials, Vercel linkage files, dependencies, builds and generated screenshots are excluded. Deployment and repair credentials must be configured separately; this source import does not change the database or production deployment.

Fresh-checkout validation on 10 October 2026: dependency installation, type generation/typecheck, 16 unit/privacy/security tests, production build and 14 browser checks passed without local credentials. Six duplicate mobile-project UI runs are intentionally skipped. The install audit reports 5 affected dependency packages: Next.js and source-map-js (high), Vitest and tinypool (critical, test tooling), and @vitest/mocker (moderate, test tooling). Dependency versions were preserved for the repository import; remediation remains a separate follow-up.
