import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const APP_ID = "clock-it";
export const APP_DISPLAY_NAME = "ClockIt";
export const SERVER_DISPLAY_NAME = "ClockIt Server";
export const SERVER_LABEL = "com.clockit.server";
export const DEFAULT_SERVER_HOST = "127.0.0.1";
export const DEFAULT_PORT = 48123;
export const SERVER_PACKAGE_NAME = "clock-it-server";

export interface ServerConfig {
  port: number;
  dbPath?: string;
}

export interface ClientConfig {
  serverUrl?: string;
}

export function isValidPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

export function getDefaultServerConfig(): ServerConfig {
  return { port: DEFAULT_PORT };
}

export function getDefaultServerDbPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir: string = os.homedir(),
): string {
  if ((env.APP_ENV ?? "development").toLowerCase() === "development") {
    const workspaceRoot = "/workspace";
    if (fs.existsSync(workspaceRoot)) {
      return path.join(workspaceRoot, "apps", "server", ".dev", "db.sqlite");
    }
  }

  return path.join(getUserConfigDir(platform, env, homeDir), "db.sqlite");
}

export function getDefaultServerBaseUrl(port = DEFAULT_PORT): string {
  return `http://${DEFAULT_SERVER_HOST}:${port}`;
}

export function normalizeServerUrl(value: string): string {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported server URL protocol: ${url.protocol}`);
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

export function getUserConfigDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir: string = os.homedir(),
): string {
  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", APP_DISPLAY_NAME);
  }

  const configHome = env.XDG_CONFIG_HOME ?? path.join(homeDir, ".config");
  return path.join(configHome, APP_ID);
}

export function getClientConfigPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir: string = os.homedir(),
): string {
  return path.join(getUserConfigDir(platform, env, homeDir), "client.json");
}

export function getUserServerConfigPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir: string = os.homedir(),
): string {
  return path.join(getUserConfigDir(platform, env, homeDir), "server.json");
}

export function getSystemServerConfigPath(platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") {
    return path.join("/Library", "Application Support", SERVER_DISPLAY_NAME, "config", "server.json");
  }

  return path.join("/etc", APP_ID, "server.json");
}

export function getSystemServerInstallRoot(platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") {
    return path.join("/Library", "Application Support", SERVER_DISPLAY_NAME);
  }

  return path.join("/opt", SERVER_PACKAGE_NAME);
}

export function getSystemServerRuntimePath(platform: NodeJS.Platform = process.platform): string {
  if (platform === "win32") {
    return path.join(getSystemServerInstallRoot(platform), "runtime", "node.exe");
  }

  return path.join(getSystemServerInstallRoot(platform), "runtime", "bin", "node");
}

export function getSystemServerEntryScriptPath(platform: NodeJS.Platform = process.platform): string {
  return path.join(getSystemServerInstallRoot(platform), "dist", "index.js");
}

function readJson(pathname: string): unknown {
  return JSON.parse(fs.readFileSync(pathname, "utf8"));
}

export function readServerConfig(configPath = getUserServerConfigPath()): ServerConfig {
  const parsed = readJson(configPath) as Partial<ServerConfig>;

  if (typeof parsed.port !== "number" || !isValidPort(parsed.port)) {
    throw new Error(`Invalid server port in config file: ${configPath}`);
  }

  if (parsed.dbPath !== undefined && typeof parsed.dbPath !== "string") {
    throw new Error(`Invalid dbPath in server config file: ${configPath}`);
  }

  return { port: parsed.port, dbPath: parsed.dbPath };
}

export function writeServerConfig(configPath: string, config: ServerConfig): void {
  if (!isValidPort(config.port)) {
    throw new Error(`Invalid port: ${config.port}`);
  }

  if (config.dbPath !== undefined && typeof config.dbPath !== "string") {
    throw new Error(`Invalid dbPath: ${String(config.dbPath)}`);
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function ensureServerConfig(configPath = getUserServerConfigPath()): ServerConfig {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  if (!fs.existsSync(configPath)) {
    const config = getDefaultServerConfig();
    writeServerConfig(configPath, config);
    return config;
  }

  return readServerConfig(configPath);
}

export function readClientConfig(configPath = getClientConfigPath()): ClientConfig {
  const parsed = readJson(configPath) as Partial<ClientConfig>;

  if (parsed.serverUrl === undefined) {
    return {};
  }

  if (typeof parsed.serverUrl !== "string") {
    throw new Error(`Invalid serverUrl in client config file: ${configPath}`);
  }

  return { serverUrl: normalizeServerUrl(parsed.serverUrl) };
}

export function writeClientConfig(configPath: string, config: ClientConfig): void {
  const normalized: ClientConfig = {};

  if (config.serverUrl !== undefined) {
    normalized.serverUrl = normalizeServerUrl(config.serverUrl);
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function ensureClientConfig(configPath = getClientConfigPath()): ClientConfig {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  if (!fs.existsSync(configPath)) {
    const config: ClientConfig = {};
    writeClientConfig(configPath, config);
    return config;
  }

  return readClientConfig(configPath);
}

export function resolveClientServerUrl(options?: {
  clientConfigPath?: string;
  systemServerConfigPath?: string;
  userServerConfigPath?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const clientConfigPath = options?.clientConfigPath ?? getClientConfigPath();
  const systemServerConfigPath = options?.systemServerConfigPath ?? getSystemServerConfigPath();
  const userServerConfigPath = options?.userServerConfigPath ?? getUserServerConfigPath();
  const env = options?.env ?? process.env;

  const envUrl = env.HELLO_WORLD_SERVER_URL;
  if (envUrl) {
    return normalizeServerUrl(envUrl);
  }

  if (fs.existsSync(clientConfigPath)) {
    const clientConfig = readClientConfig(clientConfigPath);
    if (clientConfig.serverUrl) {
      return clientConfig.serverUrl;
    }
  }

  if (fs.existsSync(systemServerConfigPath)) {
    const config = readServerConfig(systemServerConfigPath);
    return getDefaultServerBaseUrl(config.port);
  }

  if (fs.existsSync(userServerConfigPath)) {
    const config = readServerConfig(userServerConfigPath);
    return getDefaultServerBaseUrl(config.port);
  }

  return getDefaultServerBaseUrl();
}

export function getHelloEndpoint(serverUrl: string): string {
  return `${normalizeServerUrl(serverUrl)}/hello`;
}
