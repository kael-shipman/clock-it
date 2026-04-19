import http from "node:http";
import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Config } from "./config";
import type { DatabaseSchema } from "./db/schema";

type HttpDeps = {
  config: Config;
  db: Kysely<DatabaseSchema>;
};

const sendJson = (
  response: http.ServerResponse<http.IncomingMessage>,
  statusCode: number,
  payload: unknown,
): void => {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
};

const readJsonBody = async (request: http.IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
};

export const createClockItServer = (deps: HttpDeps): http.Server => {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/hello") {
        sendJson(response, 200, { message: "hello world" });
        return;
      }

      if (request.method === "GET" && request.url === "/healthz") {
        sendJson(response, 200, { status: "ok", port: deps.config.port });
        return;
      }

      if (request.method === "GET" && request.url === "/clients") {
        const clients = await deps.db
          .selectFrom("clients")
          .select(["id", "name", "archived_at"])
          .orderBy("name asc")
          .execute();

        sendJson(response, 200, { clients });
        return;
      }

      if (request.method === "POST" && request.url === "/clients") {
        const payload = (await readJsonBody(request)) as { name?: unknown };
        const name = typeof payload.name === "string" ? payload.name.trim() : "";

        if (!name) {
          sendJson(response, 400, { error: "name is required" });
          return;
        }

        const client = {
          archived_at: null,
          id: randomUUID(),
          name,
        };

        try {
          await deps.db.insertInto("clients").values(client).execute();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.toLowerCase().includes("unique")) {
            sendJson(response, 409, { error: "client name already exists" });
            return;
          }
          throw error;
        }

        sendJson(response, 201, { client });
        return;
      }

      sendJson(response, 404, { error: "not found" });
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "invalid json body" });
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 500, { error: "internal server error", message });
    }
  });
};

export const startClockItServer = async (deps: HttpDeps): Promise<http.Server> => {
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
};
