# Thettracker

A React, TypeScript, and Vite app for displaying game statistics. The settings
page opens a tracker window containing the selected widgets.

## Versions and Bookmarks

The start page has two independent configuration sections: **v0.1.0-preview**
above **v0.0.43-legacy**. Factory settings enable all eight widgets; preview can
restore explicitly saved launcher defaults. Both launch a resizable 600x600
tracker window. Changing one section does not change the other.

Existing bookmarks continue to open the exact legacy tracker, without redirects:

```text
<baseurl>/index.html?tracker=true&checkCount=true&bonks=true&chestTurns=true&deaths=true&rupees=true&screens=true&damage=true&magic=true&boxes=4
```

Preview bookmarks explicitly select the stable API version and contain their widget
configuration, including disabled widgets. Older links without appearance
settings retain the original colors and inherited timer font:

```text
<baseurl>/index.html?tracker=true&version=2&checkCount=true&bonks=false&chestTurns=false&deaths=false&rupees=false&screens=false&damage=false&magic=false&boxes=1
```

Only literal `tracker=true` opens a tracker. New tracker links use `version=2`.
This is the URL API version, independent of visible release labels such as
`v0.1.0-preview`; minor and patch releases do not change it. Existing
`version=0.1.0-preview` links remain supported as a compatibility alias. Absent,
empty, legacy or unrecognized versions select legacy. Flags enable only for
literal `true`, repeated keys use
their first occurrence, and missing `boxes` defaults to `3`. Existing legacy
query parsing and launch URL generation, including malformed parameter behavior,
remain unchanged. URLs work relative to the deployment directory.

New preview launches also include a complete `appearance` query parameter.
The URL configures widget visibility, columns and preview appearance, not live
counters or elapsed time. Trackers never read or write browser storage, and
there is no progress persistence.

### Preview Appearance and Defaults

The preview section offers a timer color swatch, a font menu and a passive timer
sample. Fonts are Current (the original inherited stack), IBM Plex Mono,
JetBrains Mono, Space Mono, Bungee, Audiowide and Monoton. Only the timer font/color changes; metric text,
buttons, timer size, weight and shadow retain their existing presentation.

Each metric's palette button expands its three or five editable color stops.
Thresholds and rate units remain fixed. Checks shows both the normal scale and
the scale for more than 400 maximum checks. The ramp strip previews the palette;
tracker tiles remain solid colors interpolated from the current rate, with the
same color on rate text. Disabled metrics keep their palettes and remain editable.

- **Launch** uses the current draft, including unsaved edits, without saving it.
- **Save Defaults** explicitly saves all eight visibility selections, timer
  appearance and all 32 palette stops for future homepage visits.
- **Reset** restores the preview factory draft; individual palette resets affect
  only that metric. Reset values are not persisted until Save Defaults is pressed.
- Editing, resetting and launching do not automatically write storage. Reloading
  discards unsaved changes. Storage failures show `Save failed` without blocking
  Launch or changing legacy settings.

| Page | Configuration Source | Missing or Invalid Values |
| --- | --- | --- |
| Homepage preview | Saved local defaults, then current draft | Factory launcher defaults; all widgets enabled |
| Launched preview tracker | URL only | Factory appearance; missing widget flags disabled |
| Legacy launcher/tracker | Original launcher selections/URL behavior | Original legacy behavior |

Defaults use the origin-local key
`thettracker:launcher:0.1.0-preview:defaults:v1`, with the envelope
`{v:1, widgets:{...}, appearance:{timer:{...}, palettes:{...}}}`. Columns are
derived rather than stored. No counters, elapsed time, SNI state or legacy
settings are saved. Defaults do not synchronize across devices or origins;
saving them does not alter a tracker that is already open.

The `appearance` URL value is versioned JSON, encoded by `URLSearchParams`.
For example, its decoded form can be:

```json
{
  "v": 1,
  "timer": { "color": "#3B82F6", "font": "ibm-plex-mono" },
  "palettes": {
    "checkCount": ["#3A86FF", "#8338EC", "#FF006E", "#FB5607", "#FFBE0B"]
  }
}
```

