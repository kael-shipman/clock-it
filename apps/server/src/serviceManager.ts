import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  APP_DISPLAY_NAME,
  HelloWorldConfig,
  SERVER_LABEL,
  ensureConfig,
  getConfigDir,
  writeConfig,
} from "@hello-world/shared";

interface ServiceInstallOptions {
  configPath: string;
  port?: number;
}

function getBundledNodePath(): string {
  if (process.platform === "win32") {
    return path.resolve(__dirname, "..", "runtime", "node.exe");
  }

  return path.resolve(__dirname, "..", "runtime", "bin", "node");
}

function getNodeExecutablePath(): string {
  const bundledNodePath = getBundledNodePath();
  if (fs.existsSync(bundledNodePath)) {
    return bundledNodePath;
  }

  return process.execPath;
}

function getEntryScriptPath(): string {
  return path.resolve(__dirname, "index.js");
}

function runCommand(command: string, args: string[], allowFailure = false): void {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error) {
    if (allowFailure) {
      return;
    }

    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const details = stderr || stdout ? `\n${stderr || stdout}` : "";
    throw new Error(`Command failed: ${command} ${args.join(" ")}${details}`);
  }
}

function quoteSystemdArg(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function getLinuxServicePath(): string {
  return path.join(os.homedir(), ".config", "systemd", "user", `${SERVER_LABEL}.service`);
}

function getMacLaunchAgentPath(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${SERVER_LABEL}.plist`);
}

function createSystemdUnit(configPath: string): string {
  const entryScriptPath = getEntryScriptPath();
  const workingDirectory = path.dirname(entryScriptPath);
  const execStart = [
    quoteSystemdArg(getNodeExecutablePath()),
    quoteSystemdArg(entryScriptPath),
    "run",
    "--config",
    quoteSystemdArg(configPath),
  ].join(" ");

  return `[Unit]
Description=${APP_DISPLAY_NAME} HTTP server
After=network.target

[Service]
Type=simple
ExecStart=${execStart}
WorkingDirectory=${quoteSystemdArg(workingDirectory)}
Restart=on-failure
RestartSec=2
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;
}

function createLaunchAgentPlist(configPath: string): string {
  const entryScriptPath = getEntryScriptPath();
  const logsDirectory = path.join(getConfigDir(), "logs");
  const stdoutPath = path.join(logsDirectory, "server.log");
  const stderrPath = path.join(logsDirectory, "server-error.log");

  fs.mkdirSync(logsDirectory, { recursive: true });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${SERVER_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${getNodeExecutablePath()}</string>
      <string>${entryScriptPath}</string>
      <string>run</string>
      <string>--config</string>
      <string>${configPath}</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${stdoutPath}</string>
    <key>StandardErrorPath</key>
    <string>${stderrPath}</string>
  </dict>
</plist>
`;
}

function resolveConfig(options: ServiceInstallOptions): HelloWorldConfig {
  const config = ensureConfig(options.configPath);

  if (typeof options.port === "number") {
    const updatedConfig = { port: options.port };
    writeConfig(options.configPath, updatedConfig);
    return updatedConfig;
  }

  return config;
}

export function installService(options: ServiceInstallOptions): HelloWorldConfig {
  const config = resolveConfig(options);

  if (process.platform === "linux") {
    const servicePath = getLinuxServicePath();
    fs.mkdirSync(path.dirname(servicePath), { recursive: true });
    fs.writeFileSync(servicePath, createSystemdUnit(options.configPath), "utf8");
    runCommand("systemctl", ["--user", "daemon-reload"]);
    runCommand("systemctl", ["--user", "enable", "--now", `${SERVER_LABEL}.service`]);
    return config;
  }

  if (process.platform === "darwin") {
    const launchAgentPath = getMacLaunchAgentPath();
    fs.mkdirSync(path.dirname(launchAgentPath), { recursive: true });
    fs.writeFileSync(launchAgentPath, createLaunchAgentPlist(options.configPath), "utf8");

    const userDomain = `gui/${process.getuid?.() ?? os.userInfo().uid}`;
    runCommand("launchctl", ["bootout", userDomain, launchAgentPath], true);
    runCommand("launchctl", ["bootstrap", userDomain, launchAgentPath]);
    runCommand("launchctl", ["kickstart", "-k", `${userDomain}/${SERVER_LABEL}`]);
    return config;
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

export function uninstallService(): void {
  if (process.platform === "linux") {
    const servicePath = getLinuxServicePath();
    runCommand("systemctl", ["--user", "disable", "--now", `${SERVER_LABEL}.service`], true);
    fs.rmSync(servicePath, { force: true });
    runCommand("systemctl", ["--user", "daemon-reload"], true);
    return;
  }

  if (process.platform === "darwin") {
    const launchAgentPath = getMacLaunchAgentPath();
    const userDomain = `gui/${process.getuid?.() ?? os.userInfo().uid}`;
    runCommand("launchctl", ["bootout", userDomain, launchAgentPath], true);
    fs.rmSync(launchAgentPath, { force: true });
    return;
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}
