import http from "node:http";
import { Weenie } from "@wymp/weenie-framework";
import { type ServerRuntimeConfig, createServerRuntimeConfig, loadRuntimeServerConfig } from "./config";
import { createClockItServer, startClockItServer } from "./httpServer";

type RawClockItDeps = ReturnType<ReturnType<typeof Weenie<{ config: ServerRuntimeConfig }>>["done"]>;

export type ClockItDeps = RawClockItDeps & {
  config: ServerRuntimeConfig;
};

export function createClockItDeps(configOverrides?: ServerRuntimeConfig): ClockItDeps {
  const config = configOverrides ?? createServerRuntimeConfig();

  return Weenie({ config }).done((deps) => deps) as ClockItDeps;
}

export function createClockItApp(deps: ClockItDeps): http.Server {
  return createClockItServer(deps);
}

export async function startClockItApp(deps: ClockItDeps): Promise<http.Server> {
  return startClockItServer(deps);
}

export { loadRuntimeServerConfig as loadServerConfig };
