// One way to save anyone who gives us their details (waitlist, website sign-up, raffle),
// so every person ends up as a Shopify customer and nobody is ever turned away.
//
//   • New email + new phone          → new customer with everything.
//   • Same email AND phone on file   → same person: add the tag, fill a missing name,
//                                      record the consent they just gave.
//   • Details only partly match      → we can't prove it's the same person, so the existing
//     (email on file with a different   record's contact details and consent are never changed.
//     phone, or the phone belongs to    Instead the signup is kept: tagged, tagged "check-contact",
//     someone else)                     and the details they typed are added to the customer note
//                                       so the team can merge them by hand in Shopify.
import { gql, check, findCustomer, toE164, ShopifyError } from "./shopify.js";

export const REVIEW_TAG = "check-contact";
const SUB = { marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN" };
const quote = (v) => '"' + String(v).replace(/["\\]/g, "") + '"';
const today = () => new Date().toISOString().slice(0, 10);

async function addTags(id, tags) {
  const data = await gql(`mutation($id:ID!,$tags:[String!]!){ tagsAdd(id:$id, tags:$tags){ userErrors{ field message } } }`, { id, tags });
  check(data.tagsAdd, "tagsAdd");
}

async function addNote(id, line) {
  try {
    const cur = await gql(`query($id:ID!){ customer(id:$id){ note } }`, { id });
    const old = (cur.customer && cur.customer.note) || "";
    const data = await gql(`mutation($input:CustomerInput!){ customerUpdate(input:$input){ customer{ id } userErrors{ field message } } }`,
      { input: { id, note: (old ? old + "\n" : "") + line } });
    const errs = data.customerUpdate.userErrors || [];
    if (errs.length) console.warn("[signup] could not add note:", errs.map((e) => e.message).join("; "));
  } catch (e) { console.warn("[signup] could not add note:", e.message); }
}

// Only fills a name the record doesn't have yet. Never overwrites.
async function fillName(c, s) {
  const input = { id: c.id };
  if (!c.firstName && s.firstName) input.firstName = s.firstName;
  if (!c.lastName && s.lastName) input.lastName = s.lastName;
  if (Object.keys(input).length === 1) return;
  try { await gql(`mutation($input:CustomerInput!){ customerUpdate(input:$input){ userErrors{ message } } }`, { input }); }
  catch (e) { console.warn("[signup] could not add name:", e.message); }
}

// Consent never fails the signup; the person is saved either way.
async function consent(id, kind) {
  const m = kind === "sms"
    ? ["customerSmsMarketingConsentUpdate", "CustomerSmsMarketingConsentUpdateInput", { customerId: id, smsMarketingConsent: SUB }]
    : ["customerEmailMarketingConsentUpdate", "CustomerEmailMarketingConsentUpdateInput", { customerId: id, emailMarketingConsent: SUB }];
  try {
    const data = await gql(`mutation($input:${m[1]}!){ ${m[0]}(input:$input){ userErrors{ field message } } }`, { input: m[2] });
    const errs = data[m[0]].userErrors || [];
    if (errs.length) console.warn("[signup] could not subscribe to " + kind + ":", errs.map((e) => e.message).join("; "));
  } catch (e) { console.warn("[signup] could not subscribe to " + kind + ":", e.message); }
}

function describe(s) {
  return [s.firstName, s.lastName].filter(Boolean).join(" ") + " · " + s.email + " · " + s.phone +
    (s.smsConsent ? " · said yes to texts" : "") + (s.emailConsent ? " · said yes to emails" : "");
}

async function create(s, { withPhone, review }) {
  const input = {
    firstName: s.firstName || null, lastName: s.lastName || null, email: s.email,
    ...(withPhone && { phone: s.phone }),
    tags: review ? [...s.tags, REVIEW_TAG] : s.tags,
    note: s.note + (review ? "\n" + today() + " " + s.label + " — this phone is on another customer, so it wasn't saved here: " + describe(s) : ""),
    ...(s.emailConsent && { emailMarketingConsent: SUB }),
    ...(withPhone && s.smsConsent && { smsMarketingConsent: SUB }),
  };
  const data = await gql(`mutation($input:CustomerInput!){ customerCreate(input:$input){ customer{ id } userErrors{ field message } } }`, { input });
  return data.customerCreate;
}

// s = { firstName, lastName?, email (lowercase), phone (E.164), tags:[…], label, note, emailConsent, smsConsent }
// → { id, existing, review }
export async function saveSignup(s, retried = false) {
  const byEmail = await findCustomer("email:" + quote(s.email));
  const byPhone = await findCustomer("phone:" + quote(s.phone));
  const same = (c) => c && String(c.email || "").toLowerCase() === s.email && toE164(c.phone) === s.phone;

  const exact = [byEmail, byPhone].find(same);
  if (exact) {
    await addTags(exact.id, s.tags);
    await fillName(exact, s);
    if (s.emailConsent) await consent(exact.id, "email");
    if (s.smsConsent) await consent(exact.id, "sms");
    return { id: exact.id, existing: true, review: false };
  }

  if (byEmail) { // the email is on file but with a different (or no) phone
    await addTags(byEmail.id, [...s.tags, REVIEW_TAG]);
    await addNote(byEmail.id, today() + " " + s.label + " with details that don't match this record (not saved to it): " + describe(s));
    return { id: byEmail.id, existing: true, review: true };
  }

  // New email. If the phone already belongs to someone else, save them without it.
  const p = await create(s, { withPhone: !byPhone, review: !!byPhone });
  if (p.userErrors && p.userErrors.length) {
    const msg = p.userErrors.map((e) => e.message).join("; ");
    if (/phone/i.test(msg) && /taken/i.test(msg) && byPhone == null) {
      const again = await create(s, { withPhone: false, review: true });
      check(again, "customerCreate");
      return { id: again.customer.id, existing: false, review: true };
    }
    if (/taken/i.test(msg) && !retried) return saveSignup(s, true); // raced with another signup
    check(p, "customerCreate");
  }
  if (!p.customer) throw new ShopifyError("customerCreate returned no customer", p);
  return { id: p.customer.id, existing: false, review: !!byPhone };
}
