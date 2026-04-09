#!/usr/bin/env node

import { ensureServerConfig, getUserServerConfigPath, isValidPort } from "@hello-world/shared";
import { startHelloWorldServer } from "./httpServer";
import { installService, uninstallService } from "./serviceManager";

type Command = "run" | "install-service" | "uninstall-service";

interface ParsedArgs {
  command: Command;
  configPath: string;
  port?: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  let command: Command = "run";
  let configPath = getUserServerConfigPath();
  let port: number | undefined;

  const commandCandidate = argv[0] as Command | undefined;
  const supportedCommands: Command[] = ["run", "install-service", "uninstall-service"];

  let index = 0;
  if (commandCandidate && supportedCommands.includes(commandCandidate)) {
    command = commandCandidate;
    index = 1;
  }

  while (index < argv.length) {
    const current = argv[index];

    if (current === "--config") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --config");
      }

      configPath = value;
      index += 2;
      continue;
    }

    if (current === "--port") {
      const value = Number(argv[index + 1]);
      if (!isValidPort(value)) {
        throw new Error("Missing or invalid value for --port");
      }

      port = value;
      index += 2;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return { command, configPath, port };
}

async function runServer(configPath: string, portOverride?: number): Promise<void> {
  const config = ensureServerConfig(configPath);
  const port = portOverride ?? config.port;
  const server = await startHelloWorldServer(port);

  console.log(`Hello World server listening on http://127.0.0.1:${port}`);

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "run") {
    await runServer(args.configPath, args.port);
    return;
  }

  if (args.command === "install-service") {
    const config = installService({ configPath: args.configPath, port: args.port });
    console.log(`Installed Hello World server service on port ${config.port}`);
    return;
  }

  if (args.command === "uninstall-service") {
    uninstallService();
    console.log("Uninstalled Hello World server service");
    return;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
