# Motion UI system

The cream, apricot, blue and plum identity remains. Decorative colour families
are independent of semantic text, controls and status. Components use the
shared tokens in `app/globals.css` rather than individual text colours/sizes.
Desktop is the visual reference for mobile: adapt composition and column count,
while retaining the logo, artwork, colour atmosphere and navigation destinations.

## Tokens

- Type: 12 / 14 / 16 / 20 / 24 / 32 / 48px at the default root size, expressed
  in rem so user font preferences scale the interface. Captions start at 12px,
  labels/actions at 14px, prose and form fields at 16px.
- Text roles: ink, secondary, accent, danger and on-dark. Secondary text is
  `#463a4c`; field borders are `#89778f`. Content cards and fields use opaque
  light surfaces to keep contrast independent of the atmosphere.
- Spacing: 4 / 8 / 12 / 16 / 20 / 24 / 28 / 32 / 40 / 48 / 64px. Structural
  sidebar offsets, visually-hidden utilities, safe areas and optical avatar
  overlap are explicit exceptions.
- Radius: 8px inset, 12px control, 20px card, 24px panel, circular and pill.
- Elevation: floating toast and modal. Cards do not need decorative shadows.
- Icons: Lucide outline, 1.75 stroke, 16 / 20 / 24px by context.
- Motion: ambient crossfade 300ms, save bloom 350ms, hover feedback 200ms.
  Reduced-motion preferences disable these transitions and animations.

## Layout and accessibility

Main actions have at least 44×44px hit areas. Native checkboxes and radios use
larger activating labels. All form fields render at 16px or larger. Mobile
navigation has persistent names and taller controls; tablet navigation names
remain available when visible labels disappear. Dialogs restore focus to their
opening control when they close.

Narrow phones show one habit card per row. Mobile retains the shared wordmark,
coloured dot, abstract hero artwork and two-line headings. Hero artwork sits
below the opaque copy area so contrast remains predictable. Both navigation
layouts expose all five destinations. Together shows the friend first and puts the full self-list inside
“What my friend sees”, after encouragement and shared goals. Narrow form grids
switch to one column. Header controls wrap when text grows.

## Verification

Run `npm run build` before `npm run test:e2e`. Browser tests use the production
build on port 3001 to avoid the development toolbar covering mobile navigation.
Tests enter the demo explicitly when account services are configured and
re-enter it after reload; demo records persist without a real account login.

The UI regression suite checks 320, 390, 768 and 1440px widths, minimum text and
control sizes, navigation names, focus restoration, all three palette contrast
pairs, 200% root text with text-spacing overrides, 640px reflow and reduced
motion. Native iOS Safari and assistive-technology testing on a real device are
still separate from the Chromium checks.
