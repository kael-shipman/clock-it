import { mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const [, , packageName] = process.argv;

if (!packageName) {
  throw new Error("Usage: node scripts/build-package.mjs <package-name>");
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");

const packageConfigs = {
  server: {
    entryPoints: [path.join(repositoryRoot, "apps", "server", "src", "index.ts")],
    outfile: path.join(repositoryRoot, "apps", "server", "dist", "index.js"),
    platform: "node",
    format: "cjs",
    external: [],
  },
  client: {
    entryPoints: [path.join(repositoryRoot, "apps", "client", "src", "main.ts")],
    outfile: path.join(repositoryRoot, "apps", "client", "dist", "main.js"),
    platform: "node",
    format: "cjs",
    external: ["electron"],
  },
  shared: {
    entryPoints: [path.join(repositoryRoot, "packages", "shared", "src", "index.ts")],
    outfile: path.join(repositoryRoot, "packages", "shared", "dist", "index.js"),
    platform: "node",
    format: "cjs",
    external: [],
  },
};

const selectedConfig = packageConfigs[packageName];

if (!selectedConfig) {
  throw new Error(`Unknown package: ${packageName}`);
}

mkdirSync(path.dirname(selectedConfig.outfile), { recursive: true });

await build({
  ...selectedConfig,
  bundle: true,
  target: "node22",
  sourcemap: false,
  minify: false,
  legalComments: "none",
  logLevel: "info",
  treeShaking: true,
});
