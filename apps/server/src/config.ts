import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { merge } from "es-toolkit/object";
import { DEFAULT_PORT, ensureServerConfig } from "@clock-it/shared";
import { configValue, validate, Validators } from "@wymp/config-simple";

const ENVIRONMENT = {
  development: "development",
  staging: "staging",
  production: "production",
} as const;

type Environment = (typeof ENVIRONMENT)[keyof typeof ENVIRONMENT];

const loadEnvFiles = (): Environment => {
  const env = configValue("APP_ENV", ENVIRONMENT.development, Validators.oneOf(Object.values(ENVIRONMENT))) as Environment;
  const envDirectory = path.resolve(__dirname, "..", ".env");

  for (const filePath of [path.join(envDirectory, "local"), path.join(envDirectory, env)]) {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: false });
    }
  }

  return env;
};

const buildConfig = () => {
  const env = loadEnvFiles();

  return {
    env,
    port: configValue("PORT", "num", DEFAULT_PORT),
  };
};

export type Config = ReturnType<typeof createServerRuntimeConfig>;

export const createServerRuntimeConfig = () => validate(buildConfig());

export const loadRuntimeServerConfig = (configPath: string, portOverride?: number): Config => {
  const merged = merge({ ...createServerRuntimeConfig() }, ensureServerConfig(configPath));
  return typeof portOverride === "number" ? merge(merged, { port: portOverride }) : merged;
};
