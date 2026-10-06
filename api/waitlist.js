import { route } from "../lib/http.js";
import { gql, check, toE164, findCustomer, ShopifyError } from "../lib/shopify.js";

const TAG = "waitlist";
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const q = (v) => '"' + String(v).replace(/["\\]/g, "") + '"';

async function addTag(id) {
  const data = await gql(
    `mutation($id:ID!,$tags:[String!]!){ tagsAdd(id:$id, tags:$tags){ userErrors{ field message } } }`,
    { id, tags: [TAG] }
  );
  check(data.tagsAdd, "tagsAdd");
}

// For someone already in Shopify, add the first name / phone they just gave us if their
// record doesn't have one yet. Existing details are never overwritten. If the phone is
// already on a different customer, Shopify refuses it, and we keep the signup anyway.
async function fillMissing(c, { firstName, phone }) {
  const input = { id: c.id };
  if (!c.phone && phone) input.phone = phone;
  if (!c.firstName && firstName) input.firstName = firstName;
  if (Object.keys(input).length === 1) return;
  const data = await gql(
    `mutation($input:CustomerInput!){ customerUpdate(input:$input){ customer{ id } userErrors{ field message } } }`,
    { input }
  );
  const errs = data.customerUpdate.userErrors || [];
  if (errs.length) {
    console.warn("[waitlist] could not add details to existing customer:", errs.map((e) => e.message).join("; "));
    if (input.phone && input.firstName && errs.some((e) => /phone/i.test(e.message))) {
      delete input.phone; // still save the name
      await gql(`mutation($input:CustomerInput!){ customerUpdate(input:$input){ userErrors{ message } } }`, { input });
    }
  }
}

// POST /api/waitlist  { firstName, email, phone }
// Saves the person as a Shopify customer tagged "waitlist". People already in Shopify
// (same email or phone) just get the tag added, so nobody is duplicated.
// The form says joining means launch emails, so new signups are subscribed to email
// marketing. SMS marketing is NOT turned on: texting needs its own explicit opt-in.
export default route(["POST"], async (body) => {
  if (body.company) return { ok: true }; // hidden spam-bot field — pretend it worked, save nothing

  const firstName = clean(body.firstName, 60);
  const email = clean(body.email, 120).toLowerCase();
  const phone = toE164(body.phone);
  if (!firstName) throw new Error("Please add your first name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email doesn't look right.");
  if (!phone) throw new Error("That phone number doesn't look right.");

  const existing = (await findCustomer("email:" + q(email))) || (await findCustomer("phone:" + q(phone)));
  if (existing) {
    if (!(existing.tags || []).includes(TAG)) await addTag(existing.id);
    await fillMissing(existing, { firstName, phone });
    return { ok: true, existing: true };
  }

  const data = await gql(
    `mutation($input:CustomerInput!){ customerCreate(input:$input){ customer{ id } userErrors{ field message } } }`,
    {
      input: {
        firstName, email, phone,
        tags: [TAG],
        note: "Joined the Peaces Swim waitlist " + new Date().toISOString().slice(0, 10),
        emailMarketingConsent: { marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN" },
      },
    }
  );
  const p = data.customerCreate;
  if (p.userErrors && p.userErrors.length) {
    // Raced with another signup, or the phone belongs to someone Shopify search missed.
    if (p.userErrors.some((e) => /taken/i.test(e.message))) {
      const again = (await findCustomer("email:" + q(email))) || (await findCustomer("phone:" + q(phone)));
      if (again) { await addTag(again.id); await fillMissing(again, { firstName, phone }); return { ok: true, existing: true }; }
    }
    check(p, "customerCreate");
  }
  if (!p.customer) throw new ShopifyError("customerCreate returned no customer", p);
  return { status: 201, body: { ok: true, existing: false } };
});
