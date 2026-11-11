import { route } from "../../lib/http.js";
import { authConfig } from "../../lib/rewards.js";
// POST /api/account/config → where to send her to sign in with Shopify (public client id + endpoints).
export default route(["POST", "GET"], async () => authConfig());
