import { route } from "../../lib/http.js";
import { gql, check, toE164, findCustomerByPhone, ShopifyError } from "../../lib/shopify.js";

// POST /api/customers/create  { name, email, phone, marketing }
// Creates the Shopify customer (tagged "peaces-builder"). Marketing consent is only
// recorded as SUBSCRIBED when the customer ticked the box.
export default route(["POST"], async (body) => {
  const phone = toE164(body.phone);
  const name = String(body.name || "").trim().slice(0, 80);
  const email = String(body.email || "").trim().slice(0, 120);
  if (!phone) throw new Error("That phone number doesn't look right.");
  if (!name) throw new Error("Please add your name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email doesn't look right.");

  const existing = await findCustomerByPhone(phone);
  if (existing) return { ok: true, existing: true, firstName: existing.firstName || "" };

  const [firstName, ...rest] = name.split(/\s+/);
  const input = { firstName, lastName: rest.join(" ") || null, email, phone, tags: ["peaces-builder"] };
  if (body.marketing) {
    input.emailMarketingConsent = { marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN" };
  }
  const data = await gql(
    `mutation($input:CustomerInput!){ customerCreate(input:$input){ customer{ id firstName } userErrors{ field message } } }`,
    { input }
  );
  const p = data.customerCreate;
  if (p.userErrors && p.userErrors.length) {
    // Same email already on file under a different phone — treat as a returning customer.
    if (p.userErrors.some((e) => /taken/i.test(e.message))) return { ok: true, existing: true, firstName };
    check(p, "customerCreate");
  }
  if (!p.customer) throw new ShopifyError("customerCreate returned no customer", p);
  return { status: 201, body: { ok: true, existing: false, firstName: p.customer.firstName } };
});
