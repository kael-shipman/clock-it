import type { ColumnType, Generated } from "kysely";

export interface KyselyMigrationsTable {
  name: string;
  timestamp: string;
}

export interface KyselyMigrationLockTable {
  id: string;
  is_locked: number;
}

export interface DatabaseSchema {
  clockit_meta: {
    key: string;
    value: string;
  };
  kysely_migration: KyselyMigrationsTable;
  kysely_migration_lock: KyselyMigrationLockTable;
}
