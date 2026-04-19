export interface KyselyMigrationsTable {
  name: string;
  timestamp: string;
}

export interface KyselyMigrationLockTable {
  id: string;
  is_locked: number;
}

export interface DatabaseSchema {
  clients: {
    archived_at: string | null;
    id: string;
    name: string;
  };
  clockit_meta: {
    key: string;
    value: string;
  };
  kysely_migration: KyselyMigrationsTable;
  kysely_migration_lock: KyselyMigrationLockTable;
}
