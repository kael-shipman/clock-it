import path from "node:path";
import { spawnSync } from "node:child_process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(pnpmCommand, ["--filter", "@clockit/client", "run", "generate:icons"]);

const existingNodeOptions = process.env.NODE_OPTIONS?.trim();
const nodeOptions = [existingNodeOptions, "--import=tsx"].filter(Boolean).join(" ");

run(
  pnpmCommand,
  ["--filter", "@clockit/client", "exec", "electron", "src/main.ts"],
  {
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
    },
  },
);
