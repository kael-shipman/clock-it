import fs from "node:fs";
import path from "node:path";
import Sqlite from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { type Config } from "../config";
import { migrateToLatest } from "./migrate";
import { type DatabaseSchema } from "./schema";

export type DbDeps = {
  config: Config;
};

export type DbDependency = {
  db: Kysely<DatabaseSchema>;
};

export const createDatabaseDependency = async ({ config }: DbDeps): Promise<DbDependency> => {
  const databasePath = config.db.path;
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new Sqlite(databasePath);
  const db = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: sqlite,
    }),
  });

  await migrateToLatest(db);

  return { db };
};
