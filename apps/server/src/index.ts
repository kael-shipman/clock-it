#!/usr/bin/env node

import { APP_DISPLAY_NAME, getUserServerConfigPath, isValidPort } from "@clock-it/shared";
import { getProdDeps } from "./app";
import { startClockItServer } from "./httpServer";
import { installService, uninstallService } from "./serviceManager";

type Command = "run" | "install-service" | "uninstall-service";

interface ParsedArgs {
  command: Command;
  configPath: string;
  port?: number;
}

const parseArgs = (argv: string[]): ParsedArgs => {
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
};

const runServer = async (configPath: string, portOverride?: number): Promise<void> => {
  const { deps } = await getProdDeps({ configPath, portOverride });
  const server = await startClockItServer(deps);

  console.log(`${APP_DISPLAY_NAME} server listening on http://127.0.0.1:${deps.config.port}`);

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "run") {
    await runServer(args.configPath, args.port);
    return;
  }

  if (args.command === "install-service") {
    const config = installService({ configPath: args.configPath, port: args.port });
    console.log(`Installed ${APP_DISPLAY_NAME} server service on port ${config.port}`);
    return;
  }

  if (args.command === "uninstall-service") {
    uninstallService();
    console.log(`Uninstalled ${APP_DISPLAY_NAME} server service`);
    return;
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
