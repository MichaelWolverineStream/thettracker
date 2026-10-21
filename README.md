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
counters or elapsed time. Trackers never read launcher defaults or persist
progress. A preview tracker reads IndexedDB only to load the uploaded font
explicitly referenced by its URL; it never writes font assets.

### Preview Appearance and Defaults

The preview section offers a timer color swatch, a timer style menu, a font menu
and a passive timer sample. Fonts are Current (the original inherited stack), IBM Plex Mono,
JetBrains Mono, Space Mono, Bungee, Audiowide and Monoton, plus a local font upload.
Only the timer font/color/style changes; metric text, buttons, weight and shadow retain
their existing presentation. Uploaded fonts shrink only when necessary to fit
the timer or sample container; bundled fonts retain their existing sizes.

#### Timer Styles

| Style | Token | Uses Font | Example (1:04:03) |
| --- | --- | --- | --- |
| Digital | `digital` | Yes | `01:04:03` |
| Analog stopclock | `analog` | Numerals only | Hour, minute and ticking second hands |
| Words | `words` | Yes | One hour, four minutes, and three seconds |
| Seven-segment LCD | `lcd` | No | Segment display of `01:04:03` |
| Progress rings | `rings` | No | Second, minute and 12-hour rings |
| Binary clock | `binary` | No | BCD columns for `01:04:03` |
| Compact | `compact` | Yes | `1h 04m 03s` |
| Flip clock | `flip` | Yes | Flip cards for `01:04:03` |
| Roman numerals | `roman` | Yes | `I:IV:III` |

The color applies to every style. The font menu and upload button are disabled
for styles that draw no text, while the chosen font is kept for later. The
sample shows `00:00:00` for Digital and a fixed 1:04:03 for other styles.
Digit styles (Digital, LCD, Flip and Binary) keep the existing wrap after 24
hours; Words, Compact, Roman, Analog and Rings count hours without wrapping, and
the analog hour hand and hour ring turn once per 12 hours. Words omits zero
units, joins two units with "and", uses an Oxford comma for three and wraps
onto several lines; it reads "There is still time" before the run starts.
Roman numerals always show hours, minutes and seconds, using an em dash for a
zero unit (`—:IV:III`). On both the tracker and launcher sample, the Roman string
is right-aligned inside a stable, centered area with side margins, keeping its
right edge anchored as numeral widths change (also during Rotation).
Flip cards animate only when a digit changes and do not
animate when the system requests reduced motion.

**Rotation** (token `rotation`) appears last in the style menu. Choosing it
checks every style; uncheck styles to narrow the set, with at least two always
kept. While the timer runs, the tracker starts on a random selected style and
switches to a different one after a random 10–100 seconds. Paused or stopped
timers keep their current style and choose a fresh delay when they resume. The
launcher sample shows the first selected style, and the font controls and Words
language menu apply when any selected style uses them.

The **BLAT** switch overlays `BLAT!!!` in Impact on the timer while it runs. It
jumps to a random position and angle (0–360°) five times per second at half the
normal timer size (18px on the tracker, 15px on the launcher sample, for every
style), in the timer color. The overlay is decorative and hidden from assistive
technology. Impact is a system font and is not bundled; where it is missing, the
overlay falls back to Haettenschweiler, Arial Narrow Bold or the system
sans-serif font.

The **BeeBobble** checkbox next to BLAT shows a decorative 112x112 animated bee
centered above the start/pause controls, slightly overlapping the timer's lower
edge. It also appears in the launcher sample and loops continuously whenever
enabled, including before starting and while paused. It is off by default and
is saved, restored and reset with the other preview appearance settings. Shared
launch URLs use the optional `timer.beebobble: true` field; it is omitted when off.

When Words is selected, a **Words language** menu chooses how it is written.
The language is kept when switching to another style and back.

| Language | Token | Example (1:04:03) | Before the run starts |
| --- | --- | --- | --- |
| English | `en` | One hour, four minutes, and three seconds | There is still time |
| Français | `fr` | Une heure, quatre minutes et trois secondes | Il est encore temps |
| Svenska | `sv` | En timme, fyra minuter och tre sekunder | Det finns fortfarande tid |
| Español | `es` | Una hora, cuatro minutos y tres segundos | Todavía hay tiempo |
| 한국어 | `ko` | 한 시간 사 분 삼 초 | 아직 시간이 있어요 |
| Latina | `la` | Una hora, quattuor minuta et tria secunda | Adhuc tempus est |
| Русский | `ru` | Один час, четыре минуты и три секунды | Ещё есть время |
| tlhIngan Hol (Klingon) | `tlh` | wa' rep loS tup wej lup je | poH tu'lu' |
| Quenya (Elvish) | `qya` | Min lúmë, enenquaistar canta ar attië enenquaistar neldë | Elen síla lúmenn' omentielvo |
| Emoji | `emoji` | 1️⃣🕐 4️⃣⏱️ 3️⃣⚡ | ⏳👍 |
| Mr. T | `mrt` | One hour, four minutes, and three seconds, fool! | I pity the fool who ain't started! |

Numbers agree with each noun's gender (for example Spanish *veintiún minutos*,
Latin *duae horae*, Russian *двадцать одна минута*), and Russian nouns take its
one/few/many plural forms (*час*, *часа*, *часов*). French, Swedish, Spanish,
Latin, Russian and Quenya join the last two units with their own "and" and use
no Oxford comma. Korean counts hours with native
numbers below 100 (*스무 시간*) and uses Sino-Korean numbers otherwise
(*오십구 분*), separating units by spaces only. Spelled-out languages other than
English and Mr. T write 1000 or more hours as digits (*1000 heures*); Quenya does
so from 100 hours. Bundled fonts include only Latin glyphs, so Korean and Russian
text uses the system fallback font, and emoji use the system emoji font in their
own colors rather than the timer color.

