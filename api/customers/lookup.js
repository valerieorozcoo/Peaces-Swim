import { route } from "../../lib/http.js";
import { toE164 } from "../../lib/shopify.js";

// POST /api/customers/lookup  { phone }
// → { found: true, firstName }  or  { found: false }
// Kept for older clients. A phone number alone must not reveal customer records.
export default route(["POST"], async (body) => {
  const phone = toE164(body.phone);
  if (!phone) throw new Error("That phone number doesn't look right.");
  return { found: false };
});

