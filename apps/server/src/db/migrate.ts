import {
  Kysely,
  Migrator,
  MigrationResultSet,
} from "kysely";
import type { DatabaseSchema } from "./schema";
import { migrationProvider } from "./migrations";

export const migrateToLatest = async (db: Kysely<DatabaseSchema>): Promise<MigrationResultSet> => {
  const migrator = new Migrator({
    db,
    provider: migrationProvider,
  });

  const result = await migrator.migrateToLatest();
  if (result.error) {
    throw result.error;
  }

  return result;
};
