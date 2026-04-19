import http from "node:http";
import { Weenie } from "@wymp/weenie-base";
import { Config, createServerRuntimeConfig, loadRuntimeServerConfig } from "./config";
import { createClockItServer, startClockItServer } from "./httpServer";

export type BaseDeps = {
  config: Config;
};

export type Deps = BaseDeps & {
  http: http.Server;
};

export const getProdDeps = async ({
  configPath,
  portOverride,
}: {
  configPath: string;
  portOverride?: number;
}) => {
  const deps = await Weenie({ config: loadRuntimeServerConfig(configPath, portOverride) })
    .and((d: BaseDeps) => ({
      http: createClockItServer(d),
    }))
    .done(async (d) => ({
      config: d.config,
      http: d.http,
    }));

  return {
    deps,
    shutdown: async () => Promise.resolve(),
  };
};

export const createClockItApp = (deps: Deps): http.Server => createClockItServer(deps);

export const startClockItApp = async (deps: Deps): Promise<http.Server> => startClockItServer(deps);

export { createServerRuntimeConfig };
