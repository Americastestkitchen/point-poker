// HTTP routes: open a table, look one up, and serve the built client.
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { OpenRequest, type OpenedTable, type TableInfo } from "../../shared/protocol.ts";
import type { DealerAuth } from "../auth/dealer.ts";
import type { Rooms } from "../rooms.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

/** A small JSON body (POST /api/rooms), or undefined when there's none or it isn't JSON. */
async function readJson(req: IncomingMessage, limit = 4096): Promise<unknown> {
  let text = "";
  for await (const chunk of req) {
    text += String(chunk);
    if (text.length > limit) return undefined;
  }
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

export function httpHandler(deps: { rooms: Rooms; auth: DealerAuth; distDir: string }) {
  const { rooms, auth, distDir } = deps;
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (await auth.route(req, res, url)) return;
    if (url.pathname === "/api/host" && req.method === "GET") return json(res, 200, auth.host(req));
    if (url.pathname === "/api/rooms" && req.method === "POST") {
      const body = OpenRequest.catch({}).parse(await readJson(req));
      const check = auth.open(req, body);
      if (!check.ok) return json(res, check.status, check.refusal);
      const table = rooms.create(check.jira);
      return json(res, 200, { code: table.code, dealerKey: table.snapshot().dealerKey } satisfies OpenedTable);
    }
    if (url.pathname.startsWith("/api/rooms/") && req.method === "GET") {
      const table = rooms.get(url.pathname.split("/").pop() ?? "");
      return json(res, table ? 200 : 404, {
        exists: !!table,
        jiraEnabled: table?.viewFor(null).jiraEnabled ?? false,
        needsPasscode: auth.needsPasscode,
      } satisfies TableInfo);
    }
    // static files from dist/, falling back to index.html
    const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(distDir, path);
    if (!file.startsWith(distDir)) {
      res.writeHead(403);
      return res.end();
    }
    const isFile = await stat(file).then(
      (st) => st.isFile(),
      () => false,
    );
    if (!isFile) file = join(distDir, "index.html");
    try {
      const body = await readFile(file);
      const cache = file.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": cache });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Client not built yet. Run `npm run build`.");
    }
  };
}
