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

run(pnpmCommand, ["--filter", "@clock-it/client", "run", "generate:icons"]);

const existingNodeOptions = process.env.NODE_OPTIONS?.trim();
const nodeOptions = [existingNodeOptions, "--import=tsx"].filter(Boolean).join(" ");

// Cursor (and some other hosts) set ELECTRON_RUN_AS_NODE=1, which makes `require("electron")`
// resolve to the binary path string instead of the Electron API — unset for a real app process.
const electronEnv = { ...process.env, NODE_OPTIONS: nodeOptions };
delete electronEnv.ELECTRON_RUN_AS_NODE;

run(
  pnpmCommand,
  ["--filter", "@clock-it/client", "exec", "electron", "src/main.ts"],
  {
    env: electronEnv,
  },
);
