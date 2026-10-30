import { route, HttpError } from "../lib/http.js";
import { gql, check, toE164, findSignupCustomer, ShopifyError } from "../lib/shopify.js";

const TAG = "raffle-entry";
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
async function matchingCustomer(email, phone) {
  const match = await findSignupCustomer(email, phone);
  if (match.conflict) throw new HttpError(409, "We couldn't save these contact details together. Please check your email and phone, or contact Peaces Swim for help.");
  return match.customer;
}

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
    console.warn("[raffle] could not add details to existing customer:", errs.map((e) => e.message).join("; "));
    if (input.phone && input.firstName && errs.some((e) => /phone/i.test(e.message))) {
      delete input.phone; // still save the name
      await gql(`mutation($input:CustomerInput!){ customerUpdate(input:$input){ userErrors{ message } } }`, { input });
    }
  }
}

// Texting needs its own explicit opt-in: only someone who ticked the SMS box gets
// subscribed. Never fails the signup; the person is on the list either way.
async function subscribeSms(id) {
  try {
    const data = await gql(
      `mutation($input:CustomerSmsMarketingConsentUpdateInput!){ customerSmsMarketingConsentUpdate(input:$input){ userErrors{ field message } } }`,
      { input: { customerId: id, smsMarketingConsent: { marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN" } } }
    );
    const errs = data.customerSmsMarketingConsentUpdate.userErrors || [];
    if (errs.length) console.warn("[raffle] could not subscribe to SMS:", errs.map((e) => e.message).join("; "));
  } catch (e) {
    console.warn("[raffle] could not subscribe to SMS:", e.message);
  }
}

// POST /api/raffle  { firstName, email, phone, sms }
// Raffle entry for a free customized Peaces bikini. Saves the person as a Shopify customer
// tagged "raffle-entry" (same customer list as everyone else, so filter by that tag to see
// raffle entrants). People already in Shopify (same email or phone) just get the tag added,
// so nobody is duplicated and a waitlist person who enters keeps both tags.
// Agreeing to texts is required to enter, so every entrant is subscribed to SMS marketing;
// the form also says they'll get emails, so new entrants are subscribed to email marketing.
export default route(["POST"], async (body) => {
  if (body.company) return { ok: true }; // hidden spam-bot field — pretend it worked, save nothing

  const firstName = clean(body.firstName, 60);
  const email = clean(body.email, 120).toLowerCase();
  const phone = toE164(body.phone);
  if (!firstName) throw new Error("Please add your first name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email doesn't look right.");
  if (!phone) throw new Error("That phone number doesn't look right.");
  if (body.sms !== true) throw new Error("Please check the box to agree to texts from Peaces to enter.");
  const sms = true;

  const existing = await matchingCustomer(email, phone);
  if (existing) {
    if (!(existing.tags || []).includes(TAG)) await addTag(existing.id);
    await fillMissing(existing, { firstName, phone });
    if (sms) await subscribeSms(existing.id);
    return { ok: true, existing: true };
  }

  const data = await gql(
    `mutation($input:CustomerInput!){ customerCreate(input:$input){ customer{ id } userErrors{ field message } } }`,
    {
      input: {
        firstName, email, phone,
        tags: [TAG],
        note: "Entered the Peaces Swim raffle " + new Date().toISOString().slice(0, 10),
        emailMarketingConsent: { marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN" },
        ...(sms && { smsMarketingConsent: { marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN" } }),
      },
    }
  );
  const p = data.customerCreate;
  if (p.userErrors && p.userErrors.length) {
    // Raced with another signup, or the phone belongs to someone Shopify search missed.
    if (p.userErrors.some((e) => /taken/i.test(e.message))) {
      const again = await matchingCustomer(email, phone);
      if (again) { await addTag(again.id); await fillMissing(again, { firstName, phone }); if (sms) await subscribeSms(again.id); return { ok: true, existing: true }; }
    }
    check(p, "customerCreate");
  }
  if (!p.customer) throw new ShopifyError("customerCreate returned no customer", p);
  return { status: 201, body: { ok: true, existing: false } };
});