Font tokens are `default`, `ibm-plex-mono`, `jetbrains-mono`, `space-mono`,
`bungee`, `audiowide` and `monoton`.
Palette keys use the existing widget query IDs. New launcher URLs include every
palette, including disabled/default ones, and remain under 2 KB. Partial values
are accepted for shared links: omitted fields resolve to factory appearance,
not saved defaults. Colors must be opaque six-digit hex and normalize uppercase.
Invalid timer fields fall back independently; a wrong stop count or invalid
color resets that metric's entire palette. Unsupported `v`, malformed JSON or
values longer than 4096 decoded characters reset the full appearance. Unknown
fields, arbitrary CSS and font URLs are not applied. First repeated keys win.

The six optional fonts are bundled locally as Latin, normal-style WOFF2 files
from Fontsource 5.3.0, under SIL OFL 1.1. Monospace faces use bold 700; the display
faces retain their regular outlines without synthetic bolding. See
[font sources and license texts](src/preview/fonts/README.md). There are no
third-party font requests or runtime font packages; legacy loads no new font
declarations or files. Missing font files fall back to monospace.

### Preservation Boundary

The original runtime and launch page are frozen in [src/legacy](src/legacy).
[src/preview](src/preview) owns its tracker, timer, SNI connection, components,
configuration and styles. [src/landing](src/landing) owns the shared start page.
The dispatcher loads only the selected entry; tracker versions have separate
Tailwind source scanning and stylesheet configurations.

`npm run test:legacy` checks frozen source hashes, existing assets/document,
Tailwind settings and baseline dependency versions. Runtime dependency upgrades
require explicitly re-certifying legacy. This is source isolation in one build,
not an independently archived binary release. The package metadata version is
not the user-facing tracker release label.

Preview retains the original metrics, defaults, palettes and controls, with
three intentional corrections: stop/resume preserves all elapsed time; startup
rates are zero rather than NaN/Infinity and colors remain valid; SNI recovery is
continuous and resource-bounded. Legacy retains its original behavior and quirks.

## Prerequisites

Use native ARM64 Node.js 22 on an Apple Silicon Mac. Local installation, build,
and browser checks were verified on an M2 Mac with Node.js `22.23.3` and npm
`10.9.9`. npm is included with Node.js.

If Node.js is not installed and Homebrew is available:

```bash
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
node -v
npm -v
node -p 'process.arch'
```

The architecture should be `arm64`. Homebrew's versioned Node installation is
not automatically added to PATH; repeat the export in each new terminal. An
existing native Node.js 22 installation can be used instead.

The frontend does not require Docker, Rosetta, a database, or environment files.
Live game tracking requires a separate local service, described below.

## Run Locally

From the repository root:

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open the URL printed by Vite, normally <http://127.0.0.1:5173/>. If the port is
occupied, Vite selects another available port. The server is bound to this Mac
only. Stop it with Ctrl+C. Opening the source HTML directly is not supported.

Use `npm ci` to install the committed dependency versions. The existing lockfile
installed successfully without changes; do not delete it or run dependency
upgrades as part of normal startup.

## Build and Preview

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

The build checks TypeScript and writes the production assets to `dist/`. Preview
serves those assets at the printed URL, normally <http://127.0.0.1:4173/>. It is a
local verification server, not a production hosting setup.

## Offline Smoke Check

1. Select the desired widgets on the settings page, retaining Checks to test
   manual counting.
2. Click Launch. Allow popups for the local site if the tracker window is blocked.
3. Confirm that only the selected widgets appear. Left-click Checks to increment
   the count, right-click to decrement it, or scroll over it to adjust the count.

For a popup-independent Checks-only view, open
<http://127.0.0.1:5173/index.html?tracker=true&checkCount=true&boxes=1>, adjusting
the port to match the running server.

