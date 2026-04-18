import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const appDirectory = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(appDirectory, "../..");
const distDirectory = path.join(appDirectory, "dist");
const artifactsDirectory = path.join(repositoryRoot, "artifacts", "server");
const packageJson = JSON.parse(fs.readFileSync(path.join(appDirectory, "package.json"), "utf8"));
const version = packageJson.version;
const serverLabel = "com.clockit.clockit.server";
const serverPackageName = "clock-it-server";
const serverInstallRoot =
  process.platform === "darwin"
    ? path.join("/Library", "Application Support", "ClockIt Server")
    : path.join("/opt", serverPackageName);
const serverConfigPath =
  process.platform === "darwin"
    ? path.join(serverInstallRoot, "config", "server.json")
    : path.join("/etc", "clock-it", "server.json");
const launchDaemonPath = path.join("/Library", "LaunchDaemons", `${serverLabel}.plist`);
const systemdServicePath = path.join("/etc", "systemd", "system", `${serverLabel}.service`);

if (!fs.existsSync(path.join(distDirectory, "index.js"))) {
  throw new Error("Server build output is missing. Run the build first.");
}

fs.mkdirSync(artifactsDirectory, { recursive: true });

function getNodeRuntimeRelativePath() {
  return process.platform === "win32" ? path.join("runtime", "node.exe") : path.join("runtime", "bin", "node");
}

function getNodeRuntimeAbsolutePath() {
  return path.join(serverInstallRoot, getNodeRuntimeRelativePath());
}

function getEntryScriptAbsolutePath() {
  return path.join(serverInstallRoot, "dist", "index.js");
}

function createSystemdUnit() {
  return `[Unit]
Description=ClockIt HTTP server
After=network.target

[Service]
Type=simple
ExecStart=${getNodeRuntimeAbsolutePath()} ${getEntryScriptAbsolutePath()} run --config ${serverConfigPath}
WorkingDirectory=${serverInstallRoot}
Restart=on-failure
RestartSec=2
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;
}

function createLaunchDaemonPlist() {
  const logsDirectory = path.join("/Library", "Logs", "ClockItServer");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${serverLabel}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${getNodeRuntimeAbsolutePath()}</string>
      <string>${getEntryScriptAbsolutePath()}</string>
      <string>run</string>
      <string>--config</string>
      <string>${serverConfigPath}</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${path.join(logsDirectory, "server.log")}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(logsDirectory, "server-error.log")}</string>
  </dict>
</plist>
`;
}

function copyServerRuntime(targetRoot, includeDefaultConfigFile) {
  const installRoot = path.join(targetRoot, serverInstallRoot.slice(1));
  const runtimeDirectory = path.join(installRoot, "runtime", "bin");
  const distTargetDirectory = path.join(installRoot, "dist");
  const configDirectory = path.join(installRoot, "config");

  fs.mkdirSync(runtimeDirectory, { recursive: true });
  fs.mkdirSync(distTargetDirectory, { recursive: true });
  fs.mkdirSync(configDirectory, { recursive: true });

  fs.cpSync(path.join(distDirectory, "index.js"), path.join(distTargetDirectory, "index.js"));
  fs.cpSync(process.execPath, path.join(runtimeDirectory, "node"));
  fs.cpSync(path.join(repositoryRoot, "LICENSE"), path.join(installRoot, "LICENSE"));

  const defaultConfigName = includeDefaultConfigFile ? "server.default.json" : "server.json";
  fs.writeFileSync(
    path.join(configDirectory, defaultConfigName),
    `${JSON.stringify({ port: 48123 }, null, 2)}\n`,
    "utf8",
  );

  fs.chmodSync(path.join(runtimeDirectory, "node"), 0o755);
}

function mapLinuxArch(arch) {
  if (arch === "x64") {
    return "amd64";
  }

  if (arch === "arm64") {
    return "arm64";
  }

  throw new Error(`Unsupported Linux architecture: ${arch}`);
}

function writeExecutable(pathname, contents) {
  fs.writeFileSync(pathname, contents, "utf8");
  fs.chmodSync(pathname, 0o755);
}

