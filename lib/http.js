import { ConfigError, ShopifyError } from "./shopify.js";

// Small wrapper for every /api route: CORS, method check, JSON body, error handling.
export function route(methods, fn) {
  return async function handler(req, res) {
    const origin = process.env.ALLOWED_ORIGIN || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", methods.concat("OPTIONS").join(", "));
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") return res.status(204).end();
    if (!methods.includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
    try {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
      const out = await fn(body || {}, req);
      return res.status(out && out.status ? out.status : 200).json(out && out.body !== undefined ? out.body : out);
    } catch (e) {
      if (e instanceof ConfigError) {
        console.error("[config]", e.message);
        return res.status(503).json({ error: "The shop isn't connected yet.", code: "not_configured" });
      }
      if (e instanceof ShopifyError) {
        console.error("[shopify]", e.message, JSON.stringify(e.details));
        return res.status(502).json({ error: "We couldn't reach the shop just now. Please try again." });
      }
      return res.status(400).json({ error: e.message || "Bad request" });
    }
  };
}
