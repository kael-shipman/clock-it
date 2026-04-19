import { Kysely } from "kysely";
import type { DatabaseSchema } from "../schema";

export const up = async (db: Kysely<DatabaseSchema>): Promise<void> => {
  await db.schema
    .createTable("clockit_meta")
    .ifNotExists()
    .addColumn("key", "text", (column) => column.primaryKey())
    .addColumn("value", "text", (column) => column.notNull())
    .execute();
};

export const down = async (db: Kysely<DatabaseSchema>): Promise<void> => {
  await db.schema.dropTable("clockit_meta").ifExists().execute();
};
