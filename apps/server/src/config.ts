import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { REQUIRED, configValue, validate, Validators } from "@wymp/config-simple";
import { ensureServerConfig } from "@clock-it/shared";

const ENVIRONMENT = {
  development: "development",
  staging: "staging",
  production: "production",
} as const;

type Environment = (typeof ENVIRONMENT)[keyof typeof ENVIRONMENT];

function loadEnvFiles(): Environment {
  const environment = configValue(
    "APP_ENV",
    ENVIRONMENT.development,
    Validators.oneOf(Object.values(ENVIRONMENT)),
  ) as Environment;
  const serverRoot = path.resolve(__dirname, "..");
  const envDirectory = path.join(serverRoot, ".env");

  for (const relativePath of [path.join(envDirectory, environment), path.join(envDirectory, "local")]) {
    if (fs.existsSync(relativePath)) {
      dotenv.config({ path: relativePath, override: true });
    }
  }

  return environment;
}

function buildConfigDefinition() {
  const env = loadEnvFiles();

  return {
    env,
    port: configValue("PORT", "num", REQUIRED),
  };
}

export interface ServerRuntimeConfig {
  env: Environment;
  port: number;
}

export function createServerRuntimeConfig(): ServerRuntimeConfig {
  const result = validate(buildConfigDefinition(), "dont-throw");
  if (result.t === "error") {
    throw new Error(`Invalid runtime configuration:\n\n  * ${result.errors.join("\n  * ")}`);
  }

  return result.value;
}

export function loadRuntimeServerConfig(configPath: string, portOverride?: number): ServerRuntimeConfig {
  const fileConfig = ensureServerConfig(configPath);

  const runtimePort = typeof portOverride === "number" ? portOverride : fileConfig.port;
  const previousPort = process.env.PORT;
  process.env.PORT = String(runtimePort);

  try {
    return createServerRuntimeConfig();
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
}
