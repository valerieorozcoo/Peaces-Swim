import { route } from "../lib/http.js";
import { gql } from "../lib/shopify.js";

// GET /api/health — is the backend deployed and are the Shopify settings present?
// GET /api/health?shopify=1 — also signs in to Shopify and returns the store name,
// which proves the keys actually work.
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
    } catch (e) {
      console.error("[health]", e.message, JSON.stringify(e.details || ""));
      out.shopify = { connected: false, error: e.message };
    }
  }
  return out;
});
