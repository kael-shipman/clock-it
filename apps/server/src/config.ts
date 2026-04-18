import { REQUIRED, configValue, validate } from "@wymp/config-simple";
import { ensureServerConfig } from "@clock-it/shared";

function buildConfigDefinition() {
  return {
    port: configValue("PORT", "num", REQUIRED),
  };
}

export interface ServerRuntimeConfig {
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
