# ClockIt tray + daemon

A cross-platform TypeScript ClockIt app with:

- an Electron system tray client
- a separately installable daemon server
- native installers for Linux and macOS
- CI/release workflows for packaging both parts

## What it does

- The server listens on `127.0.0.1` using a configurable port.
- The tray app shows one menu item: **Say hello**.
- Clicking **Say hello** calls the configured server and shows a desktop notification with `hello world`.
- If the local server installer is present, the client uses it automatically by default.

## Stack

- Node.js 22+
- TypeScript
- pnpm workspace
- Electron for the tray app
- `systemd` system service on Linux
- `launchd` LaunchDaemon on macOS

## Project layout

```text
apps/
  client/   Electron tray client
  server/   HTTP daemon + server packaging
packages/
  shared/   Shared config/constants
scripts/
  dev-client.mjs
artifacts/
  client/   Built client installers
  server/   Built server installers
```

## Install dependencies

```bash
corepack enable
pnpm install
```

## Local development

The local dev flow does not require prebuilding the app. The server runs via `tsx`, and Electron is launched with the `tsx` loader.

Start the server:

```bash
pnpm run dev:server
```

Start the tray client in a second terminal:

```bash
pnpm run dev:client
```

Or start both together:

```bash
pnpm run dev
```

Local dev notes:

- `dev:server` stores config in `./.dev/server.json`
- the dev server defaults to port `48123`
- the client defaults to `http://127.0.0.1:48123`
- you can point the client at a different server for testing:

```bash
HELLO_WORLD_SERVER_URL=http://127.0.0.1:49000 pnpm run dev:client
```

## Build everything

```bash
pnpm typecheck
pnpm build
```

## Create distributable artifacts locally

Build packages for the current OS:

```bash
pnpm package
```

Or package each side independently:

```bash
pnpm run package:server
pnpm run package:client
```

## Server installer outputs

Linux:

- `artifacts/server/clock-it-server_<version>_amd64.deb`

macOS:

- `artifacts/server/clock-it-server-<version>.pkg`

The server installer:

- installs the daemon files
- installs a system-managed service automatically
- starts the daemon automatically after install

Installed server locations:

- Linux config: `/etc/clock-it/server.json`
- Linux service: `/etc/systemd/system/com.clockit.server.service`
- Linux runtime root: `/opt/clock-it-server`
- macOS config: `/Library/Application Support/ClockIt Server/config/server.json`
- macOS service: `/Library/LaunchDaemons/com.clockit.server.plist`
- macOS runtime root: `/Library/Application Support/ClockIt Server`

## Client installer outputs

Linux:

- `.deb`
- `.AppImage`

macOS:

- `.dmg`
- `.zip`

## Client configuration

The client has its own user-scoped config and can optionally target a different server.

Client config paths:

- Linux: `~/.config/clock-it/client.json`
- macOS: `~/Library/Application Support/ClockIt/client.json`

Example:

```json
{
  "serverUrl": "http://10.0.0.15:48123"
}
```

If `serverUrl` is omitted, the client resolves its server in this order:

1. `HELLO_WORLD_SERVER_URL`
2. `client.json`
3. installed system server config
4. default `http://127.0.0.1:48123`

## Manual server bundle

The portable user-managed server bundle still exists as an advanced/manual option:

```bash
pnpm run bundle:server
```

## Building and signing locally

### Linux

Build the unsigned local packages:

```bash
pnpm run package:server
pnpm run package:client
```

Linux packages are not cryptographically signed by default. Repository or package signing is typically handled afterward with distribution-specific tooling.

### macOS client signing and notarization

The Electron client package can sign and optionally notarize when these variables are set:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Example:

```bash
export CSC_LINK="file:///path/to/DeveloperIDApplication.p12"
export CSC_KEY_PASSWORD="your-password"
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID1234"
pnpm run package:client
```

### macOS server installer signing and notarization

The server `.pkg` installer supports optional local signing and notarization.

Set:

- `PKG_SIGNING_IDENTITY`
- optionally:
  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`
  - `APPLE_TEAM_ID`

Example:

```bash
export PKG_SIGNING_IDENTITY="Developer ID Installer: Your Name (TEAMID1234)"
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID1234"
pnpm run package:server
```

If those variables are absent, the macOS server installer is built unsigned.

## Icons

Packaging resources live in `apps/client/build/`.

Generate the full icon set with:

```bash
pnpm --filter @clockit/client run generate:icons
```

Generated assets include:

- `icon.svg`
- `icon.png`
- `icon.ico`
- `icon.icns`
- `icons/png/*`

## Continuous integration

CI workflow:

```text
.github/workflows/build-and-package.yml
```

It:

- installs dependencies
- typechecks and builds the workspace
- packages the client on Linux and macOS
- packages the server installer on Linux and macOS
- uploads distributable artifacts

## Release publishing

Release workflow:

```text
.github/workflows/release.yml
```

It:

- builds release artifacts on Linux and macOS
- publishes client and server installer artifacts to GitHub Releases
- runs on `v*` tags or manual dispatch
