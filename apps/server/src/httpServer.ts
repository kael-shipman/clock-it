import http from "node:http";
import type { ClockItDeps } from "./app";

export function createClockItServer(deps: ClockItDeps): http.Server {
  return http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/hello") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ message: "hello world" }));
      return;
    }

    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ status: "ok", port: deps.config.port }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "not found" }));
  });
}

export async function startClockItServer(deps: ClockItDeps): Promise<http.Server> {
  const server = createClockItServer(deps);
  const { port } = deps.config;

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  return server;
}
