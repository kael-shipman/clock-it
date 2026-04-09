# NEXT

## Architecture

- `apps/client`: Electron tray app. Main process lives in `src/main.ts`.
- `apps/server`: Node HTTP daemon. Entry point is `src/index.ts`, HTTP server is `src/httpServer.ts`.
- `packages/shared`: config/path/constants shared by client and server.

## Runtime behavior

- Server exposes:
  - `GET /hello`
  - `GET /healthz`
- Client tray menu has one action: **Say hello**
- Client resolves server target in this order:
  1. `HELLO_WORLD_SERVER_URL`
  2. user client config
  3. installed system server config
  4. default localhost URL

## Config paths

- Client config:
  - Linux: `~/.config/hello-world/client.json`
  - macOS: `~/Library/Application Support/Hello World/client.json`
- Installed server config:
  - Linux: `/etc/hello-world/server.json`
  - macOS: `/Library/Application Support/Hello World Server/config/server.json`

## Packaging

- Client packaging: `apps/client/electron-builder.json5`
  - Linux: `.deb`, `.AppImage`
  - macOS: `.dmg`, `.zip`
- Server packaging: `apps/server/scripts/package.mjs`
  - Linux: `.deb` with systemd system service
  - macOS: `.pkg` with LaunchDaemon
- Optional portable server bundle: `apps/server/scripts/bundle.mjs`

## Dev workflows

- `pnpm run dev:server` -> `tsx watch apps/server/src/index.ts`
- `pnpm run dev:client` -> Electron with `tsx` loader via `scripts/dev-client.mjs`
- `pnpm run dev` -> both together

## CI / release

- CI: `.github/workflows/build-and-package.yml`
- Release: `.github/workflows/release.yml`
- mac signing/notarization envs already wired for client and server package scripts/workflows.

## Likely next improvements

- Add a settings UI or tray submenu for editing `serverUrl`
- Add integration tests around packaged config resolution
- Add richer server endpoints or health diagnostics
