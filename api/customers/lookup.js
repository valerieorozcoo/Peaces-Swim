import { route } from "../../lib/http.js";
import { toE164, findCustomerByPhone } from "../../lib/shopify.js";

// POST /api/customers/lookup  { phone }
// → { found: true, firstName }  or  { found: false }
// Only the first name goes back to the browser — never email or address.
export default route(["POST"], async (body) => {
  const phone = toE164(body.phone);
  if (!phone) throw new Error("That phone number doesn't look right.");
  const c = await findCustomerByPhone(phone);
  return c ? { found: true, firstName: c.firstName || "" } : { found: false };
});
