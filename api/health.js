import { route } from "../lib/http.js";
import { gql } from "../lib/shopify.js";

// GET /api/health — is the backend deployed and are the Shopify settings present?
// GET /api/health?shopify=1 — also signs in to Shopify and returns the store name,
// which proves the keys actually work.
// Shopify's own explanation, trimmed. These messages never contain keys or customer data.
function shopifyReason(e) {
  const d = e && e.details;
  if (Array.isArray(d)) return d.map((x) => x.message || JSON.stringify(x)).join(" | ").slice(0, 400);
  if (typeof d === "string") return d.slice(0, 400);
  return d ? JSON.stringify(d).slice(0, 400) : e.message;
}

export default route(["GET"], async (_body, req) => {
  const out = {
    ok: true,
    shopDomainSet: !!(process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_BASE_URL),
    credentialsSet: !!((process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) || process.env.SHOPIFY_ADMIN_TOKEN),
  };
  const params = new URL(req.url || "/", "http://local").searchParams;
  if (params.get("shopify") === "1") {
    try {
      const data = await gql(`{ shop { name } }`);
      out.shopify = { connected: true, store: data.shop.name };
      // Can the app read customers? (needs read_customers + protected customer data access)
      try {
        await gql(`{ customers(first:1){ nodes{ id } } }`);
        out.shopify.customers = "ok";
      } catch (e) {
        out.shopify.customers = "blocked";
        out.shopify.customersError = shopifyReason(e);
      }
    } catch (e) {
      console.error("[health]", e.message, JSON.stringify(e.details || ""));
      out.shopify = { connected: false, error: e.message, reason: shopifyReason(e) };
    }
  }
  return out;
});
