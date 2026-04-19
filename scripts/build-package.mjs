import { mkdirSync, readdirSync } from "node:fs";
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
    // Native addon: must load from node_modules at runtime, not be bundled.
    external: ["better-sqlite3"],
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

if (packageName === "server") {
  const migrationsSourceDir = path.join(repositoryRoot, "apps", "server", "src", "db", "migrations");
  const migrationsOutDir = path.join(repositoryRoot, "apps", "server", "dist", "migrations");
  const migrationEntries = readdirSync(migrationsSourceDir).filter((name) => name.endsWith(".ts"));
  if (migrationEntries.length > 0) {
    mkdirSync(migrationsOutDir, { recursive: true });
    await build({
      entryPoints: migrationEntries.map((name) => path.join(migrationsSourceDir, name)),
      outdir: migrationsOutDir,
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node22",
      sourcemap: false,
      minify: false,
      legalComments: "none",
      logLevel: "info",
      external: ["better-sqlite3", "kysely"],
    });
  }
}
