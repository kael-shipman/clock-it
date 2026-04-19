import fs from "node:fs/promises";
import path from "node:path";
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  MigrationResultSet,
} from "kysely";
import type { DatabaseSchema } from "./schema";

const migrationsDirectory = path.resolve(__dirname, "migrations");

export const migrateToLatest = async (db: Kysely<DatabaseSchema>): Promise<MigrationResultSet> => {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: migrationsDirectory,
    }),
  });

  const result = await migrator.migrateToLatest();
  if (result.error) {
    throw result.error;
  }

  return result;
};
