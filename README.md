# Hello World tray + daemon

A cross-platform TypeScript hello-world app with:

- a user-managed HTTP daemon for Linux and macOS
- an Electron system tray client
- packaged client installers for Linux and macOS
- a portable server bundle that can install itself as a `systemd --user` or `launchd` service

## What it does

- The server listens on `127.0.0.1` using a configurable port.
- The tray app shows one menu item: **Say hello**.
- Clicking **Say hello** calls the local server and shows a desktop notification with `hello world`.

## Stack

- Node.js 22+
- TypeScript
- pnpm workspace
- Electron for the tray app
- `systemd --user` on Linux
- `launchd` LaunchAgents on macOS

## Project layout

```text
apps/
  client/   Electron tray client
  server/   HTTP daemon + service installer
packages/
  shared/   Shared config/constants
artifacts/
  client/   Packaged Electron installers
  server/   Portable daemon archive
```

## Install dependencies

```bash
corepack enable
pnpm install
```

## Build everything

```bash
pnpm typecheck
pnpm build
```

## Continuous integration

GitHub Actions builds and uploads artifacts on Linux and macOS with:

```text
.github/workflows/build-and-package.yml
```

The workflow:

- installs dependencies with pnpm
- typechecks and builds the workspace
- packages the Electron tray client on Linux and macOS
- bundles the daemon archive on Linux and macOS
- uploads the generated artifacts for each job

GitHub Releases publishing is handled by:

```text
.github/workflows/release.yml
```

That workflow can run:

- automatically on tag pushes like `v1.0.0`
- manually through `workflow_dispatch` with a tag input

It rebuilds the client and server artifacts, then publishes them to a GitHub Release.

## Create distributable artifacts

```bash
pnpm package
```

This produces:

- client installers in `artifacts/client`
- a portable daemon archive in `artifacts/server`

## Server install and service management

After building, create the portable server bundle:

```bash
pnpm --filter @hello-world/server bundle
```

Extract the generated archive from `artifacts/server`, then install the user service:

```bash
./install-service.sh --port 48123
```

This installs:

- Linux: `~/.config/systemd/user/com.clockit.helloworld.server.service`
- macOS: `~/Library/LaunchAgents/com.clockit.helloworld.server.plist`

The service is configured to restart on failure.

To remove the daemon:

```bash
./uninstall-service.sh
```

## Client packaging

Create the tray application installers with:

```bash
pnpm --filter @hello-world/client package
```

This automatically regenerates the icon set before packaging.

On Linux, the build targets:

- `deb`
- `AppImage`

On macOS, the build targets:

- `dmg`
- `zip`

### macOS signing and notarization

The Electron packaging configuration is prepared for hardened runtime and optional notarization.

Relevant files:

- `apps/client/electron-builder.json5`
- `apps/client/build/entitlements.mac.plist`
- `apps/client/build/entitlements.mac.inherit.plist`
- `apps/client/build/notarize.mjs`

If these GitHub Actions secrets are configured, macOS builds can sign and notarize automatically:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

If those secrets are absent, the macOS package step still produces unsigned artifacts.

### Icons

Packaging resources live in `apps/client/build/`:

- `generate-icons.mjs`
- `icon.svg`
- `icon.png`
- `icon.ico`
- `icon.icns`
- `icons/png/<size>x<size>.png`

The icon generator produces a branded multi-size icon set for Linux, macOS, and future Windows packaging:

```bash
pnpm --filter @hello-world/client generate:icons
```

Generated sizes currently include:

- `16x16`
- `24x24`
- `32x32`
- `48x48`
- `64x64`
- `128x128`
- `256x256`
- `512x512`
- `1024x1024`

The generator also refreshes:

- `icon.ico`
- `icon.icns`
- `icon.png`

## Configuration

The daemon and tray client both read the same config file.

Default config locations:

- Linux: `~/.config/hello-world/config.json`
- macOS: `~/Library/Application Support/Hello World/config.json`

Default contents:

```json
{
  "port": 48123
}
```

## Development notes

Run the daemon directly:

```bash
node apps/server/dist/index.js run --port 48123
```

The server exposes:

- `GET /hello`
- `GET /healthz`

Build only the tray client:

```bash
pnpm --filter @hello-world/client build
```

Regenerate only the icon assets:

```bash
pnpm --filter @hello-world/client generate:icons
```

Build only the daemon:

```bash
pnpm --filter @hello-world/server build
```

## Publishing a release

To publish from GitHub Actions:

1. push a version tag like `v1.0.0`, or
2. run the `Release` workflow manually and provide a tag

The release workflow uploads:

- Linux tray installers (`.deb`, `.AppImage`)
- macOS tray installers (`.dmg`, `.zip`)
- Linux and macOS server bundles (`.tar.gz`)
