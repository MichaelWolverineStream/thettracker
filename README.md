# Thettracker

A React, TypeScript, and Vite app for displaying game statistics. The settings
page opens a tracker window containing the selected widgets.

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
and rates may display `NaN` or `Infinity` before the timer starts. Manual check
adjustments still work.

## Live Tracking Later

The tracker connects to `ws://localhost:23074`, configured in
[src/App.tsx](src/App.tsx). A compatible local SNES bridge and an attached
emulator or hardware device must be running separately; neither is included in
this repository.

The bridge must support SNES `DeviceList`, `Attach`, and `GetAddress` operations
and return the expected binary memory data. A generic emulator by itself is not
sufficient. Connection handling is in [src/autotrack.tsx](src/autotrack.tsx).
Use local HTTP with this unencrypted WebSocket endpoint. Emulator, bridge, and
hardware setup have not yet been verified on this Mac.

## Verification and Known Issues

Setup checks on October 11, 2026:

- `npm ci` and `npm run build` passed with the committed dependencies.
- Chrome/Playwright smoke checks passed on development and production preview:
  settings, widget-selection popup, manual counter controls, idle offline timer,
  and local assets, with no unexpected startup errors.
- `npm run lint` reports an existing baseline of 41 errors and 38 warnings,
  including unused declarations, type/style issues, and hook dependencies. These
  were not changed as part of local setup.
- npm reported 30 dependency vulnerabilities: 1 low, 10 moderate, and 19 high.
  Dependency security remediation requires a separate review; do not apply
  `npm audit fix` blindly.
- The successful build warns about outdated Browserslist data and legacy
  Tailwind content configuration. These warnings currently do not block startup.