Klingon uses its standard Latin transcription, where capital letters are
distinct sounds, so it is never capitalized (all-caps fonts such as Bungee
still hide that distinction). Nouns take no plural after a number,
and *je* ("and") follows the last unit. Quenya is a neo-Quenya approximation:
13 and the tens are scholarly reconstructions, and because Tolkien left no words
for minute or second, they are coined from *enenquaista* ("a sixtieth"),
following the Latin origin of the English words. Its not-started phrase is
Tolkien's "a star shines on the hour of our meeting". Mr. T adds *, fool!* to
the English text.

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
- Editing, resetting and launching do not automatically save defaults. A
  successful font upload separately persists its asset before it can be selected.
  Reloading discards unsaved draft changes, not uploaded files. Defaults storage
  failures show `Save failed` without blocking Launch or changing legacy settings.

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
  "timer": { "color": "#3B82F6", "font": "ibm-plex-mono", "variant": "analog" },
  "palettes": {
    "checkCount": ["#3A86FF", "#8338EC", "#FF006E", "#FB5607", "#FFBE0B"]
  }
}
```

Font tokens are `default`, `ibm-plex-mono`, `jetbrains-mono`, `space-mono`,
`bungee`, `audiowide`, `monoton` and `custom`. The custom token requires a
`timer.customFontId` containing 32 lowercase hex characters; invalid references
fall back independently to the inherited font. IDs are meaningful only where
the uploaded asset is stored; no font bytes or filenames travel in the URL.
The optional `timer.variant` takes one of the style tokens above. It is omitted
for Digital, so existing and factory links are unchanged; missing or invalid
values fall back independently to Digital.
The optional `timer.language` takes one of the language tokens above and is
omitted for English; missing or invalid values fall back independently to
English.
With `timer.variant` set to `rotation`, `timer.rotation` lists the selected
style tokens, for example `"rotation": ["analog", "lcd", "flip"]`. Tokens are
deduplicated and normalized to the style-table order; unknown tokens are
ignored, and fewer than two valid styles fall back to Digital. The list is
omitted for other styles. The optional `timer.blat` is `true` when BLAT is on
and omitted otherwise.
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

#### Uploaded Timer Fonts

Use the upload button beside Timer font to choose a WOFF2, WOFF, TTF, or OTF file
up to 5 MiB. File signatures and browser font decoding are validated; CSS,
SVG fonts, collections, empty, corrupt, and oversized files are rejected. The
supplied outlines are registered as normal style for weights 400-700, without
adding synthetic bolding or separate weight controls. Use fonts you are permitted
to use. Font files stay in this browser and are never uploaded to a server.

The preview stores immutable files and bounded display names in the origin-local
IndexedDB database `thettracker:preview:fonts`, separately from launcher defaults.
An upload previews immediately, and Launch can use it without Save Defaults.
Save Defaults saves only the selected ID. Importing disables Launch and Save
Defaults until validation/storage completes; failures leave the previous draft
usable. Reset restores the factory draft and cancels pending selection work,
but neither Reset nor a replacement upload deletes earlier assets, so existing
links keep working. Clearing site data removes retained uploads.

Availability requires the same browser profile/storage partition and origin
(scheme, hostname, and port). Other browsers/devices, private sessions, changed
ports, or cleared/evicted site storage may not have the font. Those trackers
fall back to the original inherited font while retaining URL colors, widgets,
palettes, and live tracking. The launcher reports missing, invalid, busy, denied,
full, or timed-out font storage without changing saved defaults. Loading never
blocks the tracker, and font operations time out after five seconds per operation.
There is no font hosting, cross-device transfer, or font-library deletion UI.

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
four intentional corrections: stop/resume preserves all elapsed time; startup
rates are zero rather than NaN/Infinity and colors remain valid; SNI recovery is
continuous and resource-bounded; the timer and controls appear immediately when
automatic start is detected. The preview timer retains a +1000 ms display
compensation, initially showing `00:00:01` after detection, and refreshes elapsed
time every 125 ms. Controls remain available through pauses and stops. Legacy
retains its original behavior and quirks.

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
errors are expected. The timer remains at `00:00:00` until it starts from live
game events. Preview also shows a **FORCE TIMER START** button while the timer
has never started and no SNI device is attached (status other than
`Connected to …`). It starts the timer immediately and is then replaced by the
normal pause/resume and DE-FLUFF controls. Legacy has no offline start control.
Live statistics do not update,
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

Test principles, layers and viewport rules are documented in
[tests/README.md](tests/README.md); read them before adding tests.

The browser suite uses locally installed Google Chrome. Every browser test runs
on desktop; tests tagged `@responsive` also run in a 600x600 popup viewport.
Screenshots of each surface are saved under `test-results/` for review, and only
the legacy tracker screenshot is asserted. Unit tests use fake clocks and a controlled
SNI implementation; browser tests intercept WebSockets rather than requiring
hardware. They cover URL contracts, legacy screenshots, real launch popups,
finite-time feature parity, timer accumulation, color safety, saved defaults,
unsaved launches, storage failures, URL-only appearance, bundled fonts, timer styles, delayed
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
