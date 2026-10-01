import { route } from "../lib/http.js";

// GET /api/health — quick check that the backend is deployed and which Shopify settings are present.
export default route(["GET"], async () => ({
  ok: true,
  shopDomainSet: !!(process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_BASE_URL),
  credentialsSet: !!((process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) || process.env.SHOPIFY_ADMIN_TOKEN),
}));
