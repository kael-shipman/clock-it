import type { MigrationProvider } from "kysely";
import { down as downCreateClockitMeta, up as upCreateClockitMeta } from "./20260419T000000-create-clockit-meta";

export const migrationProvider: MigrationProvider = {
  getMigrations: async () => ({
    "20260419T000000-create-clockit-meta": {
      down: downCreateClockitMeta,
      up: upCreateClockitMeta,
    },
  }),
};