function packageLinux() {
  const packageRoot = path.join(artifactsDirectory, "deb-root");
  const debPath = path.join(artifactsDirectory, `${serverPackageName}_${version}_${mapLinuxArch(process.arch)}.deb`);
  const debianDirectory = path.join(packageRoot, "DEBIAN");
  const configDirectory = path.join(packageRoot, "etc", "clock-it");
  const systemdDirectory = path.join(packageRoot, "etc", "systemd", "system");
  const docsDirectory = path.join(packageRoot, "usr", "share", "doc", serverPackageName);

  fs.rmSync(packageRoot, { recursive: true, force: true });
  fs.mkdirSync(debianDirectory, { recursive: true });
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.mkdirSync(systemdDirectory, { recursive: true });
  fs.mkdirSync(docsDirectory, { recursive: true });

  copyServerRuntime(packageRoot, false);
  fs.writeFileSync(path.join(systemdDirectory, `${serverLabel}.service`), createSystemdUnit(), "utf8");
  fs.writeFileSync(path.join(configDirectory, "server.json"), `${JSON.stringify({ port: 48123 }, null, 2)}\n`, "utf8");
  fs.cpSync(path.join(repositoryRoot, "LICENSE"), path.join(docsDirectory, "copyright"));

  fs.writeFileSync(
    path.join(debianDirectory, "control"),
    `Package: ${serverPackageName}
Version: ${version}
Section: utils
Priority: optional
Architecture: ${mapLinuxArch(process.arch)}
Maintainer: Clock It <opensource@clockit.invalid>
Description: ClockIt daemon server
 A system-managed local HTTP daemon for the ClockIt tray app.
`,
    "utf8",
  );

  fs.writeFileSync(path.join(debianDirectory, "conffiles"), `${serverConfigPath}\n`, "utf8");

  writeExecutable(
    path.join(debianDirectory, "postinst"),
    `#!/bin/sh
set -eu
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  systemctl daemon-reload || true
  systemctl enable --now ${serverLabel}.service || true
fi
exit 0
`,
  );

  writeExecutable(
    path.join(debianDirectory, "prerm"),
    `#!/bin/sh
set -eu
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  systemctl disable --now ${serverLabel}.service || true
fi
exit 0
`,
  );

  writeExecutable(
    path.join(debianDirectory, "postrm"),
    `#!/bin/sh
set -eu
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  systemctl daemon-reload || true
fi
exit 0
`,
  );

  fs.rmSync(debPath, { force: true });
  execFileSync("dpkg-deb", ["--build", "--root-owner-group", packageRoot, debPath], { stdio: "inherit" });
  console.log(`Created ${debPath}`);
}

function packageMac() {
  const packageRoot = path.join(artifactsDirectory, "pkg-root");
  const scriptsDirectory = path.join(artifactsDirectory, "pkg-scripts");
  const unsignedPkgPath = path.join(artifactsDirectory, `${serverPackageName}-${version}-unsigned.pkg`);
  const outputPkgPath = path.join(artifactsDirectory, `${serverPackageName}-${version}.pkg`);
  const launchDaemonTargetPath = path.join(packageRoot, launchDaemonPath.slice(1));

  fs.rmSync(packageRoot, { recursive: true, force: true });
  fs.rmSync(scriptsDirectory, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(launchDaemonTargetPath), { recursive: true });
  fs.mkdirSync(scriptsDirectory, { recursive: true });

  copyServerRuntime(packageRoot, true);
  fs.writeFileSync(launchDaemonTargetPath, createLaunchDaemonPlist(), "utf8");
  fs.chmodSync(launchDaemonTargetPath, 0o644);

  writeExecutable(
    path.join(scriptsDirectory, "postinstall"),
    `#!/bin/sh
set -eu
INSTALL_ROOT="${serverInstallRoot}"
CONFIG_DIR="$INSTALL_ROOT/config"
DEFAULT_CONFIG="$CONFIG_DIR/server.default.json"
CONFIG_PATH="$CONFIG_DIR/server.json"
PLIST_PATH="${launchDaemonPath}"

mkdir -p "$CONFIG_DIR"
mkdir -p /Library/Logs/ClockItServer

if [ ! -f "$CONFIG_PATH" ]; then
  cp "$DEFAULT_CONFIG" "$CONFIG_PATH"
fi

chmod 644 "$PLIST_PATH"
launchctl bootout system "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap system "$PLIST_PATH"
launchctl kickstart -k system/${serverLabel} >/dev/null 2>&1 || true
`,
  );

  writeExecutable(
    path.join(scriptsDirectory, "preinstall"),
    `#!/bin/sh
set -eu
launchctl bootout system "${launchDaemonPath}" >/dev/null 2>&1 || true
`,
  );

  fs.rmSync(unsignedPkgPath, { force: true });
  fs.rmSync(outputPkgPath, { force: true });

  const pkgbuildArgs = [
    "--root",
    packageRoot,
    "--scripts",
    scriptsDirectory,
    "--identifier",
    serverLabel,
    "--version",
    version,
    "--install-location",
    "/",
  ];

  const pkgSigningIdentity = process.env.PKG_SIGNING_IDENTITY;
  if (pkgSigningIdentity) {
    pkgbuildArgs.push("--sign", pkgSigningIdentity);
  }

  pkgbuildArgs.push(unsignedPkgPath);
  execFileSync("pkgbuild", pkgbuildArgs, { stdio: "inherit" });

  fs.renameSync(unsignedPkgPath, outputPkgPath);

  const {
    APPLE_ID,
    APPLE_APP_SPECIFIC_PASSWORD,
    APPLE_TEAM_ID,
  } = process.env;

  if (pkgSigningIdentity && APPLE_ID && APPLE_APP_SPECIFIC_PASSWORD && APPLE_TEAM_ID) {
    execFileSync(
      "xcrun",
      [
        "notarytool",
        "submit",
        outputPkgPath,
        "--apple-id",
        APPLE_ID,
        "--password",
        APPLE_APP_SPECIFIC_PASSWORD,
        "--team-id",
        APPLE_TEAM_ID,
        "--wait",
      ],
      { stdio: "inherit" },
    );
    execFileSync("xcrun", ["stapler", "staple", outputPkgPath], { stdio: "inherit" });
  }

  console.log(`Created ${outputPkgPath}`);
}

if (process.platform === "linux") {
  packageLinux();
} else if (process.platform === "darwin") {
  packageMac();
} else {
  throw new Error(`Unsupported platform for server packaging: ${process.platform}`);
}
