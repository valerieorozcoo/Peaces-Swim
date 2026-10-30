import { route, HttpError } from "../../lib/http.js";
import { gql, check, toE164, findSignupCustomer, ShopifyError } from "../../lib/shopify.js";
import { welcomeToken } from "../../lib/sign.js";

async function matchingCustomer(email, phone) {
  const match = await findSignupCustomer(email, phone);
  if (match.conflict) throw new HttpError(409, "We couldn't save these contact details together. Please check your email and phone, or contact Peaces Swim for help.");
  return match.customer;
}

// POST /api/customers/create  { name, email, phone, marketing }
// Creates the Shopify customer (tagged "peaces-builder"). Marketing consent is only
// recorded as SUBSCRIBED when the customer ticked the box.
export default route(["POST"], async (body) => {
  const phone = toE164(body.phone);
  const name = String(body.name || "").trim().slice(0, 80);
  const email = String(body.email || "").trim().slice(0, 120).toLowerCase();
  if (!phone) throw new Error("That phone number doesn't look right.");
  if (!name) throw new Error("Please add your name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email doesn't look right.");

  const [firstName, ...rest] = name.split(/\s+/);
  const success = (existing) => ({ ok: true, existing, firstName, welcomeToken: welcomeToken(phone) });
  const existing = await matchingCustomer(email, phone);
  if (existing) return success(true);
  const input = { firstName, lastName: rest.join(" ") || null, email, phone, tags: ["peaces-builder"] };
  if (body.marketing === true) {
    input.emailMarketingConsent = { marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN" };
  }
  const data = await gql(
    `mutation($input:CustomerInput!){ customerCreate(input:$input){ customer{ id firstName } userErrors{ field message } } }`,
    { input }
  );
  const p = data.customerCreate;
  if (p.userErrors && p.userErrors.length) {
    // A concurrent signup is successful only if both contact details match.
    if (p.userErrors.some((e) => /taken/i.test(e.message)) && await matchingCustomer(email, phone)) return success(true);
    check(p, "customerCreate");
  }
  if (!p.customer) throw new ShopifyError("customerCreate returned no customer", p);
  return { status: 201, body: success(false) };
});

