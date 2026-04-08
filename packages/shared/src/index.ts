import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const APP_ID = "hello-world";
export const APP_DISPLAY_NAME = "Hello World";
export const SERVER_LABEL = "com.clockit.helloworld.server";
export const DEFAULT_PORT = 48123;

export interface HelloWorldConfig {
  port: number;
}

export function getDefaultConfig(): HelloWorldConfig {
  return { port: DEFAULT_PORT };
}

export function isValidPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

export function getConfigDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir: string = os.homedir(),
): string {
  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", APP_DISPLAY_NAME);
  }

  if (platform === "linux") {
    const configHome = env.XDG_CONFIG_HOME ?? path.join(homeDir, ".config");
    return path.join(configHome, APP_ID);
  }

  const configHome = env.XDG_CONFIG_HOME ?? path.join(homeDir, ".config");
  return path.join(configHome, APP_ID);
}

export function getConfigPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir: string = os.homedir(),
): string {
  return path.join(getConfigDir(platform, env, homeDir), "config.json");
}

export function ensureConfig(configPath = getConfigPath()): HelloWorldConfig {
  const configDir = path.dirname(configPath);
  fs.mkdirSync(configDir, { recursive: true });

  if (!fs.existsSync(configPath)) {
    const config = getDefaultConfig();
    writeConfig(configPath, config);
    return config;
  }

  return readConfig(configPath);
}

export function readConfig(configPath = getConfigPath()): HelloWorldConfig {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<HelloWorldConfig>;

  if (typeof parsed.port !== "number" || !isValidPort(parsed.port)) {
    throw new Error(`Invalid port in config file: ${configPath}`);
  }

  return { port: parsed.port };
}

export function writeConfig(configPath: string, config: HelloWorldConfig): void {
  if (!isValidPort(config.port)) {
    throw new Error(`Invalid port: ${config.port}`);
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function getHelloEndpoint(port: number): string {
  return `http://127.0.0.1:${port}/hello`;
}
