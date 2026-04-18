import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const appDirectory = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(appDirectory, "../..");
const distDirectory = path.join(appDirectory, "dist");
const artifactsDirectory = path.join(repositoryRoot, "artifacts", "server");
const bundleBaseName = `clock-it-server-${process.platform}-${process.arch}`;
const stagingDirectory = path.join(artifactsDirectory, bundleBaseName);
const archivePath = `${stagingDirectory}.tar.gz`;
const bundledNodePath = path.join(stagingDirectory, "bin", "node");
const bundledScriptPath = path.join(stagingDirectory, "dist", "index.js");

if (!fs.existsSync(path.join(distDirectory, "index.js"))) {
  throw new Error("Server build output is missing. Run the build first.");
}

fs.rmSync(stagingDirectory, { recursive: true, force: true });
fs.mkdirSync(path.join(stagingDirectory, "dist"), { recursive: true });
fs.mkdirSync(path.join(stagingDirectory, "bin"), { recursive: true });
 fs.mkdirSync(path.join(stagingDirectory, ".env"), { recursive: true });
fs.mkdirSync(artifactsDirectory, { recursive: true });

fs.cpSync(path.join(distDirectory, "index.js"), path.join(stagingDirectory, "dist", "index.js"));
fs.cpSync(process.execPath, bundledNodePath);
fs.cpSync(path.join(repositoryRoot, "LICENSE"), path.join(stagingDirectory, "LICENSE"));
 fs.cpSync(path.join(appDirectory, ".env"), path.join(stagingDirectory, ".env"), { recursive: true });
fs.writeFileSync(
  path.join(stagingDirectory, "config.sample.json"),
  JSON.stringify({ port: 48123 }, null, 2) + "\n",
  "utf8",
);

fs.writeFileSync(
  path.join(stagingDirectory, "install-service.sh"),
  `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/bin/node" "$SCRIPT_DIR/dist/index.js" install-service "$@"
`,
  "utf8",
);

fs.writeFileSync(
  path.join(stagingDirectory, "uninstall-service.sh"),
  `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/bin/node" "$SCRIPT_DIR/dist/index.js" uninstall-service "$@"
`,
  "utf8",
);

fs.writeFileSync(
  path.join(stagingDirectory, "README.txt"),
  `ClockIt server bundle
=========================

1. Extract this archive into a permanent directory.
2. The bundled Node runtime lives at:
   ${path.relative(stagingDirectory, bundledNodePath)}
3. Optional configuration locations:
   - Linux: ~/.config/clock-it/server.json
   - macOS: ~/Library/Application Support/ClockIt/server.json
4. Install the user service:
   ./install-service.sh --port 48123
5. Remove the user service:
   ./uninstall-service.sh
6. The service will run:
   ${path.relative(stagingDirectory, bundledNodePath)} ${path.relative(stagingDirectory, bundledScriptPath)} run

Example server.json:
${JSON.stringify({ port: 48123 }, null, 2)}

The service is user-scoped:
 - Linux: systemd --user unit com.clockit.clockit.server.service
 - macOS: launchd agent com.clockit.clockit.server

Useful commands after install:
 - Linux: systemctl --user status com.clockit.clockit.server.service
 - macOS: launchctl print gui/$(id -u)/com.clockit.clockit.server

The daemon listens on 127.0.0.1 and exposes:
 - GET /hello
 - GET /healthz

To test manually without installing a service:
  ./bin/node ./dist/index.js run --port 48123

To uninstall the service:
  ./uninstall-service.sh
`,
  "utf8",
);

fs.chmodSync(bundledNodePath, 0o755);
fs.chmodSync(path.join(stagingDirectory, "install-service.sh"), 0o755);
fs.chmodSync(path.join(stagingDirectory, "uninstall-service.sh"), 0o755);

fs.rmSync(archivePath, { force: true });
execFileSync("tar", ["-czf", archivePath, "-C", artifactsDirectory, bundleBaseName], { stdio: "inherit" });

console.log(`Created ${archivePath}`);
