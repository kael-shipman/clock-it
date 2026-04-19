import http from "node:http";
import { Weenie } from "@wymp/weenie-base";
import { Config, createServerRuntimeConfig, loadRuntimeServerConfig } from "./config";
import { createDatabaseDependency, type DbDependency } from "./db/dependency";
import { createClockItServer, startClockItServer } from "./httpServer";

export type BaseDeps = {
  config: Config;
};

export type Deps = BaseDeps &
  DbDependency & {
    http: http.Server;
  };

export const getProdDeps = async ({
  configPath,
  portOverride,
}: {
  configPath: string;
  portOverride?: number;
}) => {
  const baseConfig = loadRuntimeServerConfig(configPath, portOverride);
  const dbDependency = await createDatabaseDependency({ config: baseConfig });

  const deps = await Weenie({ config: baseConfig })
    .and(() => dbDependency)
    .and((d: BaseDeps & DbDependency) => ({
      http: createClockItServer(d),
    }))
    .done(async (d: BaseDeps & DbDependency & { http: http.Server }) => ({
      config: d.config,
      db: d.db,
      http: d.http,
    }));

  return {
    deps,
    shutdown: async () => {
      await deps.db.destroy();
    },
  };
};

export const createClockItApp = (deps: Deps): http.Server => createClockItServer(deps);

export const startClockItApp = async (deps: Deps): Promise<http.Server> => startClockItServer(deps);

export { createServerRuntimeConfig };