Without a game connection, Disconnected/Error status and WebSocket connection
errors are expected. The timer remains at `00:00:00`: it starts from live game
events, and there is no offline start control. Live statistics do not update,
and legacy rates may display `NaN` or `Infinity` before the timer starts. Preview
rates are `0` until their time denominator is available. Manual check adjustments
still work in both versions.

## Live Tracking Later

The tracker connects to SNI at `ws://localhost:23074`, configured independently in
[src/legacy/App.tsx](src/legacy/App.tsx) and
[src/preview/App.tsx](src/preview/App.tsx). A compatible local SNES bridge and an attached
emulator or hardware device must be running separately; neither is included in
this repository.

The bridge must support SNES `DeviceList`, `Attach`, and `GetAddress` operations
and return the expected binary memory data. A generic emulator by itself is not
sufficient. Connection handling is in
[src/legacy/autotrack.tsx](src/legacy/autotrack.tsx) and
[src/preview/autotrack.tsx](src/preview/autotrack.tsx).
Use local HTTP with this unencrypted WebSocket endpoint. Emulator, bridge, and
hardware setup have not yet been verified on this Mac.

Preview attempts connection immediately and retries indefinitely with a
five-second delay, so SNI need not be running when the page opens. An open bridge
with no devices is queried every five seconds without reopening its socket.
Connection and response deadlines are five seconds; expiry retires the stalled
socket and waits five seconds before reconnecting. Mode/SRAM reads are serialized,
with at least 500ms between mode polls, so slow replies cannot overlap requests.
Each tracker window owns one session and cancels sockets/timers on unmount.

The first reported device is selected as before. Reconnection does not clear
statistics or introduce a new timer-pause policy. Separate windows connect
independently; actual SNI multi-client support and browser local-network or
mixed-content permissions must be verified in the target environment.

## Regression Tests

```bash
npm test
npm run test:e2e
npm run build
npx eslint src/main.tsx src/versionRouting.ts src/landing src/preview --ext ts,tsx
```

The browser suite uses locally installed Google Chrome and runs on desktop,
600x600 popup and mobile viewports. Unit tests use fake clocks and a controlled
SNI implementation; browser tests intercept WebSockets rather than requiring
hardware. They cover URL contracts, legacy screenshots, real launch popups,
finite-time feature parity, timer accumulation, color safety, saved defaults,
unsaved launches, storage failures, URL-only appearance, bundled fonts, delayed
SNI/device availability, serialized polling and terminal cleanup. Screenshots are captured
on macOS; browser rendering differences on other platforms need separate baselines.

To run the same browser checks against an already running production preview:

```bash
TEST_BASE_URL=http://127.0.0.1:4173 npm run test:e2e
```

For subdirectory hosting, build with Vite's existing base option, for example
`npm run build -- --base=/tracker/`, and verify against that directory's URL.
Do not update legacy screenshot baselines to conceal a compatibility regression.

## Verification and Known Issues

Setup checks on October 11, 2026:

- `npm ci` and `npm run build` passed with the committed dependencies.
- Chrome/Playwright smoke checks passed on development and production preview:
  settings, widget-selection popup, manual counter controls, idle offline timer,
  and local assets, with no unexpected startup errors.
- Appearance regression coverage includes 105 unit/integration tests and 30 browser
  checks across desktop, popup and mobile, including root and `/tracker/`
  production builds. Existing legacy screenshot baselines remain unchanged.
- The pre-split `npm run lint` baseline was 41 errors and 38 warnings,
  including unused declarations, type/style issues, and hook dependencies. These
  remain in frozen legacy; repository-wide lint is not a release gate for this
  split. New runtime code has no lint errors and retains one inherited preview
  context Fast Refresh warning. General lint cleanup is out of scope.
- npm reported 30 dependency vulnerabilities: 1 low, 10 moderate, and 19 high.
  Dependency security remediation requires a separate review; do not apply
  `npm audit fix` blindly.
- The successful build warns about outdated Browserslist data and legacy
  Tailwind content configuration. These warnings currently do not block startup.
