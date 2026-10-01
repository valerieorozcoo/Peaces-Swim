// Tiny stand-in for `vercel dev`: serves index.html + art and runs /api/* handlers.
// Usage: node test/local-server.js [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = +(process.argv[2] || process.env.PORT || 3000);
const types = { ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };

export function startLocal(p = port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/api/")) {
      const file = path.join(root, url.pathname.replace(/\/$/, "") + ".js");
      if (!file.startsWith(path.join(root, "api")) || !fs.existsSync(file)) { res.writeHead(404); return res.end("{}"); }
      let raw = ""; for await (const c of req) raw += c;
      req.body = raw;
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
      const mod = await import(pathToFileURL(file).href);
      return mod.default(req, res);
    }
    let f = path.join(root, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(p, () => r(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLocal().then(() => console.log("Peaces Swim Builder on http://localhost:" + port));
}
